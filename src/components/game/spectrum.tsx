import { useCallback, useEffect, useId, useRef, useState } from "react";
import { NEEDLE_INK } from "@/lib/game/characters";
import { SCORE_BANDS } from "@/lib/game/scoring";
import type { RevealedNeedle } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function tToPct(t: number): string {
  return `${Math.min(100, Math.max(0, t * 100))}%`;
}

function clientToT(el: HTMLElement, clientX: number): number {
  const r = el.getBoundingClientRect();
  if (r.width <= 0) return 0.5;
  return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
}

export function Spectrum({
  leftLabel,
  rightLabel,
  needle,
  onNeedleChange,
  interactive = false,
  locked = false,
  targetCenter = null,
  showBands = false,
  needles = null,
  averagePosition = null,
  countdownLabel = null,
  flavour = null,
}: {
  leftLabel: string;
  rightLabel: string;
  needle?: number | null;
  onNeedleChange?: (t: number) => void;
  interactive?: boolean;
  locked?: boolean;
  targetCenter?: number | null;
  showBands?: boolean;
  needles?: RevealedNeedle[] | null;
  averagePosition?: number | null;
  countdownLabel?: string | null;
  flavour?: string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [local, setLocal] = useState(needle ?? 0.5);
  const labelId = useId();

  useEffect(() => {
    if (!dragging.current && needle != null) setLocal(needle);
  }, [needle]);

  const commit = useCallback(
    (t: number) => {
      setLocal(t);
      onNeedleChange?.(t);
    },
    [onNeedleChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || locked) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    commit(clientToT(e.currentTarget, e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !interactive || locked) return;
    commit(clientToT(e.currentTarget, e.clientX));
  };

  const endDrag = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || locked) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      commit(Math.max(0, local - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commit(Math.min(1, local + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(1);
    }
  };

  const canMove = interactive && !locked;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-3 text-sm font-medium">
        <span className="max-w-[46%] text-left leading-snug text-ink">{leftLabel}</span>
        <span className="max-w-[46%] text-right leading-snug text-ink">{rightLabel}</span>
      </div>

      <div
        ref={trackRef}
        id={labelId}
        role={canMove ? "slider" : "img"}
        aria-label="光譜"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(local * 100)}
        tabIndex={canMove ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={cn(
          "relative h-16 w-full touch-none select-none overflow-visible rounded-[18px]",
          "bg-surface-2 shadow-[inset_0_0_0_1px_rgba(42,24,16,0.12),0_8px_24px_-16px_rgba(42,24,16,0.35)]",
          canMove && "cursor-pointer",
        )}
        style={{ touchAction: "none" }}
      >
        {showBands && targetCenter != null && (
          <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[18px]">
            {[...SCORE_BANDS].slice().reverse().map((band) => {
              const left = Math.max(0, targetCenter - band.halfWidth);
              const right = Math.min(1, targetCenter + band.halfWidth);
              return (
                <div
                  key={band.points}
                  data-score-band={band.points}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${left * 100}%`,
                    width: `${(right - left) * 100}%`,
                    backgroundColor: band.color,
                  }}
                />
              );
            })}
            <BandScoreMarks targetCenter={targetCenter} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-ink/15" />

        {targetCenter != null && showBands && (
          <div
            className="pointer-events-none absolute top-0 z-20 h-full w-1 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: tToPct(targetCenter) }}
            aria-hidden
          >
            <span className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-ink" />
          </div>
        )}

        {needles?.map((n) => (
          <NeedleMark
            key={n.playerId}
            t={n.position}
            color={NEEDLE_INK[n.colorIndex % NEEDLE_INK.length]!}
            label={n.nickname}
            score={n.score}
          />
        ))}

        {averagePosition != null && (needles?.length ?? 0) > 1 && (
          <div
            className="pointer-events-none absolute top-1 z-30 -translate-x-1/2"
            style={{ left: tToPct(averagePosition) }}
          >
            <div className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary-fg">
              集體共識
            </div>
            <div className="mx-auto mt-0.5 h-10 w-0.5 bg-ink/70" />
          </div>
        )}

        {canMove || (needle != null && !needles) ? (
          <div
            className="pointer-events-none absolute top-0 z-40 h-full -translate-x-1/2"
            style={{ left: tToPct(local) }}
          >
            <div
              className={cn(
                "absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_2px_8px_rgba(177,50,34,0.4)]",
                locked && "opacity-70",
              )}
            />
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-primary" />
          </div>
        ) : null}

        {countdownLabel && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[18px] bg-ink/45">
            <span className="font-display text-5xl font-semibold text-primary-fg tabular-nums">
              {countdownLabel}
            </span>
          </div>
        )}

        {flavour && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[18px] bg-ink/50">
            <span className="font-display text-2xl font-semibold tracking-wide text-primary-fg">
              {flavour}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BandScoreMarks({ targetCenter }: { targetCenter: number }) {
  const marks: { points: number; t: number }[] = [];
  let inner = 0;
  for (const band of SCORE_BANDS) {
    if (band.points === 3) {
      marks.push({ points: 3, t: targetCenter });
    } else {
      const mid = (inner + band.halfWidth) / 2;
      const right = targetCenter + mid;
      const left = targetCenter - mid;
      const t = right <= 0.93 && right >= 0.07 ? right : left;
      marks.push({ points: band.points, t: Math.min(0.97, Math.max(0.03, t)) });
    }
    inner = band.halfWidth;
  }
  return (
    <>
      {marks.map((m) => (
        <span
          key={m.points}
          className="pointer-events-none absolute bottom-1.5 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-primary-fg"
          style={{
            left: tToPct(m.t),
            textShadow: "0 1px 1px rgba(42,24,16,0.35)",
          }}
        >
          {m.points}
        </span>
      ))}
    </>
  );
}

function NeedleMark({
  t,
  color,
  label,
  score,
}: {
  t: number;
  color: string;
  label: string;
  score: number;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 h-full -translate-x-1/2"
      style={{ left: tToPct(t) }}
    >
      <div
        className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary-fg"
        style={{ backgroundColor: color }}
      >
        {label}
        <span className="ml-1 tabular-nums opacity-80">{score}</span>
      </div>
      <div className="absolute left-1/2 top-6 h-[calc(100%-1.5rem)] w-0.5 -translate-x-1/2" style={{ backgroundColor: color }} />
    </div>
  );
}

