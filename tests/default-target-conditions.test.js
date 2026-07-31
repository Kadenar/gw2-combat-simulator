import assert from "node:assert/strict";
import test from "node:test";

import { createGw2SimulationConfig } from "../js/app/simulation/config.js";
import {
  DEFAULT_TARGET_CONDITIONS,
} from "../js/platform/gw2/default-target-conditions.js";
import { createEngineerBuildDefaults } from "../js/professions/engineer/build.js";
import {
  createDefaultPermaBoons,
} from "../js/professions/elementalist/app/app-state.js";
import { createGuardianBuildDefaults } from "../js/professions/guardian/build.js";
import { createMesmerBuildDefaults } from "../js/professions/mesmer/build.js";
import {
  createNecromancerBuildDefaults,
} from "../js/professions/necromancer/build.js";
import { createRevenantBuildDefaults } from "../js/professions/revenant/build.js";
import { createThiefBuildDefaults } from "../js/professions/thief/build.js";

test("all profession pages use the shared default target conditions", () => {
  for (const createDefaults of [
    createMesmerBuildDefaults,
    createGuardianBuildDefaults,
    createNecromancerBuildDefaults,
    createEngineerBuildDefaults,
    createRevenantBuildDefaults,
    createThiefBuildDefaults,
  ]) {
    assert.deepEqual(
      createDefaults().assumptions.targetConditions,
      DEFAULT_TARGET_CONDITIONS,
    );
  }

  const elementalistDefaults = createDefaultPermaBoons();
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(DEFAULT_TARGET_CONDITIONS)
        .map(name => [name, elementalistDefaults[name]]),
    ),
    DEFAULT_TARGET_CONDITIONS,
  );
});

test("ally calculations always use one strike per second per ally", () => {
  const build = createMesmerBuildDefaults();
  build.assumptions.alliedPlayerCount = 3;
  build.assumptions.alliedPlayerStrikesPerSecond = 9;
  const config = createGw2SimulationConfig({
    app: {
      build,
      adapter: { assumptionControls: [] },
      skillById: new Map(),
    },
    attributeData: { attributes: {} },
    specialization: "Core",
  });

  assert.deepEqual(config.allies, {
    count: 3,
    strikesPerSecond: 1,
  });
  assert.equal(config.sharePlayerBoonsWithSummons, true);

  build.assumptions.sharePlayerBoonsWithSummons = false;
  const isolatedSummonConfig = createGw2SimulationConfig({
    app: {
      build,
      adapter: { assumptionControls: [] },
      skillById: new Map(),
    },
    attributeData: { attributes: {} },
    specialization: "Core",
  });
  assert.equal(isolatedSummonConfig.sharePlayerBoonsWithSummons, false);
});
