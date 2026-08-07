import assert from "node:assert/strict";
import test from "node:test";

import {
  isInternalCooldownReady,
} from "../js/platform/engine/clock.js";
import {
  armRelicIcd,
  isRelicIcdReady,
} from "../js/professions/elementalist/sim/state/sim-icd-state.js";

test("internal cooldowns remain active through their boundary timestamp", () => {
  assert.equal(isInternalCooldownReady(0, 0), true);
  assert.equal(isInternalCooldownReady(0.999, 1), false);
  assert.equal(isInternalCooldownReady(1, 1), false);
  assert.equal(isInternalCooldownReady(1.001, 1), true);
});

test("Elementalist ICD state uses the shared strict boundary rule", () => {
  const state = {};
  armRelicIcd(state, "Fixture", 100, 1000);

  assert.equal(isRelicIcdReady(state, "Fixture", 1099), false);
  assert.equal(isRelicIcdReady(state, "Fixture", 1100), false);
  assert.equal(isRelicIcdReady(state, "Fixture", 1101), true);
});
