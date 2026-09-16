import { REACTIONS } from "@/lib/game/reactions";
import { cn } from "@/lib/utils";

const EMOJI = new Set(["😂", "😒", "🤬", "🤯"]);

export function ReactionBar({
  onPick,
  disabled = false,
}: {
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {REACTIONS.map((item) => {
        const emoji = EMOJI.has(item);
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item)}
            className={cn(
              "flex h-9 items-center justify-center rounded-full bg-surface text-sm text-ink",
              "shadow-[0_0_0_1px_rgba(42,24,16,0.08)] touch-manipulation active:scale-[0.96]",
              emoji ? "min-w-9 px-0 text-base" : "px-2.5",
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function ReactionChip({ value }: { value: string }) {
  const emoji = EMOJI.has(value);
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink",
        "shadow-[0_0_0_1px_rgba(42,24,16,0.08)]",
        emoji ? "min-w-7 px-0 text-sm" : "px-2 text-[11px]",
      )}
    >
      {value}
    </span>
  );
}