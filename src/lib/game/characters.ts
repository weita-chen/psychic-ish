import type { CharacterId } from "./types";

export type CharacterDef = {
  id: CharacterId;
  displayNameZh: string;
  blurb: string;
  initials: string;
  /** Avatar fill token — distinct per seat, not a brand rainbow. */
  fill: string;
  ink: string;
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: "girl",
    displayNameZh: "通靈少女",
    blurb: "看起來很靈，其實也是猜的。",
    initials: "女",
    fill: "#8c3a3a",
    ink: "#fff8ee",
  },
  {
    id: "boy",
    displayNameZh: "通靈少年",
    blurb: "香還沒點就先出提示。",
    initials: "少",
    fill: "#3d4a3c",
    ink: "#fff8ee",
  },
  {
    id: "young_wife",
    displayNameZh: "通靈少婦",
    blurb: "家務練出來的人生光譜。",
    initials: "婦",
    fill: "#4a3b2a",
    ink: "#fff8ee",
  },
  {
    id: "young_master",
    displayNameZh: "通靈少爺",
    blurb: "架子很大，準度另說。",
    initials: "爺",
    fill: "#2c1810",
    ink: "#f4ebe0",
  },
  {
    id: "major",
    displayNameZh: "通靈少校",
    blurb: "把問事當成操課。",
    initials: "校",
    fill: "#24352e",
    ink: "#fff8ee",
  },
  {
    id: "young_madam",
    displayNameZh: "通靈少奶奶",
    blurb: "氣場全開，指針隨便放。",
    initials: "奶",
    fill: "#6b3a2a",
    ink: "#fff8ee",
  },
  {
    id: "cut_it_out",
    displayNameZh: "通靈少來了",
    blurb: "專職吐槽，偶爾超準。",
    initials: "來",
    fill: "#5c2e24",
    ink: "#fff8ee",
  },
  {
    id: "few_screws_loose",
    displayNameZh: "通靈少根筋",
    blurb: "本尊。問事很認真，腦筋有點少。",
    initials: "筋",
    fill: "#b13222",
    ink: "#fff8ee",
  },
];

export const CHARACTER_BY_ID: Record<CharacterId, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
) as Record<CharacterId, CharacterDef>;

export function isCharacterId(value: string): value is CharacterId {
  return value in CHARACTER_BY_ID;
}

export const NEEDLE_INK = [
  "#b13222",
  "#2c1810",
  "#1f6b5a",
  "#6b3a2a",
  "#3d4a3c",
  "#4a3b2a",
  "#8c3a3a",
  "#24352e",
] as const;
