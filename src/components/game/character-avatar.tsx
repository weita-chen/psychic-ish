import { CHARACTERS, CHARACTER_BY_ID } from "@/lib/game/characters";
import type { CharacterId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function CharacterAvatar({
  id,
  size = "md",
  className,
}: {
  id: CharacterId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const def = CHARACTER_BY_ID[id] ?? CHARACTERS[0]!;
  const dim = size === "sm" ? "size-9 text-sm" : size === "lg" ? "size-16 text-2xl" : "size-12 text-lg";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-display font-semibold leading-none",
        dim,
        className,
      )}
      style={{ backgroundColor: def.fill, color: def.ink }}
      aria-hidden
    >
      {def.initials}
    </span>
  );
}

export function CharacterPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: CharacterId) => void;
}) {
  const selected = CHARACTER_BY_ID[value as CharacterId] ?? CHARACTERS[0]!;
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{selected.displayNameZh}</p>
      <div className="grid grid-cols-4 gap-2">
        {CHARACTERS.map((c) => {
          const isOn = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-label={c.displayNameZh}
              aria-pressed={isOn}
              className={cn(
                "flex min-h-12 items-center justify-center rounded-[14px] p-2 transition-[box-shadow,background-color] duration-150",
                isOn
                  ? "bg-surface shadow-[0_0_0_2px_var(--color-primary)]"
                  : "bg-surface-2/70 hover:bg-surface",
              )}
            >
              <CharacterAvatar id={c.id} size="md" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
