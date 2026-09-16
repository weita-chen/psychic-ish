import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  advanceReveal,
  continueDuo,
  getRoom,
  leaveRoom,
  markReady,
  moveNeedle,
  playAgain,
  setReaction,
  settleDuo,
  startGame,
  submitClue,
  updateDecks,
  updateProfile,
} from "./actions";
import type { ActionResult, CharacterId, ClientView } from "./types";
import type { DeckId } from "./decks";
import { COPY } from "./copy";
import { clearSession, saveSession, type Session } from "@/lib/session";

declare global {
  interface Window {
    __psi?: ClientView | null;
  }
}

function pollDelay(phase: ClientView["phase"] | undefined): number {
  if (phase === "guessing" || phase === "revealCountdown" || phase === "interstitial") return 400;
  if (phase === "awaitClue" || phase === "reveal" || phase === "lobby") return 500;
  return 900;
}

export function useRoom(session: Session | null) {
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const prevViewRef = useRef<ClientView | null>(null);
  const lastVersion = useRef(-1);
  const dirtyNeedle = useRef<number | null>(null);
  const pendingNeedle = useRef<number | null>(null);
  const needleTimer = useRef(0);
  const pollInflight = useRef(false);
  const pollFails = useRef(0);

  const apply = useCallback((result: ActionResult) => {
    if (result.ok) {
      if (result.view.version < lastVersion.current) return true;
      lastVersion.current = result.view.version;

      if (dirtyNeedle.current != null && result.view.phase === "guessing") {
        const server = result.view.yourNeedle;
        if (server != null && Math.abs(server - dirtyNeedle.current) < 0.004) {
          dirtyNeedle.current = null;
        } else {
          result.view.yourNeedle = dirtyNeedle.current;
        }
      } else if (result.view.phase !== "guessing") {
        dirtyNeedle.current = null;
      }

      const prev = prevViewRef.current;
      if (prev) {
        const wasPresent = new Set(
          prev.players.filter((p) => p.status !== "left").map((p) => p.playerId),
        );
        const newlyLeft = result.view.players.some(
          (p) =>
            p.status === "left" &&
            wasPresent.has(p.playerId) &&
            p.playerId !== result.view.you.playerId,
        );
        if (newlyLeft) toast(COPY.playerLeft);
      }
      prevViewRef.current = result.view;
      setView(result.view);
      setError(null);
      if (typeof window !== "undefined") window.__psi = result.view;
      if (result.view.phase === "closed") {
        setFatal(result.view.closedReason ?? COPY.roomClosed);
      }
      return true;
    }
    if (
      result.code === "expired" ||
      result.code === "not_found" ||
      result.code === "left" ||
      result.code === "closed"
    ) {
      setFatal(result.error);
      const s = sessionRef.current;
      if (s) clearSession(s.roomCode);
    } else {
      setError(result.error);
    }
    return false;
  }, []);

  const poll = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || pollInflight.current) return;
    pollInflight.current = true;
    try {
      const result = await getRoom({ data: { roomCode: s.roomCode, token: s.token } });
      pollFails.current = 0;
      apply(result);
    } catch {
      pollFails.current += 1;
      if (pollFails.current >= 3) setError(COPY.network);
    } finally {
      pollInflight.current = false;
    }
  }, [apply]);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer = 0;
    const loop = async () => {
      await poll();
      if (stopped) return;
      timer = window.setTimeout(loop, pollDelay(prevViewRef.current?.phase));
    };
    void loop();
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session?.token, session?.roomCode, poll]);

  const run = useCallback(
    async (fn: () => Promise<ActionResult>) => {
      setBusy(true);
      try {
        const result = await fn();
        apply(result);
        return result;
      } catch {
        setError(COPY.network);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  const flushNeedle = useCallback(async () => {
    const s = sessionRef.current;
    const pos = pendingNeedle.current;
    pendingNeedle.current = null;
    if (needleTimer.current) {
      window.clearTimeout(needleTimer.current);
      needleTimer.current = 0;
    }
    if (!s || pos == null) return;
    try {
      const result = await moveNeedle({
        data: { roomCode: s.roomCode, token: s.token, position: pos },
      });
      apply(result);
    } catch {
      /* keep local needle; next poll repairs */
    }
  }, [apply]);

  const s = session;

  return {
    view,
    error,
    fatal,
    busy,
    setError,
    poll,
    start: () =>
      s && run(() => startGame({ data: { roomCode: s.roomCode, token: s.token } })),
    profile: (nickname: string, characterId: CharacterId) =>
      s &&
      run(() =>
        updateProfile({
          data: { roomCode: s.roomCode, token: s.token, nickname, characterId },
        }),
      ),
    setDecks: (deckIds: DeckId[]) => {
      if (!s || deckIds.length < 1) return;
      setView((cur) => (cur ? { ...cur, deckIds } : cur));
      return updateDecks({
        data: { roomCode: s.roomCode, token: s.token, deckIds },
      })
        .then(apply)
        .catch(() => {
          setError(COPY.network);
        });
    },
    clue: (text: string) =>
      s && run(() => submitClue({ data: { roomCode: s.roomCode, token: s.token, clue: text } })),
    needle: (position: number) => {
      dirtyNeedle.current = position;
      pendingNeedle.current = position;
      if (needleTimer.current) return;
      needleTimer.current = window.setTimeout(() => {
        needleTimer.current = 0;
        void flushNeedle();
      }, 800);
    },
    ready: async () => {
      const pos = pendingNeedle.current ?? dirtyNeedle.current ?? undefined;
      pendingNeedle.current = null;
      if (needleTimer.current) {
        window.clearTimeout(needleTimer.current);
        needleTimer.current = 0;
      }
      setView((cur) => (cur ? { ...cur, yourReady: true } : cur));
      return (
        s &&
        run(() =>
          markReady({
            data: { roomCode: s.roomCode, token: s.token, position: pos },
          }),
        )
      );
    },
    continueDuo: () =>
      s && run(() => continueDuo({ data: { roomCode: s.roomCode, token: s.token } })),
    settleDuo: () =>
      s && run(() => settleDuo({ data: { roomCode: s.roomCode, token: s.token } })),
    playAgain: () =>
      s && run(() => playAgain({ data: { roomCode: s.roomCode, token: s.token } })),
    advance: () =>
      s && run(() => advanceReveal({ data: { roomCode: s.roomCode, token: s.token } })),
    react: (reaction: string) => {
      if (!s) return;
      setView((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          you: { ...cur.you, canReact: false, yourReaction: reaction },
          players: cur.players.map((p) =>
            p.playerId === cur.you.playerId ? { ...p, reaction } : p,
          ),
        };
      });
      return setReaction({
        data: { roomCode: s.roomCode, token: s.token, reaction },
      })
        .then(apply)
        .catch(() => {
          setError(COPY.network);
        });
    },
    leave: () =>
      s && run(() => leaveRoom({ data: { roomCode: s.roomCode, token: s.token } })),
    attachSession: (next: Session) => {
      saveSession(next);
    },
  };
}
