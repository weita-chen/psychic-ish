import assert from "node:assert/strict";
import { test } from "node:test";
import { clamp01, randomTargetCenter, scoreNeedle } from "./scoring.ts";
import { TARGET_MAX, TARGET_MIN } from "./types.ts";

test("scoreNeedle awards higher score on exact boundaries", () => {
  const t = 0.5;
  assert.equal(scoreNeedle(0.5, t), 3);
  assert.equal(scoreNeedle(0.5 + 0.04, t), 3);
  assert.equal(scoreNeedle(0.5 + 0.041, t), 2);
  assert.equal(scoreNeedle(0.5 + 0.12, t), 2);
  assert.equal(scoreNeedle(0.5 + 0.12 + 1e-8, t), 1);
  assert.equal(scoreNeedle(0.5 + 0.2, t), 1);
  assert.equal(scoreNeedle(0.5 + 0.2 + 1e-8, t), 0);
  assert.equal(scoreNeedle(0.1, t), 0);
});

test("scoreNeedle is symmetric around the target", () => {
  const t = 0.4;
  assert.equal(scoreNeedle(t - 0.04, t), scoreNeedle(t + 0.04, t));
  assert.equal(scoreNeedle(t - 0.04, t), 3);
  assert.equal(scoreNeedle(t - 0.2, t), 1);
  assert.equal(scoreNeedle(t + 0.2, t), 1);
});

test("randomTargetCenter can land anywhere on the bar", () => {
  let min = 1;
  let max = 0;
  for (let i = 0; i < 800; i += 1) {
    const c = randomTargetCenter();
    min = Math.min(min, c);
    max = Math.max(max, c);
    assert.ok(c >= TARGET_MIN, `low ${c}`);
    assert.ok(c <= TARGET_MAX, `high ${c}`);
  }
  assert.ok(min < 0.08, "should sometimes draw near the left edge");
  assert.ok(max > 0.92, "should sometimes draw near the right edge");
});

test("scoreNeedle still awards bullseye at the bar edge", () => {
  assert.equal(scoreNeedle(0, 0), 3);
  assert.equal(scoreNeedle(1, 1), 3);
  assert.equal(scoreNeedle(0.05, 0), 2);
  assert.equal(scoreNeedle(0.25, 0), 0);
});

test("clamp01", () => {
  assert.equal(clamp01(0.3), 0.3);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(Number.NaN), 0.5);
});
