import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CharacterPicker } from "./character-avatar";
import { RulesButton } from "./rules-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRoom, joinRoom } from "@/lib/game/actions";
import { COPY } from "@/lib/game/copy";
import { APP_VERSION } from "@/lib/game/version";
import type { CharacterId } from "@/lib/game/types";
import { loadProfile, saveProfile, saveSession } from "@/lib/session";
import { isCharacterId } from "@/lib/game/characters";

export function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [nickname, setNickname] = useState("");
  const [characterId, setCharacterId] = useState<CharacterId>("few_screws_loose");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = loadProfile();
    setNickname(saved.nickname);
    if (isCharacterId(saved.characterId)) setCharacterId(saved.characterId);
  }, []);

  const persist = () => saveProfile({ nickname, characterId });

  const onCreate = async () => {
    persist();
    setBusy(true);
    setError(null);
    try {
      const result = await createRoom({ data: { nickname, characterId } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.token && result.playerId) {
        saveSession({
          token: result.token,
          playerId: result.playerId,
          roomCode: result.view.roomCode,
        });
      }
      await navigate({ to: "/room/$code", params: { code: result.view.roomCode } });
    } catch {
      setError(COPY.network);
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    persist();
    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom({
        data: { roomCode: code, nickname, characterId },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.token && result.playerId) {
        saveSession({
          token: result.token,
          playerId: result.playerId,
          roomCode: result.view.roomCode,
        });
      }
      await navigate({ to: "/room/$code", params: { code: result.view.roomCode } });
    } catch {
      setError(COPY.network);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <span className="seal rounded-sm px-2 py-1 text-[10px]">
          {COPY.appNameEn} v{APP_VERSION}
        </span>
        <RulesButton />
      </header>

      {mode === "home" ? (
        <div className="stagger-in flex flex-1 flex-col justify-center py-10">
          <Incense />
          <p className="text-center text-xs tracking-[0.28em] text-primary">台灣問事派對</p>
          <h1 className="mt-3 text-center font-display text-[2.6rem] font-semibold leading-[1.15] text-ink sm:text-5xl">
            {COPY.appName}
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-center text-[15px] leading-relaxed text-muted">
            {COPY.tagline}
            <br />
            {COPY.pitch}
          </p>
          <div className="mt-10 flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => setMode("create")}>
              {COPY.createRoom}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={() => setMode("join")}
            >
              {COPY.joinRoom}
            </Button>
          </div>
          <p className="mt-8 text-center text-sm text-muted">{COPY.shareHint}</p>
          <AddToHome />
        </div>
      ) : (
        <form
          className="flex flex-1 flex-col gap-5 pt-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "create") void onCreate();
            else void onJoin();
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("home");
              setError(null);
            }}
            className="self-start text-sm text-muted"
          >
            返回
          </button>
          <div>
            <h2 className="font-display text-3xl font-semibold">
              {mode === "create" ? COPY.createRoom : COPY.joinRoom}
            </h2>
            <p className="mt-1 text-sm text-muted">取個暱稱、選個角色，就可以入席。</p>
          </div>

          {mode === "join" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">壇號</span>
              <Input
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder={COPY.codePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                autoComplete="off"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">暱稱</span>
            <Input
              maxLength={12}
              placeholder={COPY.nicknamePlaceholder}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium">角色</span>
            <CharacterPicker value={characterId} onChange={setCharacterId} />
          </div>

          {error && <p className="text-sm text-primary">{error}</p>}

          <Button type="submit" size="lg" className="mt-auto w-full" disabled={busy}>
            {busy ? "處理中……" : mode === "create" ? COPY.createRoom : COPY.joinRoom}
          </Button>
        </form>
      )}
    </main>
  );
}

function AddToHome() {
  const [hint, setHint] = useState<string | null>(null);
  const promptRef = useRef<{ prompt: () => Promise<void> } | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const standaloneNow =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
    setStandalone(standaloneNow);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { prompt: () => Promise<void> };
      promptRef.current = e;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return null;

  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        className="text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => {
          if (promptRef.current) {
            void promptRef.current.prompt();
            return;
          }
          const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
          setHint(ios ? COPY.addToHomeIos : "用瀏覽器選單加到主畫面。");
        }}
      >
        {COPY.addToHome}
      </button>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Incense() {
  return (
    <div className="mb-6 flex justify-center" aria-hidden>
      <div className="relative h-14 w-8">
        <span className="incense-dot absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-muted" />
        <span className="absolute bottom-0 left-1/2 h-8 w-0.5 -translate-x-1/2 bg-ink/80" />
        <span className="absolute bottom-0 left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-sm bg-primary" />
      </div>
    </div>
  );
}
