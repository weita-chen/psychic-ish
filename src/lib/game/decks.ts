import v1 from "../../data/spectrum-cards.json";
import v2 from "../../data/spectrum-cards-v2.json";
import type { SpectrumCard } from "./types";

export const DECK_IDS = ["a", "b"] as const;
export type DeckId = (typeof DECK_IDS)[number];

type DeckFile = { version?: string; cards: SpectrumCard[] };

export const DECKS: { id: DeckId; label: string; cards: SpectrumCard[] }[] = [
  { id: "a", label: "基本牌ㄅ (40張)", cards: (v1 as DeckFile).cards },
  { id: "b", label: "基本牌ㄆ (44張)", cards: (v2 as DeckFile).cards },
];

export function isDeckId(raw: string): raw is DeckId {
  return (DECK_IDS as readonly string[]).includes(raw);
}

export function sanitizeDeckIds(raw: unknown): DeckId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === "string").filter(isDeckId))];
}

export function parseDeckIds(raw: unknown): DeckId[] {
  const ids = sanitizeDeckIds(raw);
  return ids.length > 0 ? ids : [...DECK_IDS];
}

export function cardsForDecks(deckIds: readonly string[]): SpectrumCard[] {
  const set = new Set(deckIds.filter(isDeckId));
  return DECKS.filter((d) => set.has(d.id))
    .flatMap((d) => d.cards)
    .filter((c) => c.enabled && !c.nsfw);
}

export function enabledCardIdsFor(deckIds: readonly string[]): string[] {
  return cardsForDecks(deckIds).map((c) => c.id);
}

export const ALL_CARDS: SpectrumCard[] = DECKS.flatMap((d) => d.cards);

export function deckLabels(deckIds: readonly string[]): string {
  const set = new Set(deckIds.filter(isDeckId));
  return DECKS.filter((d) => set.has(d.id))
    .map((d) => d.label)
    .join("、");
}
