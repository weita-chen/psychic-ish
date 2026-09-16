import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CharacterPicker } from "./character-avatar";
import { DeckPicker } from "./deck-picker";
import { PlayerRoster } from "./player-roster";
import { RulesButton } from "./rules-dialog";
import { Spectrum } from "./spectrum";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { COPY } from "@/lib/game/copy";
import { isCharacterId } from "@/lib/game/characters";
import type { CharacterId, ClientView, TurnRecap } from "@/lib/game/types";
import { MAX_CLUE_LEN } from "@/lib/game/types";
import { useRoom } from "@/lib/game/use-room";
import { loadSession, type Session } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

export function RoomView({
  code,
  initialSession,
  onNeedJoin,
}: {
  code: string;
  initialSession: Session | null;
  onNeedJoin: boolean;
}) {
  const [session, setSession] = useState<Session | null>(initialSession ?? loadSession(code));
  const room = useRoom(session);

  useEffect(() => {
    if (room.view?.nudgeAt) {
      const last = Number(sessionStorage.getItem("psychicish.nudge") || 0);
      if (room.view.nudgeAt > last) {
        sessionStorage.setItem("psychicish.nudge", String(room.view.nudgeAt));
        if (room.view.you.isChanneler && !room.view.yourReady) {
          toast(COPY.nudge);
        }
      }
    }
  }, [room.view?.nudgeAt, room.view?.you.isChanneler, room.view?.yourReady]);

  if (onNeedJoin && !session) {
    return <JoinGate code={code} onJoined={setSession} />;
  }

  if (room.fatal) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-display text-2xl">{room.fatal}</p>
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            {COPY.home}
          </Link>
        </div>
      </Shell>
    );
  }

  if (!room.view) {
    return (
      <Shell>
        <p className="m-auto text-muted">{COPY.connecting}</p>
      </Shell>
    );
  }

  const view = room.view;

  return (
    <Shell
      code={view.roomCode}
      role={
        view.phase === "lobby" || view.phase === "roundResults" || view.phase === "finalResults"
          ? null
          : view.you.isDevotee
            ? COPY.youAreDevotee
            : view.you.isChanneler
              ? COPY.youAreChanneler
              : null
      }
      phase={view.phase}
      dataRole={
        view.you.isDevotee ? "devotee" : view.you.isChanneler ? "channeler" : "none"
      }
      turnNumber={view.turnNumber}
      mode={view.mode}
    >
      {room.error && (
        <p className="rounded-[12px] bg-primary/10 px-3 py-2 text-sm text-primary">{room.error}</p>
      )}
      {view.phase === "lobby" && <Lobby view={view} room={room} />}
      {view.phase === "awaitClue" && <AwaitClue view={view} room={room} />}
      {view.phase === "guessing" && <Guessing view={view} room={room} />}
      {(view.phase === "revealCountdown" ||
        view.phase === "reveal" ||
        view.phase === "interstitial") && <Reveal view={view} room={room} />}
      {view.phase === "roundResults" && <RoundResults view={view} room={room} />}
      {view.phase === "finalResults" && <FinalResults view={view} />}
      {view.phase === "closed" && (
        <div className="m-auto text-center">
          <p className="font-display text-2xl">{view.closedReason ?? COPY.roomClosed}</p>
          <Link to="/" className="mt-4 inline-block text-primary">
            {COPY.home}
          </Link>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  code,
  role,
  phase,
  dataRole,
  turnNumber,
  mode,
}: {
  children: React.ReactNode;
  code?: string;
  role?: string | null;
  phase?: string;
  dataRole?: string;
  turnNumber?: number;
  mode?: string | null;
}) {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
      data-phase={phase}
      data-role={dataRole}
      data-turn={turnNumber}
      data-mode={mode ?? ""}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link to="/" className="font-display text-sm font-semibold tracking-wide text-ink">
          {COPY.appName}
        </Link>
        <div className="flex items-center gap-1">
          {code && <CodeChip code={code} />}
          <RulesButton />
        </div>
      </header>
      {role && (
        <div className="mb-3 rounded-[14px] bg-ink px-3 py-2 text-center text-sm font-medium text-primary-fg">
          {role}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          toast(code);
        }
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 font-mono text-sm tabular-nums shadow-[0_0_0_1px_rgba(42,24,16,0.08)]"
      aria-label={COPY.copyCode}
    >
      {code}
      {copied ? <Check className="size-3.5 text-jade" /> : <Copy className="size-3.5 text-muted" />}
    </button>
  );
}

function JoinGate({ code, onJoined }: { code: string; onJoined: (s: Session) => void }) {
  const [nickname, setNickname] = useState("");
  const [characterId, setCharacterId] = useState<CharacterId>("few_screws_loose");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Shell code={code}>
      <h1 className="font-display text-2xl font-semibold">{COPY.joinRoom}</h1>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">暱稱</span>
        <Input
          maxLength={12}
          placeholder={COPY.nicknamePlaceholder}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </label>
      <CharacterPicker value={characterId} onChange={setCharacterId} />
      {error && <p className="text-sm text-primary">{error}</p>}
      <Button
        size="lg"
        className="mt-auto w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { joinRoom } = await import("@/lib/game/actions");
          const { saveSession } = await import("@/lib/session");
          const result = await joinRoom({
            data: { roomCode: code, nickname, characterId },
          });
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.token && result.playerId) {
            const next = {
              token: result.token,
              playerId: result.playerId,
              roomCode: result.view.roomCode,
            };
            saveSession(next);
            onJoined(next);
          }
        }}
      >
        {COPY.joinRoom}
      </Button>
    </Shell>
  );
}

type RoomApi = ReturnType<typeof useRoom>;

function Lobby({ view, room }: { view: ClientView; room: RoomApi }) {
  const me = view.players.find((p) => p.isYou);
  const [nickname, setNickname] = useState(me?.nickname ?? "");
  const [characterId, setCharacterId] = useState<CharacterId>(
    me && isCharacterId(me.characterId) ? me.characterId : "few_screws_loose",
  );

  return (
    <>
      <div className="rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_rgba(42,24,16,0.06)]">
        <p className="text-center text-xs tracking-[0.2em] text-muted">壇號</p>
        <p className="mt-1 text-center font-display text-5xl font-semibold tabular-nums tracking-[0.2em]">
          {view.roomCode}
        </p>
        <p className="mt-3 text-center text-sm text-muted">{COPY.shareHint}</p>
      </div>

      <PlayerRoster players={view.players} showScores={false} />

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">暱稱</span>
          <Input
            maxLength={12}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => void room.profile(nickname, characterId)}
          />
        </label>
        <CharacterPicker
          value={characterId}
          onChange={(id) => {
            setCharacterId(id);
            void room.profile(nickname, id);
          }}
        />
        <div>
          <span className="mb-1.5 block text-sm font-medium">{COPY.deckPicker}</span>
          <p className="mb-2 text-xs text-muted">{COPY.deckHint}</p>
          <DeckPicker
            value={view.deckIds ?? []}
            disabled={!view.you.isHost}
            onChange={view.you.isHost ? (ids) => void room.setDecks(ids) : undefined}
          />
        </div>
      </div>

      {view.you.isHost ? (
        <div className="mt-auto space-y-2 pb-16">
          <Button
            size="lg"
            className="w-full"
            disabled={!view.canStart || room.busy}
            onClick={() => void room.start()}
          >
            {COPY.startGame}
          </Button>
          {view.activeCount < 2 && (
            <p className="text-center text-sm text-muted">{COPY.waitingForPlayers}</p>
          )}
        </div>
      ) : (
        <p className="mt-auto pb-16 text-center text-sm text-muted">{COPY.hostWait}</p>
      )}
    </>
  );
}

function AwaitClue({ view, room }: { view: ClientView; room: RoomApi }) {
  const [clue, setClue] = useState("");
  return (
    <>
      {view.card && (
        <Spectrum
          leftLabel={view.card.leftZh}
          rightLabel={view.card.rightZh}
          targetCenter={view.targetCenter}
          showBands={view.showBands}
          interactive={false}
        />
      )}
      {view.you.isDevotee ? (
        <>
          <p className="text-sm text-muted">{COPY.devoteeHint}</p>
          <Textarea
            maxLength={MAX_CLUE_LEN}
            placeholder={COPY.cluePlaceholder}
            value={clue}
            onChange={(e) => setClue(e.target.value.slice(0, MAX_CLUE_LEN))}
          />
          <p className="text-right text-xs tabular-nums text-faint">
            {clue.trim().length}/{MAX_CLUE_LEN}
          </p>
          <Button size="lg" className="w-full" disabled={room.busy} onClick={() => void room.clue(clue)}>
            {COPY.submitClue}
          </Button>
        </>
      ) : (
        <div className="rounded-[16px] bg-surface p-4 text-center text-sm text-muted">
          {COPY.waitingClue}
        </div>
      )}
      <PlayerRoster players={view.players} />
    </>
  );
}

function Guessing({ view, room }: { view: ClientView; room: RoomApi }) {
  return (
    <>
      <ClueBanner clue={view.clue} />
      {view.card && (
        <Spectrum
          leftLabel={view.card.leftZh}
          rightLabel={view.card.rightZh}
          needle={view.yourNeedle}
          onNeedleChange={(t) => void room.needle(t)}
          interactive={view.you.isChanneler && !view.yourReady}
          locked={view.yourReady || !view.you.isChanneler}
          targetCenter={view.you.isDevotee ? view.targetCenter : null}
          showBands={view.you.isDevotee}
        />
      )}
      {view.you.isChanneler && (
        <>
          <p className="text-sm text-muted">
            {view.yourReady ? COPY.lockedNeedle : COPY.channelerGuessHint}
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={view.yourReady || room.busy}
            onClick={() => void room.ready()}
          >
            {COPY.ready}
          </Button>
        </>
      )}
      {view.you.isDevotee && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{COPY.waitingGuess}</p>
          <Button variant="ghost" size="sm" onClick={() => void room.nudge()}>
            {COPY.nudge}
          </Button>
        </div>
      )}
      <PlayerRoster players={view.players} showReady showScores />
    </>
  );
}

function Reveal({ view, room }: { view: ClientView; room: RoomApi }) {
  const remaining = useCountdown(view.revealCountdownEndsAt, view.serverNow);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (view.phase === "reveal") {
      setFlash(true);
      const id = window.setTimeout(() => setFlash(false), 1400);
      return () => window.clearTimeout(id);
    }
    setFlash(false);
  }, [view.phase, view.turnNumber]);

  const countLabel =
    view.phase === "revealCountdown" && remaining !== null && remaining > 0
      ? String(remaining)
      : null;
  const flavourBanner =
    view.phase === "interstitial"
      ? COPY.nextDevotee
      : view.phase === "reveal" && flash
        ? COPY.revealFlavour
        : null;

  return (
    <>
      <ClueBanner clue={view.clue} />
      {flavourBanner && (
        <p className="text-center font-display text-lg font-semibold tracking-wide text-primary">
          {flavourBanner}
        </p>
      )}
      {view.card && (
        <Spectrum
          leftLabel={view.card.leftZh}
          rightLabel={view.card.rightZh}
          targetCenter={view.targetCenter}
          showBands
          needles={view.phase === "revealCountdown" ? null : view.needles}
          averagePosition={view.phase === "revealCountdown" ? null : view.averagePosition}
          countdownLabel={countLabel}
        />
      )}
      {view.phase === "reveal" && view.mode === "duo" && (
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => void room.settleDuo()}>
            {COPY.settleDuo}
          </Button>
          <Button size="lg" onClick={() => void room.continueDuo()}>
            {COPY.continueDuo}
          </Button>
        </div>
      )}
      {view.phase === "reveal" && view.cycleChoice && (
        <div className="mt-auto space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={!view.you.isHost || room.busy}
              onClick={() => void room.settleDuo()}
            >
              {COPY.settleDuo}
            </Button>
            <Button
              size="lg"
              disabled={!view.you.isHost || room.busy}
              onClick={() => void room.continueDuo()}
            >
              {COPY.continueDuo}
            </Button>
          </div>
          <p className="text-center text-sm text-muted">{COPY.hostChoose}</p>
        </div>
      )}
      {view.phase === "reveal" && view.mode === "party" && !view.cycleChoice && (
        <Button className="mt-auto w-full" onClick={() => void room.advance()}>
          {COPY.skipWait}
        </Button>
      )}
      {view.phase === "interstitial" && (
        <Button variant="secondary" className="mt-auto w-full" onClick={() => void room.advance()}>
          {COPY.skipWait}
        </Button>
      )}
      <PlayerRoster players={view.players} showScores />
    </>
  );
}

function RoundResults({ view, room }: { view: ClientView; room: RoomApi }) {
  const navigate = useNavigate();
  const [showRecap, setShowRecap] = useState(false);
  const titles = view.titles;
  return (
    <>
      <h2 className="text-center font-display text-2xl font-semibold">{COPY.roundResults}</h2>
      <PlayerRoster
        players={view.players}
        showScores
        showDevotee={false}
        showTurnScore={false}
        titles={titles}
      />
      {view.roundHistory.length > 0 && (
        <div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowRecap((v) => !v)}
            aria-expanded={showRecap}
          >
            {showRecap ? COPY.hideRoundRecap : COPY.showRoundRecap}
            <ChevronDown className={cn("size-4 transition-transform", showRecap && "rotate-180")} />
          </Button>
          {showRecap && (
            <div className="mt-3 flex flex-col gap-4">
              {view.roundHistory.map((turn) => (
                <TurnRecapCard key={turn.turnNumber} turn={turn} />
              ))}
            </div>
          )}
        </div>
      )}
      {titles && (
        <ul className="space-y-1.5 rounded-[16px] bg-surface px-4 py-3 text-sm text-muted">
          <li>
            <strong className="text-ink">{COPY.master}</strong>
            {" · "}
            {COPY.titleMasterHint}
          </li>
          <li>
            <strong className="text-ink">{COPY.lastPlace}</strong>
            {" · "}
            {COPY.titleFraudHint}
          </li>
          {view.mode === "party" && (
            <li>
              <strong className="text-ink">{COPY.bestDevotee}</strong>
              {" · "}
              {COPY.titleBestDevoteeHint}
            </li>
          )}
        </ul>
      )}
      {view.canPlayAgain ? (
        <Button size="lg" className="mt-auto w-full" onClick={() => void room.playAgain()}>
          {COPY.playAgain}
        </Button>
      ) : (
        <p className="mt-auto text-center text-sm text-muted">
          {view.hostPresent ? "等待壇主再問一輪。" : COPY.hostGoneNoReplay}
        </p>
      )}
      <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/" })}>
        {COPY.home}
      </Button>
    </>
  );
}

function TurnRecapCard({ turn }: { turn: TurnRecap }) {
  return (
    <div className="rounded-[16px] bg-surface p-3 shadow-[0_0_0_1px_rgba(42,24,16,0.06)]">
      <p className="text-[11px] tracking-[0.18em] text-muted">
        第 {turn.turnNumber} 問 · 信眾 {turn.devoteeNickname}
      </p>
      <p className="mt-1 font-display text-base font-semibold leading-snug">{turn.clue}</p>
      <div className="mt-3">
        <Spectrum
          leftLabel={turn.leftZh}
          rightLabel={turn.rightZh}
          interactive={false}
          targetCenter={turn.targetCenter}
          showBands
          needles={turn.guesses}
        />
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {turn.guesses.map((g) => (
          <li key={g.playerId} className="flex justify-between tabular-nums">
            <span className="truncate text-ink">{g.nickname}</span>
            <span>+{g.score}</span>
          </li>
        ))}
        <li className="flex justify-between tabular-nums">
          <span>信眾 {turn.devoteeNickname}</span>
          <span>+{turn.devoteeScore}</span>
        </li>
      </ul>
    </div>
  );
}

function FinalResults({ view }: { view: ClientView }) {
  const ranked = [...view.players].sort((a, b) => b.totalScore - a.totalScore);
  const lead = ranked[0];
  const second = ranked[1];
  const line =
    lead && second && lead.totalScore === second.totalScore
      ? "勢均力敵，下次再問。"
      : lead
        ? `這次比較準的是 ${lead.nickname}。`
        : "";
  return (
    <>
      <h2 className="text-center font-display text-2xl font-semibold">結算</h2>
      <p className="text-center text-sm text-muted">{line}</p>
      <PlayerRoster players={view.players} showScores />
      <Link
        to="/"
        className="mt-auto inline-flex h-12 items-center justify-center rounded-[12px] bg-primary text-primary-fg"
      >
        {COPY.home}
      </Link>
    </>
  );
}

function ClueBanner({ clue }: { clue: string | null }) {
  if (!clue) return null;
  return (
    <div className="rounded-[16px] bg-surface px-4 py-3 text-center">
      <p className="text-[11px] tracking-[0.18em] text-muted">問事</p>
      <p className="mt-1 font-display text-xl font-semibold leading-snug">{clue}</p>
    </div>
  );
}

function useCountdown(endsAt: number | null, serverNow: number): number | null {
  const origin = useRef<{ ends: number; offset: number } | null>(null);
  if (endsAt != null && origin.current?.ends !== endsAt) {
    origin.current = { ends: endsAt, offset: Date.now() - serverNow };
  }
  if (endsAt == null) origin.current = null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (endsAt == null || !origin.current) return null;
  return Math.max(0, Math.ceil((endsAt - (now - origin.current.offset)) / 1000));
}
