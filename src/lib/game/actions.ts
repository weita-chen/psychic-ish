import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ActionResult } from "./types";

const tokenFields = {
  roomCode: z.string(),
  token: z.string().min(8),
};

export const createRoom = createServerFn({ method: "POST" })
  .validator(
    z.object({
      nickname: z.string(),
      characterId: z.string(),
      deckIds: z.array(z.enum(["a", "b"])).min(1).optional(),
    }),
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const { createRoomRecord } = await import("./store.server");
    return createRoomRecord(data);
  });

export const joinRoom = createServerFn({ method: "POST" })
  .validator(
    z.object({
      roomCode: z.string(),
      nickname: z.string(),
      characterId: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const { joinRoomRecord } = await import("./store.server");
    return joinRoomRecord(data);
  });

export const getRoom = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { readRoom } = await import("./store.server");
    return readRoom(data.roomCode, data.token);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...tokenFields,
      nickname: z.string(),
      characterId: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { parseCharacter, updateProfile: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId }) => {
      apply(state, playerId, data.nickname, parseCharacter(data.characterId));
    });
  });

export const updateDecks = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...tokenFields,
      deckIds: z.array(z.enum(["a", "b"])).min(1),
    }),
  )
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { updateDecks: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId }) => {
      apply(state, playerId, data.deckIds);
    });
  });

export const startGame = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { startGame: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, now);
    });
  });

export const submitClue = createServerFn({ method: "POST" })
  .validator(z.object({ ...tokenFields, clue: z.string() }))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { submitClue: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, data.clue, now);
    });
  });

export const moveNeedle = createServerFn({ method: "POST" })
  .validator(z.object({ ...tokenFields, position: z.number() }))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { updateNeedle } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      updateNeedle(state, playerId, data.position, now);
    });
  });

export const markReady = createServerFn({ method: "POST" })
  .validator(z.object({ ...tokenFields, position: z.number().optional() }))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { markReady: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, now, data.position);
    });
  });

export const continueDuo = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { continueDuo: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, now);
    });
  });

export const settleDuo = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { settleDuo: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, now);
    });
  });

export const playAgain = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { playAgain: apply } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      apply(state, playerId, now);
    });
  });

export const advanceReveal = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { advanceAfterReveal, skipInterstitial } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      if (state.phase === "interstitial") skipInterstitial(state, playerId, now);
      else advanceAfterReveal(state, playerId, now);
    });
  });

export const sendNudge = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    const { nudge } = await import("./engine.server");
    return mutateRoom(data.roomCode, { token: data.token }, ({ state, playerId, now }) => {
      nudge(state, playerId, now);
    });
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .validator(z.object(tokenFields))
  .handler(async ({ data }): Promise<ActionResult> => {
    const { mutateRoom } = await import("./store.server");
    return mutateRoom(
      data.roomCode,
      { token: data.token, allowLeft: true },
      ({ state, playerId, now }) => {
        const p = state.players.find((x) => x.playerId === playerId);
        if (p && p.status !== "left") {
          p.status = "left";
          p.connected = false;
          p.lastSeen = now;
        }
      },
    );
  });
