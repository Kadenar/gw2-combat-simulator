import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2SimulationConfig } from '../../js/games/gw2/app/simulation/config.js';
import { DEFAULT_TARGET_CONDITIONS } from '../../js/games/gw2/platform/builds/default-target-conditions.js';
import { createElementalistBuildDefaults } from '../../js/games/gw2/content/professions/elementalist/build.js';
import { createEngineerBuildDefaults } from '../../js/games/gw2/content/professions/engineer/build.js';
import { createGuardianBuildDefaults } from '../../js/games/gw2/content/professions/guardian/build.js';
import { createMesmerBuildDefaults } from '../../js/games/gw2/content/professions/mesmer/build.js';
import { createNecromancerBuildDefaults } from '../../js/games/gw2/content/professions/necromancer/build.js';
import { createRevenantBuildDefaults } from '../../js/games/gw2/content/professions/revenant/build.js';
import { createThiefBuildDefaults } from '../../js/games/gw2/content/professions/thief/build.js';

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
    assert.deepEqual(createDefaults().assumptions.targetConditions, DEFAULT_TARGET_CONDITIONS);
  }
});

test('ally calculations always use one strike per second per ally', () => {
  const build = createMesmerBuildDefaults();

  build.assumptions.alliedPlayerCount = 3;
  build.assumptions.alliedPlayerStrikesPerSecond = 9;
  const config = createGw2SimulationConfig({
    app: {
      build,
      adapter: { assumptionControls: [] },
      skillById: new Map()
    },
    attributeData: { attributes: {} },
    specialization: 'Core'
  });

  assert.deepEqual(config.allies, {
    count: 3,
    strikesPerSecond: 1
  });
  assert.equal(config.patchId, 'current');
  assert.deepEqual(config.patchValues, {});
  assert.equal(config.sharePlayerBoonsWithSummons, true);

  build.assumptions.sharePlayerBoonsWithSummons = false;
  const isolatedSummonConfig = createGw2SimulationConfig({
    app: {
      build,
      adapter: { assumptionControls: [] },
      skillById: new Map()
    },
    attributeData: { attributes: {} },
    specialization: 'Core'
  });

  assert.equal(isolatedSummonConfig.sharePlayerBoonsWithSummons, false);
});
