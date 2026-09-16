export const REACTIONS = [
  "出得好",
  "好好笑",
  "三小啦",
  "好哦",
  "...",
  "😂",
  "😒",
  "🤬",
  "🤯",
] as const;

export type Reaction = (typeof REACTIONS)[number];

export function isReaction(raw: string): raw is Reaction {
  return (REACTIONS as readonly string[]).includes(raw);
}
