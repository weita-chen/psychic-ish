import { DatabaseUnavailableError, getSql } from "@/lib/db";
import { COPY } from "./copy";
import {
  createEmptyRoom,
  err,
  GameError,
  isExpired,
  joinPlayer,
  makePlayer,
  newPlayerId,
  newToken,
  parseCharacter,
  parseRoomCode,
  sanitizeNickname,
  tick,
  toClientView,
  touchPlayer,
} from "./engine.server";
import type { ActionResult, CharacterId, RoomState } from "./types";

type RoomRow = {
  room_code: string;
  host_player_id: string;
  state: RoomState | string;
  tokens: Record<string, string> | string;
  version: number;
  last_activity: string;
};

const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  locks.set(
    key,
    prev.then(() => next),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === next) locks.delete(key);
  }
}

function parseState(raw: RoomState | string): RoomState {
  const state = (typeof raw === "string" ? JSON.parse(raw) : raw) as RoomState;
  if (!Array.isArray(state.roundHistory)) state.roundHistory = [];
  for (const p of state.players) {
    if (typeof p.devoteeRoundScore !== "number") p.devoteeRoundScore = 0;
  }
  return state;
}

function parseTokens(raw: Record<string, string> | string): Record<string, string> {
  if (typeof raw === "string") return JSON.parse(raw) as Record<string, string>;
  return raw ?? {};
}

async function loadRow(code: string): Promise<RoomRow | null> {
  const sql = await getSql();
  const rows = await sql.query<RoomRow>(
    "select room_code, host_player_id, state, tokens, version, last_activity from rooms where room_code = $1",
    [code],
  );
  return rows[0] ?? null;
}

async function insertRoom(state: RoomState, tokens: Record<string, string>): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into rooms (room_code, host_player_id, state, tokens, version, last_activity)
     values ($1, $2, $3::jsonb, $4::jsonb, 0, to_timestamp($5 / 1000.0))`,
    [
      state.roomCode,
      state.hostPlayerId,
      JSON.stringify(state),
      JSON.stringify(tokens),
      state.lastActivityAt,
    ],
  );
}

async function saveRoom(
  state: RoomState,
  tokens: Record<string, string>,
  expectedVersion: number,
  touchActivity: boolean,
): Promise<boolean> {
  const sql = await getSql();
  const now = Date.now();
  if (touchActivity) state.lastActivityAt = now;
  const rows = await sql.query<{ room_code: string }>(
    `update rooms
        set state = $1::jsonb,
            tokens = $2::jsonb,
            host_player_id = $3,
            version = version + 1,
            last_activity = case when $6 then to_timestamp($5 / 1000.0) else last_activity end
      where room_code = $4 and version = $7
      returning room_code`,
    [
      JSON.stringify(state),
      JSON.stringify(tokens),
      state.hostPlayerId,
      state.roomCode,
      now,
      touchActivity,
      expectedVersion,
    ],
  );
  return rows.length > 0;
}

async function deleteRoom(code: string): Promise<void> {
  const sql = await getSql();
  await sql.query("delete from rooms where room_code = $1", [code]);
}

export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(buf[0]! % 10000).padStart(4, "0");
    const existing = await loadRow(code);
    if (!existing) return code;
    const state = parseState(existing.state);
    if (isExpired(state, Date.now())) {
      await deleteRoom(code);
      return code;
    }
  }
  throw new GameError("code", "一時找不到空的壇號，再試一次。");
}

type MutateOpts = {
  token: string;
  touchActivity?: boolean;
  allowLeft?: boolean;
};

export async function mutateRoom(
  roomCode: string,
  opts: MutateOpts,
  fn: (ctx: {
    state: RoomState;
    tokens: Record<string, string>;
    playerId: string;
    now: number;
  }) => void,
): Promise<ActionResult> {
  const code = parseRoomCode(roomCode);
  if (!code) return err("bad_code", COPY.invalidCode);

  try {
    return await withLock(code, async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const row = await loadRow(code);
      if (!row) return err("not_found", COPY.roomNotFound);
      const now = Date.now();
      const state = parseState(row.state);
      const tokens = parseTokens(row.tokens);

      if (isExpired(state, now)) {
        await deleteRoom(code);
        return err("expired", COPY.roomExpired);
      }

      const playerId = tokens[opts.token];
      if (!playerId) return err("auth", COPY.leftRemoved);

      const player = state.players.find((p) => p.playerId === playerId);
      if (!player) return err("auth", COPY.leftRemoved);
      if (player.status === "left" && !opts.allowLeft) {
        return err("left", COPY.leftRemoved);
      }

      tick(state, now);
      if (state.phase === "closed" && player.status === "left") {
        return err("closed", state.closedReason ?? COPY.roomClosed);
      }
      touchPlayer(state, playerId, now);

      try {
        fn({ state, tokens, playerId, now: Date.now() });
      } catch (e) {
        if (e instanceof GameError) return err(e.code, e.message);
        throw e;
      }

      const saved = await saveRoom(state, tokens, row.version, opts.touchActivity !== false);
      if (!saved) continue;
      return { ok: true, view: toClientView(state, playerId, Date.now(), row.version + 1) };
    }
    return err("conflict", COPY.network);
    });
  } catch (e) {
    return asActionError(e);
  }
}

export async function readRoom(roomCode: string, token: string): Promise<ActionResult> {
  const code = parseRoomCode(roomCode);
  if (!code) return err("bad_code", COPY.invalidCode);
  try {
    const row = await loadRow(code);
    if (!row) return err("not_found", COPY.roomNotFound);
    const now = Date.now();
    const state = parseState(row.state);
    const tokens = parseTokens(row.tokens);
    if (isExpired(state, now)) {
      await deleteRoom(code);
      return err("expired", COPY.roomExpired);
    }
    const playerId = tokens[token];
    if (!playerId) return err("auth", COPY.leftRemoved);
    const player = state.players.find((p) => p.playerId === playerId);
    if (!player) return err("auth", COPY.leftRemoved);
    if (player.status === "left") return err("left", COPY.leftRemoved);

    const before = roomFingerprint(state);
    tick(state, now);
    const ticked = roomFingerprint(state) !== before;
    const heartbeatDue = now - player.lastSeen >= 4_000;

    if (ticked || heartbeatDue) {
      return mutateRoom(roomCode, { token, touchActivity: true }, () => {
        /* persist tick / lastSeen */
      });
    }
    return { ok: true, view: toClientView(state, playerId, now, row.version) };
  } catch (e) {
    return asActionError(e);
  }
}

function roomFingerprint(state: RoomState): string {
  const turn = state.currentTurn;
  return [
    state.phase,
    turn?.revealed ? "1" : "0",
    turn?.revealCountdownEndsAt ?? "",
    state.interstitialEndsAt ?? "",
    turn?.readyPlayerIds.join(",") ?? "",
    state.closedReason ?? "",
    state.players.map((p) => `${p.playerId}:${p.status}:${p.connected ? 1 : 0}`).join(";"),
  ].join("|");
}

function asActionError(e: unknown): ActionResult {
  if (e instanceof GameError) return err(e.code, e.message);
  if (e instanceof DatabaseUnavailableError) return err("db", COPY.noDatabase);
  console.error("[rooms]", e);
  return err("network", COPY.network);
}

export async function createRoomRecord(input: {
  nickname: string;
  characterId: string;
}): Promise<ActionResult> {
  try {
    const nickname = sanitizeNickname(input.nickname);
    if (!nickname) return err("empty_nick", COPY.emptyNickname);
    const characterId = parseCharacter(input.characterId);
    const playerId = newPlayerId();
    const token = newToken();
    const player = makePlayer({
      playerId,
      nickname,
      characterId,
      colorIndex: 0,
    });
    const code = await generateUniqueCode();
    const state = createEmptyRoom(code, player);
    const tokens = { [token]: playerId };
    await insertRoom(state, tokens);
    return {
      ok: true,
      view: toClientView(state, playerId, Date.now(), 0),
      token,
      playerId,
    };
  } catch (e) {
    return asActionError(e);
  }
}

export async function joinRoomRecord(input: {
  roomCode: string;
  nickname: string;
  characterId: string;
}): Promise<ActionResult> {
  const code = parseRoomCode(input.roomCode);
  if (!code) return err("bad_code", COPY.invalidCode);
  const nickname = sanitizeNickname(input.nickname);
  if (!nickname) return err("empty_nick", COPY.emptyNickname);
  const characterId = parseCharacter(input.characterId) as CharacterId;

  try {
    return await withLock(code, async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const row = await loadRow(code);
      if (!row) return err("not_found", COPY.roomNotFound);
      const now = Date.now();
      const state = parseState(row.state);
      const tokens = parseTokens(row.tokens);
      if (isExpired(state, now)) {
        await deleteRoom(code);
        return err("expired", COPY.roomExpired);
      }
      tick(state, now);
      if (state.phase !== "lobby") return err("started", COPY.alreadyStarted);
      const usedColors = new Set(state.players.map((p) => p.colorIndex));
      let colorIndex = 0;
      while (usedColors.has(colorIndex) && colorIndex < 8) colorIndex += 1;

      const playerId = newPlayerId();
      const token = newToken();
      const player = makePlayer({ playerId, nickname, characterId, colorIndex });
      try {
        joinPlayer(state, player, now);
      } catch (e) {
        if (e instanceof GameError) return err(e.code, e.message);
        throw e;
      }
      tokens[token] = playerId;
      const saved = await saveRoom(state, tokens, row.version, true);
      if (!saved) continue;
      return {
        ok: true,
        view: toClientView(state, playerId, Date.now(), row.version + 1),
        token,
        playerId,
      };
    }
    return err("conflict", COPY.network);
    });
  } catch (e) {
    return asActionError(e);
  }
}
