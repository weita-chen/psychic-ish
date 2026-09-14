import { DECKS, type DeckId } from "@/lib/game/decks";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function DeckPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly string[];
  onChange?: (ids: DeckId[]) => void;
  disabled?: boolean;
}) {
  const selected = value.filter((id): id is DeckId => DECKS.some((d) => d.id === id));
  const toggle = (id: DeckId) => {
    if (disabled || !onChange) return;
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {DECKS.map((d) => {
        const on = selected.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => toggle(d.id)}
            aria-disabled={disabled}
            aria-pressed={on}
            className={cn(
              "flex h-12 items-center justify-between rounded-[14px] bg-surface px-4 text-left text-sm shadow-[0_0_0_1px_rgba(42,24,16,0.08)]",
              on && "shadow-[0_0_0_2px_rgba(177,50,34,0.55)]",
              disabled && "pointer-events-none cursor-default",
            )}
          >
            <span className="font-medium">{d.label}</span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                on ? "bg-primary text-primary-fg" : "bg-surface-2 text-faint",
              )}
            >
              <Check className="size-3.5" strokeWidth={2.4} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
