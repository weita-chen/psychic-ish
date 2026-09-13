export type CharacterId =
  | "girl"
  | "boy"
  | "young_master"
  | "young_madam"
  | "young_wife"
  | "cut_it_out"
  | "few_screws_loose"
  | "major";

export type Phase =
  | "lobby"
  | "awaitClue"
  | "guessing"
  | "revealCountdown"
  | "reveal"
  | "interstitial"
  | "roundResults"
  | "finalResults"
  | "closed";

export type GameMode = "duo" | "party";

export type PlayerStatus = "active" | "disconnected" | "left";

export type SpectrumCard = {
  id: string;
  leftZh: string;
  rightZh: string;
  leftEn: string;
  rightEn: string;
  tags: string[];
  nsfw: boolean;
  enabled: boolean;
  weight: number;
};

export type Player = {
  playerId: string;
  nickname: string;
  characterId: CharacterId;
  connected: boolean;
  lastSeen: number;
  status: PlayerStatus;
  hasBeenDevoteeThisRound: boolean;
  totalScore: number;
  joinedAt: number;
  colorIndex: number;
};

export type CurrentTurn = {
  devoteeId: string;
  cardId: string;
  targetCenter: number;
  clue: string | null;
  needlePositions: Record<string, number>;
  readyPlayerIds: string[];
  revealCountdownEndsAt: number | null;
  revealed: boolean;
  turnScores: Record<string, number>;
  averagePosition: number | null;
  lastCardId: string | null;
};

export type RoomState = {
  roomCode: string;
  hostPlayerId: string;
  players: Player[];
  phase: Phase;
  mode: GameMode | null;
  roundNumber: number;
  turnNumber: number;
  remainingCardIds: string[];
  lastDrawnCardId: string | null;
  currentTurn: CurrentTurn | null;
  lastActivityAt: number;
  interstitialEndsAt: number | null;
  closedReason: string | null;
  nudge: { fromId: string; at: number } | null;
  createdAt: number;
};

export type PublicPlayer = {
  playerId: string;
  nickname: string;
  characterId: CharacterId;
  connected: boolean;
  status: PlayerStatus;
  totalScore: number;
  ready: boolean;
  isDevotee: boolean;
  isHost: boolean;
  isYou: boolean;
  hasBeenDevoteeThisRound: boolean;
  colorIndex: number;
  turnScore: number | null;
};

export type PublicCard = {
  id: string;
  leftZh: string;
  rightZh: string;
};

export type RevealedNeedle = {
  playerId: string;
  nickname: string;
  characterId: CharacterId;
  colorIndex: number;
  position: number;
  score: number;
};

export type ClientView = {
  roomCode: string;
  you: {
    playerId: string;
    isHost: boolean;
    isDevotee: boolean;
    isChanneler: boolean;
  };
  hostPlayerId: string;
  hostPresent: boolean;
  players: PublicPlayer[];
  activeCount: number;
  phase: Phase;
  mode: GameMode | null;
  roundNumber: number;
  turnNumber: number;
  card: PublicCard | null;
  clue: string | null;
  targetCenter: number | null;
  showBands: boolean;
  yourNeedle: number | null;
  yourReady: boolean;
  needles: RevealedNeedle[] | null;
  averagePosition: number | null;
  revealCountdownEndsAt: number | null;
  interstitialEndsAt: number | null;
  serverNow: number;
  canStart: boolean;
  canPlayAgain: boolean;
  canContinueDuo: boolean;
  canSettleDuo: boolean;
  titles: { masterId: string; fraudId: string } | null;
  closedReason: string | null;
  nudgeAt: number | null;
};

export type ActionOk = {
  ok: true;
  view: ClientView;
  token?: string;
  playerId?: string;
};

export type ActionErr = {
  ok: false;
  code: string;
  error: string;
};

export type ActionResult = ActionOk | ActionErr;

export const DISCONNECT_GRACE_MS = 60_000;
export const HEARTBEAT_STALE_MS = 15_000;
export const ROOM_EXPIRE_MS = 10 * 60_000;
export const REVEAL_COUNTDOWN_MS = 3_000;
export const INTERSTITIAL_MS = 2_400;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const MAX_CLUE_LEN = 40;
export const MAX_NICKNAME_LEN = 12;
export const DEFAULT_NEEDLE = 0.5;
export const TARGET_MIN = 0.2;
export const TARGET_MAX = 0.8;
