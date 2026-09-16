export const REACTIONS = [
  "出得好",
  "好好笑",
  "三小啦",
  "好哦",
  "最好是齁",
  "太無聊",
  "你認真？",
  "我是小天才",
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
