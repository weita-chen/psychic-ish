import { CharacterAvatar } from "./character-avatar";
import { COPY } from "@/lib/game/copy";
import type { PublicPlayer } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function PlayerRoster({
  players,
  showReady = false,
  showScores = false,
  titles = null,
}: {
  players: PublicPlayer[];
  showReady?: boolean;
  showScores?: boolean;
  titles?: { masterId: string; fraudId: string } | null;
}) {
  const visible = players.filter((p) => p.status !== "left");
  return (
    <ul className="flex flex-col gap-1.5">
      {visible.map((p) => {
        const title =
          titles && p.playerId === titles.masterId
            ? COPY.master
            : titles && p.playerId === titles.fraudId
              ? COPY.lastPlace
              : null;
        return (
          <li
            key={p.playerId}
            data-player={p.playerId}
            data-turn-score={p.turnScore ?? ""}
            data-total-score={p.totalScore}
            data-devotee={p.isDevotee ? "1" : "0"}
            className={cn(
              "flex items-center gap-3 rounded-[14px] bg-surface px-3 py-2 shadow-[0_0_0_1px_rgba(42,24,16,0.06)]",
              p.status === "disconnected" && "opacity-60",
            )}
          >
            <CharacterAvatar id={p.characterId} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-ink">
                  {p.nickname}
                  {p.isYou ? `（${COPY.you}）` : ""}
                </span>
                {p.isHost && (
                  <span className="shrink-0 text-[10px] tracking-wide text-muted">{COPY.host}</span>
                )}
                {p.isDevotee && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {COPY.devotee}
                  </span>
                )}
                {title && (
                  <span className="shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-primary-fg">
                    {title}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted">
                {p.status === "disconnected"
                  ? COPY.disconnected
                  : p.connected
                    ? null
                    : COPY.disconnected}
              </p>
            </div>
            {showReady && !p.isDevotee && (
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  p.ready ? "bg-jade text-primary-fg" : "bg-surface-2 text-faint",
                )}
                aria-label={p.ready ? "已完成" : "尚未完成"}
              >
                <Check className="size-3.5" strokeWidth={2.4} />
              </span>
            )}
            {showScores && (
              <div className="text-right">
                {p.turnScore != null && (
                  <div className="text-xs text-muted tabular-nums">+{p.turnScore}</div>
                )}
                <div className="font-display text-lg font-semibold tabular-nums leading-none">
                  {p.totalScore}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
