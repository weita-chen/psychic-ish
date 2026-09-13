import { TARGET_MAX, TARGET_MIN } from "./types.ts";

/** 3 = bullseye (red), 2 = inner ring (yellow), 1 = outer ring (green). */
export const SCORE_BANDS = [
  { points: 3, halfWidth: 0.04, color: "#e23b2e" },
  { points: 2, halfWidth: 0.12, color: "#f0c12e" },
  { points: 1, halfWidth: 0.2, color: "#2f9e57" },
] as const;

/** Tiny epsilon so IEEE noise still awards the higher score on exact boundaries. */
const BOUNDARY_EPS = 1e-10;

/** Exact boundary awards the higher score. */
export function scoreNeedle(needlePosition: number, targetCenter: number): number {
  const d = Math.abs(needlePosition - targetCenter);
  if (d <= 0.04 + BOUNDARY_EPS) return 3;
  if (d <= 0.12 + BOUNDARY_EPS) return 2;
  if (d <= 0.2 + BOUNDARY_EPS) return 1;
  return 0;
}

export function randomTargetCenter(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const u = buf[0]! / 2 ** 32; // [0, 1)
  return TARGET_MIN + u * (TARGET_MAX - TARGET_MIN);
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}
