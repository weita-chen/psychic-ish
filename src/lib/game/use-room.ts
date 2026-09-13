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
  sendNudge,
  settleDuo,
  startGame,
  submitClue,
  updateProfile,
} from "./actions";
import type { ActionResult, CharacterId, ClientView } from "./types";
import { COPY } from "./copy";
import { clearSession, saveSession, type Session } from "@/lib/session";

declare global {
  interface Window {
    __psi?: ClientView | null;
  }
}

export function useRoom(session: Session | null) {
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const prevViewRef = useRef<ClientView | null>(null);
  const needleTimer = useRef(0);
  const pendingNeedle = useRef<number | null>(null);

  const apply = useCallback((result: ActionResult) => {
    if (result.ok) {
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
    if (!s) return;
    try {
      const result = await getRoom({ data: { roomCode: s.roomCode, token: s.token } });
      apply(result);
    } catch {
      setError(COPY.network);
    }
  }, [apply]);

  useEffect(() => {
    if (!session) return;
    void poll();
    // Keep heartbeats even when the tab is hidden so switching to Discord /
    // a phone call does not look like a disconnect.
    const id = window.setInterval(() => {
      void poll();
    }, 800);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
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
    clue: (text: string) =>
      s && run(() => submitClue({ data: { roomCode: s.roomCode, token: s.token, clue: text } })),
    needle: (position: number) => {
      pendingNeedle.current = position;
      if (needleTimer.current) return;
      needleTimer.current = window.setTimeout(() => {
        needleTimer.current = 0;
        void flushNeedle();
      }, 90);
    },
    ready: async () => {
      await flushNeedle();
      return s && run(() => markReady({ data: { roomCode: s.roomCode, token: s.token } }));
    },
    continueDuo: () =>
      s && run(() => continueDuo({ data: { roomCode: s.roomCode, token: s.token } })),
    settleDuo: () =>
      s && run(() => settleDuo({ data: { roomCode: s.roomCode, token: s.token } })),
    playAgain: () =>
      s && run(() => playAgain({ data: { roomCode: s.roomCode, token: s.token } })),
    advance: () =>
      s && run(() => advanceReveal({ data: { roomCode: s.roomCode, token: s.token } })),
    nudge: () =>
      s && run(() => sendNudge({ data: { roomCode: s.roomCode, token: s.token } })),
    leave: () =>
      s && run(() => leaveRoom({ data: { roomCode: s.roomCode, token: s.token } })),
    attachSession: (next: Session) => {
      saveSession(next);
    },
  };
}
