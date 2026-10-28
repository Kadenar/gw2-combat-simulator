import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { createElementalistBuildDefaults } from '#gw2/professions/elementalist/build/build.js';
import { createEngineerBuildDefaults } from '#gw2/professions/engineer/build/build.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { createMesmerBuildDefaults } from '#gw2/professions/mesmer/build/build.js';
import { createBuildContext, profession } from '#gw2/professions/mesmer/build/context.js';
import { createNecromancerBuildDefaults } from '#gw2/professions/necromancer/build/build.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';
import { createCommonBuildDefaults } from '#gw2/professions/shared/build-defaults.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';

test('all profession pages use the shared default target conditions', () => {
  for (const createDefaults of [
    createElementalistBuildDefaults,
    createMesmerBuildDefaults,
    createGuardianBuildDefaults,
    createNecromancerBuildDefaults,
    createEngineerBuildDefaults,
    createRevenantBuildDefaults,
    createThiefBuildDefaults
  ]) {
    assert.deepEqual(createDefaults().assumptions.targetConditions, {
      Bleeding: 1,
      Burning: true,
      Torment: 1,
      Confusion: 1,
      Poisoned: true,
      Chilled: true,
      Crippled: true,
      Slow: true,
      Weakness: true,
      Vulnerability: 25
    });
  }
});

// Each build owns mutable assumptions so editing one cannot alter future defaults or another build.
test('default target conditions are isolated between builds', () => {
  const first = createCommonBuildDefaults();
  const second = createCommonBuildDefaults();
  first.assumptions.targetConditions.Vulnerability = 0;
  assert.equal(second.assumptions.targetConditions.Vulnerability, 25);
  assert.equal(createCommonBuildDefaults().assumptions.targetConditions.Vulnerability, 25);
});

test('simulation config carries the persisted target starting-health percentage', () => {
  const build = createMesmerBuildDefaults();
  build.targetStartingHealthPercent = 49;

  const config = createBuildContext({
    build,
    transitionDelays: normalizeTransitionDelays(),
    patch: profession.resolvePatch({ id: 'current' })
  }).simulationConfig();

  assert.equal(config.target.startingHealthFraction, 0.49);
});

test('ally calculations use the fixed 520 ms attack cadence per ally', () => {
  const build = createMesmerBuildDefaults();

  build.assumptions.alliedPlayerCount = 3;
  build.assumptions.alliedPlayerStrikesPerSecond = 9;
  const config = createBuildContext({
    build,
    transitionDelays: normalizeTransitionDelays(),
    patch: profession.resolvePatch({ id: 'current' })
  }).simulationConfig();

  // Shared effects use the fixed ally cadence even when a saved build includes an obsolete rate assumption.
  assert.deepEqual(config.allies, {
    count: 3,
    strikesPerSecond: 1000 / 520
  });
  assert.equal(config.patchId, 'current');
  assert.equal(config.sharePlayerBoonsWithSummons, true);

  build.assumptions.sharePlayerBoonsWithSummons = false;
  const isolatedSummonConfig = createBuildContext({
    build,
    transitionDelays: normalizeTransitionDelays(),
    patch: profession.resolvePatch({ id: 'current' })
  }).simulationConfig();

  assert.equal(isolatedSummonConfig.sharePlayerBoonsWithSummons, false);
});
