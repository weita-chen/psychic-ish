import deckFile from "../../data/spectrum-cards.json";
import { COPY } from "./copy";
import { isCharacterId } from "./characters";
import { clamp01, randomTargetCenter, scoreNeedle } from "./scoring";
import {
  DEFAULT_NEEDLE,
  DISCONNECT_GRACE_MS,
  HEARTBEAT_STALE_MS,
  INTERSTITIAL_MS,
  MAX_CLUE_LEN,
  MAX_NICKNAME_LEN,
  MAX_PLAYERS,
  MIN_PLAYERS,
  REVEAL_COUNTDOWN_MS,
  ROOM_EXPIRE_MS,
  type ActionErr,
  type ActionResult,
  type CharacterId,
  type ClientView,
  type Player,
  type PublicPlayer,
  type RevealedNeedle,
  type RoomState,
  type SpectrumCard,
} from "./types";

export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GameError";
    this.code = code;
  }
}

export function err(code: string, error: string): ActionErr {
  return { ok: false, code, error };
}

const ALL_CARDS = (deckFile as { cards: SpectrumCard[] }).cards;
const ENABLED_CARDS = ALL_CARDS.filter((c) => c.enabled && !c.nsfw);
const CARD_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

export function getCard(id: string): SpectrumCard | undefined {
  return CARD_BY_ID.get(id);
}

export function enabledCardIds(): string[] {
  return ENABLED_CARDS.map((c) => c.id);
}

function nowMs(): number {
  return Date.now();
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newPlayerId(): string {
  return newId("p");
}

function pickWeighted(ids: string[]): string {
  const cards = ids
    .map((id) => CARD_BY_ID.get(id))
    .filter((c): c is SpectrumCard => Boolean(c));
  const total = cards.reduce((s, c) => s + (c.weight || 1), 0);
  if (total <= 0 || cards.length === 0) {
    return ids[0] ?? ENABLED_CARDS[0]!.id;
  }
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  let r = (buf[0]! / 2 ** 32) * total;
  for (const card of cards) {
    r -= card.weight || 1;
    if (r <= 0) return card.id;
  }
  return cards[cards.length - 1]!.id;
}

function reshuffle(_avoidId: string | null): string[] {
  return enabledCardIds();
}

function drawCard(state: RoomState): string {
  let bag = state.remainingCardIds.filter((id) => CARD_BY_ID.get(id)?.enabled);
  if (bag.length === 0) {
    bag = reshuffle(state.lastDrawnCardId);
  }
  let id = pickWeighted(bag);
  if (bag.length > 1 && id === state.lastDrawnCardId) {
    const rest = bag.filter((x) => x !== id);
    if (rest.length) id = pickWeighted(rest);
  }
  state.remainingCardIds = bag.filter((x) => x !== id);
  state.lastDrawnCardId = id;
  return id;
}

export function activePlayers(state: RoomState, now: number): Player[] {
  return state.players.filter((p) => isActive(p, now));
}

export function isActive(p: Player, now: number): boolean {
  if (p.status === "left") return false;
  if (p.status === "disconnected") {
    return now - p.lastSeen < DISCONNECT_GRACE_MS;
  }
  return true;
}

export function createEmptyRoom(roomCode: string, host: Player): RoomState {
  const now = nowMs();
  return {
    roomCode,
    hostPlayerId: host.playerId,
    players: [host],
    phase: "lobby",
    mode: null,
    roundNumber: 0,
    turnNumber: 0,
    remainingCardIds: enabledCardIds(),
    lastDrawnCardId: null,
    currentTurn: null,
    lastActivityAt: now,
    interstitialEndsAt: null,
    closedReason: null,
    nudge: null,
    createdAt: now,
  };
}

export function makePlayer(input: {
  playerId: string;
  nickname: string;
  characterId: CharacterId;
  colorIndex: number;
}): Player {
  const now = nowMs();
  return {
    playerId: input.playerId,
    nickname: input.nickname,
    characterId: input.characterId,
    connected: true,
    lastSeen: now,
    status: "active",
    hasBeenDevoteeThisRound: false,
    totalScore: 0,
    joinedAt: now,
    colorIndex: input.colorIndex,
  };
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NICKNAME_LEN);
}

export function parseCharacter(raw: string): CharacterId {
  if (isCharacterId(raw)) return raw;
  return "few_screws_loose";
}

export function parseRoomCode(raw: string): string | null {
  const code = raw.trim();
  if (!/^\d{4}$/.test(code)) return null;
  return code;
}

export function isExpired(state: RoomState, now: number): boolean {
  return now - state.lastActivityAt > ROOM_EXPIRE_MS;
}

/** Advance time-based phases and disconnects. Mutates state. */
export function tick(state: RoomState, now: number): void {
  if (state.phase === "closed") return;

  let removed = false;
  for (const p of state.players) {
    if (p.status === "left") continue;
    const silent = now - p.lastSeen;
    if (p.connected && silent >= HEARTBEAT_STALE_MS) {
      p.connected = false;
      p.status = "disconnected";
    }
    if (!p.connected && silent >= DISCONNECT_GRACE_MS) {
      p.status = "left";
      p.connected = false;
      removed = true;
    }
  }

  if (removed) handleRemovals(state, now);

  if (state.phase === "revealCountdown" && state.currentTurn) {
    const ends = state.currentTurn.revealCountdownEndsAt ?? 0;
    if (now >= ends && !state.currentTurn.revealed) {
      performReveal(state, now);
    }
  }

  if (state.phase === "reveal" && state.mode === "party") {
    const ends = state.interstitialEndsAt ?? 0;
    if (ends && now >= ends) {
      if (partyRoundComplete(state, now)) {
        state.phase = "roundResults";
        state.interstitialEndsAt = null;
      } else {
        state.phase = "interstitial";
        state.interstitialEndsAt = now + INTERSTITIAL_MS;
      }
    }
  }

  if (state.phase === "interstitial") {
    const ends = state.interstitialEndsAt ?? 0;
    if (now >= ends) startNextTurn(state, now);
  }

  if (
    state.phase === "roundResults" &&
    !state.players.some((p) => p.playerId === state.hostPlayerId && isActive(p, now))
  ) {
    if (!state.interstitialEndsAt) {
      state.interstitialEndsAt = now + 4000;
    } else if (now >= state.interstitialEndsAt) {
      closeRoom(state, COPY.hostGoneNoReplay);
    }
  }
}

function handleRemovals(state: RoomState, now: number): void {
  if (state.phase === "lobby") return;
  const active = activePlayers(state, now);
  if (active.length < MIN_PLAYERS) {
    closeRoom(state, COPY.tooFewLeft);
    return;
  }
  const turn = state.currentTurn;
  if (!turn) return;

  const devoteeStill = active.some((p) => p.playerId === turn.devoteeId);
  if (!devoteeStill && (state.phase === "awaitClue" || !turn.clue)) {
    startNextTurn(state, now);
    return;
  }
  if ((state.phase === "guessing" || state.phase === "awaitClue") && turn.clue) {
    maybeStartCountdown(state, now);
  }
}

function closeRoom(state: RoomState, reason: string): void {
  state.phase = "closed";
  state.closedReason = reason;
}

function pickDevotee(state: RoomState, now: number): Player {
  const active = activePlayers(state, now);
  if (active.length === 0) {
    throw new GameError("no_players", COPY.invalidAction);
  }
  if (state.mode === "duo" && state.currentTurn) {
    const other = active.find((p) => p.playerId !== state.currentTurn!.devoteeId);
    if (other) return other;
  }
  const remaining = active.filter((p) => !p.hasBeenDevoteeThisRound);
  const pool = remaining.length > 0 ? remaining : active;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[buf[0]! % pool.length]!;
}

function startTurn(state: RoomState, now: number): void {
  const devotee = pickDevotee(state, now);
  devotee.hasBeenDevoteeThisRound = true;
  const cardId = drawCard(state);
  const targetCenter = randomTargetCenter();
  state.turnNumber += 1;
  state.currentTurn = {
    devoteeId: devotee.playerId,
    cardId,
    targetCenter,
    clue: null,
    needlePositions: {},
    readyPlayerIds: [],
    revealCountdownEndsAt: null,
    revealed: false,
    turnScores: {},
    averagePosition: null,
    lastCardId: cardId,
  };
  state.phase = "awaitClue";
  state.interstitialEndsAt = null;
  state.nudge = null;
}

function resetRoundFlags(state: RoomState): void {
  for (const p of state.players) {
    p.hasBeenDevoteeThisRound = false;
    p.totalScore = 0;
  }
  state.roundNumber += 1;
  state.turnNumber = 0;
  state.remainingCardIds = enabledCardIds();
}

export function startGame(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "lobby") {
    if (state.phase === "closed") throw new GameError("closed", COPY.roomClosed);
    return;
  }
  if (actorId !== state.hostPlayerId) {
    throw new GameError("forbidden", COPY.invalidAction);
  }
  const active = activePlayers(state, now);
  if (active.length < MIN_PLAYERS) {
    throw new GameError("need_two", COPY.needTwo);
  }
  if (active.length > MAX_PLAYERS) {
    throw new GameError("full", COPY.roomFull);
  }
  state.mode = active.length === 2 ? "duo" : "party";
  resetRoundFlags(state);
  startTurn(state, now);
}

function channelers(state: RoomState, now: number): Player[] {
  const turn = state.currentTurn;
  if (!turn) return [];
  return activePlayers(state, now).filter((p) => p.playerId !== turn.devoteeId);
}

function maybeStartCountdown(state: RoomState, now: number): void {
  if (state.phase !== "guessing" || !state.currentTurn) return;
  const needed = channelers(state, now);
  if (needed.length === 0) return;
  const ready = new Set(state.currentTurn.readyPlayerIds);
  if (needed.every((p) => ready.has(p.playerId))) {
    state.phase = "revealCountdown";
    state.currentTurn.revealCountdownEndsAt = now + REVEAL_COUNTDOWN_MS;
  }
}

function performReveal(state: RoomState, now: number): void {
  const turn = state.currentTurn;
  if (!turn || turn.revealed) return;
  turn.revealed = true;
  const chan = channelers(state, now);
  const scores: Record<string, number> = {};
  let sumPos = 0;
  let count = 0;
  for (const p of chan) {
    const pos = clamp01(turn.needlePositions[p.playerId] ?? DEFAULT_NEEDLE);
    turn.needlePositions[p.playerId] = pos;
    const s = scoreNeedle(pos, turn.targetCenter);
    scores[p.playerId] = s;
    p.totalScore += s;
    sumPos += pos;
    count += 1;
  }
  const channelerSum = Object.values(scores).reduce((a, b) => a + b, 0);
  const devoteeScore = state.mode === "party" ? channelerSum : channelerSum > 0 ? 1 : 0;
  const devotee = state.players.find((p) => p.playerId === turn.devoteeId);
  if (devotee && isActive(devotee, now)) devotee.totalScore += devoteeScore;
  scores[turn.devoteeId] = devoteeScore;
  turn.turnScores = scores;
  turn.averagePosition = count > 0 ? sumPos / count : null;
  state.phase = "reveal";
  if (state.mode === "party") {
    state.interstitialEndsAt = now + 7000;
  }
}

function partyRoundComplete(state: RoomState, now: number): boolean {
  const active = activePlayers(state, now);
  if (active.length < MIN_PLAYERS) return false;
  return active.every((p) => p.hasBeenDevoteeThisRound);
}

function startNextTurn(state: RoomState, now: number): void {
  if (state.mode === "party" && partyRoundComplete(state, now)) {
    state.phase = "roundResults";
    state.interstitialEndsAt = null;
    return;
  }
  startTurn(state, now);
}

export function submitClue(state: RoomState, actorId: string, raw: string, now: number): void {
  if (state.phase !== "awaitClue" || !state.currentTurn) {
    if (state.currentTurn?.clue && state.currentTurn.devoteeId === actorId) return;
    throw new GameError("phase", COPY.invalidAction);
  }
  if (actorId !== state.currentTurn.devoteeId) {
    throw new GameError("phase", COPY.invalidAction);
  }
  if (state.currentTurn.clue) return;
  const clue = raw.replace(/\s+/g, " ").trim();
  if (!clue) throw new GameError("empty_clue", COPY.emptyClue);
  if (clue.length > MAX_CLUE_LEN) throw new GameError("clue_long", COPY.clueTooLong);
  state.currentTurn.clue = clue;
  for (const p of channelers(state, now)) {
    if (state.currentTurn.needlePositions[p.playerId] == null) {
      state.currentTurn.needlePositions[p.playerId] = DEFAULT_NEEDLE;
    }
  }
  state.phase = "guessing";
}

export function updateNeedle(
  state: RoomState,
  actorId: string,
  position: number,
  now: number,
): void {
  void now;
  if (state.phase !== "guessing" || !state.currentTurn) {
    throw new GameError("phase", COPY.invalidAction);
  }
  if (actorId === state.currentTurn.devoteeId) {
    throw new GameError("phase", COPY.invalidAction);
  }
  if (state.currentTurn.readyPlayerIds.includes(actorId)) {
    throw new GameError("locked", COPY.lockedNeedle);
  }
  const player = state.players.find((p) => p.playerId === actorId);
  if (!player || player.status === "left") {
    throw new GameError("phase", COPY.invalidAction);
  }
  state.currentTurn.needlePositions[actorId] = clamp01(position);
}

export function markReady(
  state: RoomState,
  actorId: string,
  now: number,
  position?: number,
): void {
  if (state.phase === "guessing" && state.currentTurn && actorId !== state.currentTurn.devoteeId) {
    if (typeof position === "number" && !state.currentTurn.readyPlayerIds.includes(actorId)) {
      state.currentTurn.needlePositions[actorId] = clamp01(position);
    }
  }
  if (state.phase !== "guessing" || !state.currentTurn) {
    if (
      state.currentTurn?.readyPlayerIds.includes(actorId) &&
      (state.phase === "guessing" ||
        state.phase === "revealCountdown" ||
        state.phase === "reveal")
    ) {
      return;
    }
    throw new GameError("phase", COPY.invalidAction);
  }
  if (actorId === state.currentTurn.devoteeId) {
    throw new GameError("phase", COPY.invalidAction);
  }
  if (!state.currentTurn.readyPlayerIds.includes(actorId)) {
    if (state.currentTurn.needlePositions[actorId] == null) {
      state.currentTurn.needlePositions[actorId] = DEFAULT_NEEDLE;
    }
    state.currentTurn.readyPlayerIds.push(actorId);
  }
  maybeStartCountdown(state, now);
}

export function continueDuo(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "reveal" || state.mode !== "duo") {
    if (state.phase === "awaitClue" && state.mode === "duo") return;
    throw new GameError("phase", COPY.invalidAction);
  }
  const actor = state.players.find((p) => p.playerId === actorId);
  if (!actor || !isActive(actor, now)) {
    throw new GameError("phase", COPY.invalidAction);
  }
  startTurn(state, now);
}

export function settleDuo(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "reveal" || state.mode !== "duo") {
    if (state.phase === "finalResults") return;
    throw new GameError("phase", COPY.invalidAction);
  }
  const actor = state.players.find((p) => p.playerId === actorId);
  if (!actor || !isActive(actor, now)) {
    throw new GameError("phase", COPY.invalidAction);
  }
  state.phase = "finalResults";
}

export function playAgain(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "roundResults") {
    if (state.phase === "awaitClue" && state.roundNumber > 1) return;
    throw new GameError("phase", COPY.invalidAction);
  }
  if (actorId !== state.hostPlayerId) {
    throw new GameError("forbidden", COPY.invalidAction);
  }
  const host = state.players.find((p) => p.playerId === state.hostPlayerId);
  if (!host || !isActive(host, now)) {
    closeRoom(state, COPY.hostGoneNoReplay);
    throw new GameError("host_gone", COPY.hostGoneNoReplay);
  }
  const active = activePlayers(state, now);
  if (active.length < MIN_PLAYERS) {
    throw new GameError("need_two", COPY.needTwo);
  }
  state.mode = active.length === 2 ? "duo" : "party";
  resetRoundFlags(state);
  startTurn(state, now);
}

export function skipInterstitial(state: RoomState, now: number): void {
  if (state.phase !== "interstitial") return;
  startNextTurn(state, now);
}

export function advanceAfterReveal(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "reveal") return;
  if (state.mode === "duo") return;
  const actor = state.players.find((p) => p.playerId === actorId);
  if (!actor || !isActive(actor, now)) return;
  if (partyRoundComplete(state, now)) {
    state.phase = "roundResults";
    state.interstitialEndsAt = null;
    return;
  }
  state.phase = "interstitial";
  state.interstitialEndsAt = now + INTERSTITIAL_MS;
}

export function nudge(state: RoomState, actorId: string, now: number): void {
  if (state.phase !== "guessing" && state.phase !== "awaitClue") {
    throw new GameError("phase", COPY.invalidAction);
  }
  const actor = state.players.find((p) => p.playerId === actorId);
  if (!actor || !isActive(actor, now)) {
    throw new GameError("phase", COPY.invalidAction);
  }
  state.nudge = { fromId: actorId, at: now };
}

export function updateProfile(
  state: RoomState,
  actorId: string,
  nickname: string,
  characterId: CharacterId,
): void {
  if (state.phase !== "lobby") {
    throw new GameError("phase", COPY.invalidAction);
  }
  const player = state.players.find((p) => p.playerId === actorId);
  if (!player) throw new GameError("phase", COPY.invalidAction);
  const name = sanitizeNickname(nickname);
  if (!name) throw new GameError("empty_nick", COPY.emptyNickname);
  player.nickname = name;
  player.characterId = characterId;
}

export function joinPlayer(state: RoomState, player: Player, now: number): void {
  if (state.phase !== "lobby") {
    throw new GameError("started", COPY.alreadyStarted);
  }
  const active = activePlayers(state, now);
  if (active.length >= MAX_PLAYERS) {
    throw new GameError("full", COPY.roomFull);
  }
  state.players.push(player);
}

export function touchPlayer(state: RoomState, playerId: string, now: number): Player | null {
  const p = state.players.find((x) => x.playerId === playerId);
  if (!p) return null;
  if (p.status === "left") return p;
  p.connected = true;
  p.lastSeen = now;
  p.status = "active";
  return p;
}

export function markDisconnected(state: RoomState, playerId: string, now: number): void {
  const p = state.players.find((x) => x.playerId === playerId);
  if (!p || p.status === "left") return;
  p.connected = false;
  p.lastSeen = now;
  p.status = "disconnected";
}

function titlesFor(state: RoomState, now: number): ClientView["titles"] {
  if (state.phase !== "roundResults") return null;
  const ranked = [...activePlayers(state, now)].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.joinedAt - b.joinedAt;
  });
  if (ranked.length < 2) return null;
  return {
    masterId: ranked[0]!.playerId,
    fraudId: ranked[ranked.length - 1]!.playerId,
  };
}

export function toClientView(
  state: RoomState,
  viewerId: string,
  now: number,
  version = 0,
): ClientView {
  const turn = state.currentTurn;
  const you = state.players.find((p) => p.playerId === viewerId);
  const isDevotee = Boolean(turn && you && turn.devoteeId === you.playerId);
  const isChanneler = Boolean(turn && you && turn.devoteeId !== you.playerId);
  const revealed =
    state.phase === "reveal" ||
    state.phase === "interstitial" ||
    state.phase === "roundResults" ||
    state.phase === "finalResults" ||
    Boolean(turn?.revealed);
  const showTarget = isDevotee || revealed;
  const card = turn ? getCard(turn.cardId) : undefined;

  const chanNow = turn ? channelers(state, now) : [];
  const extra =
    revealed && turn
      ? state.players.filter(
          (p) =>
            p.playerId !== turn.devoteeId &&
            turn.turnScores[p.playerId] != null &&
            !chanNow.some((c) => c.playerId === p.playerId),
        )
      : [];

  const needles: RevealedNeedle[] | null =
    revealed && turn
      ? [...chanNow, ...extra]
          .filter((p, i, arr) => arr.findIndex((x) => x.playerId === p.playerId) === i)
          .map((p) => ({
            playerId: p.playerId,
            nickname: p.nickname,
            characterId: p.characterId,
            colorIndex: p.colorIndex,
            position: turn.needlePositions[p.playerId] ?? DEFAULT_NEEDLE,
            score: turn.turnScores[p.playerId] ?? 0,
          }))
      : null;

  const players: PublicPlayer[] = state.players.map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    characterId: p.characterId,
    connected: p.connected && p.status !== "left",
    status: p.status === "disconnected" && isActive(p, now) ? "disconnected" : p.status,
    totalScore: p.totalScore,
    ready: Boolean(turn?.readyPlayerIds.includes(p.playerId)),
    isDevotee: Boolean(turn && turn.devoteeId === p.playerId),
    isHost: p.playerId === state.hostPlayerId,
    isYou: p.playerId === viewerId,
    hasBeenDevoteeThisRound: p.hasBeenDevoteeThisRound,
    colorIndex: p.colorIndex,
    turnScore: revealed && turn ? (turn.turnScores[p.playerId] ?? null) : null,
  }));

  const hostPresent = state.players.some(
    (p) => p.playerId === state.hostPlayerId && isActive(p, now),
  );

  const yourNeedle =
    isChanneler && turn ? (turn.needlePositions[viewerId] ?? DEFAULT_NEEDLE) : null;

  return {
    roomCode: state.roomCode,
    you: {
      playerId: viewerId,
      isHost: viewerId === state.hostPlayerId,
      isDevotee,
      isChanneler: isChanneler && !isDevotee,
    },
    hostPlayerId: state.hostPlayerId,
    hostPresent,
    players,
    activeCount: activePlayers(state, now).length,
    phase: state.phase,
    mode: state.mode,
    roundNumber: state.roundNumber,
    turnNumber: state.turnNumber,
    card: card ? { id: card.id, leftZh: card.leftZh, rightZh: card.rightZh } : null,
    clue: turn?.clue ?? null,
    targetCenter: showTarget && turn ? turn.targetCenter : null,
    showBands: showTarget,
    yourNeedle,
    yourReady: Boolean(turn?.readyPlayerIds.includes(viewerId)),
    needles,
    averagePosition: revealed ? (turn?.averagePosition ?? null) : null,
    revealCountdownEndsAt: turn?.revealCountdownEndsAt ?? null,
    interstitialEndsAt: state.interstitialEndsAt,
    serverNow: now,
    canStart:
      state.phase === "lobby" &&
      viewerId === state.hostPlayerId &&
      activePlayers(state, now).length >= MIN_PLAYERS,
    canPlayAgain: state.phase === "roundResults" && viewerId === state.hostPlayerId && hostPresent,
    canContinueDuo: state.phase === "reveal" && state.mode === "duo",
    canSettleDuo: state.phase === "reveal" && state.mode === "duo",
    titles: titlesFor(state, now),
    closedReason: state.closedReason,
    nudgeAt: state.nudge?.at ?? null,
    version,
  };
}

export function wrapOk(state: RoomState, viewerId: string, now: number): ActionResult {
  return { ok: true, view: toClientView(state, viewerId, now) };
}
