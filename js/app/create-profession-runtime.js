import {
  createGw2SimulationConfig,
} from "./gw2-simulation-config.js";
import {
  calculateContributionComparisons,
} from "./app-runtime.js";
import {
  FOOD_DATA,
} from "../platform/gw2/gear-data.js";
import { simulateGw2 } from "../platform/gw2/simulate.js";

/**
 * Builds the shared browser runtime orchestration for a GW2 profession.
 *
 * Every profession bridges UI build state to the simulation engine the same
 * way: recalculate attributes, assemble a simulation config, run the sequence
 * simulator, and enumerate modifier-contribution comparisons. Only two small
 * seams differ per profession, both optional:
 *
 * - `buildConfigInputs(app, { attributeData, specialization, activeTraits })`
 *   returns extra fields passed *into* `createGw2SimulationConfig` (e.g.
 *   Necromancer's `initialResource`, Mesmer's clone-start resource and
 *   `adjustConditionDurationBonus`).
 * - `buildConfigExtras(app)` returns extra fields merged *onto* the resulting
 *   config (e.g. Guardian's `initialTomePages`, Necromancer's `initialBlight`).
 * - `isContributionTrait(trait, app)` can exclude structural traits whose
 *   removal is not a valid simulation counterfactual.
 *
 * @param {Object} options
 * @param {Object} options.profession - Frozen `defineProfession` contract.
 * @param {Function} options.calculateAttributes - Profession attribute calculator.
 * @param {Function} [options.buildConfigInputs] - Extra `createGw2SimulationConfig` inputs.
 * @param {Function} [options.buildConfigExtras] - Extra fields merged onto the config.
 * @param {Function} [options.isContributionTrait] - Whether to compare an active trait.
 * @returns {Object} Runtime functions shared by the profession app adapter.
 */
export function createProfessionRuntime({
  profession,
  calculateAttributes,
  buildConfigInputs,
  buildConfigExtras,
  isContributionTrait = () => true,
}) {
  const simulateBuild = (rotation, config) => simulateGw2({
    profession,
    rotation,
    config,
    execution: { mode: "sequence" },
  });

  const eliteNames = new Set(
    profession.catalog.specializations
      .filter(specialization => specialization.elite)
      .map(specialization => specialization.name),
  );

  function eliteSpecialization(build) {
    return build.specializations
      .find(specialization => eliteNames.has(specialization.name))
      ?.name || "Core";
  }

  function selectedSkills(app) {
    const loadout = profession.ui.slotLoadout;
    if (loadout) {
      return loadout.selectedSkillIds({
        build: app.build,
        specialization: eliteSpecialization(app.build),
        professionState: app.results?.endState?.profession,
        catalog: profession.catalog,
      })
        .map(id => profession.catalog.skillsById.get(Number(id)))
        .filter(Boolean);
    }
    return Object.values(app.build.selectedSkills)
      .map(name => app.skillByName.get(name))
      .filter(Boolean);
  }

  function recalculate(app) {
    app.attributeData = calculateAttributes(
      app.build,
      selectedSkills(app),
      app.attributeWeaponSet || 1,
    );
  }

  function attributesWithModifierDisabled(app, disabled) {
    if (!disabled || (disabled.type !== "Trait" && disabled.type !== "Boon")) {
      return app.attributeData;
    }
    let build = app.build;
    if (disabled.type === "Boon") {
      const key = disabled.name.toLowerCase();
      build = {
        ...app.build,
        assumptions: {
          ...app.build.assumptions,
          [key]: key === "might" ? 0 : false,
        },
      };
    }
    return calculateAttributes(
      build,
      selectedSkills(app),
      app.attributeWeaponSet || 1,
      disabled.type === "Trait" ? disabled.name : null,
    );
  }

  function simulationConfig(app, disabled = null) {
    const attributeData = attributesWithModifierDisabled(app, disabled);
    const specialization = eliteSpecialization(app.build);
    const activeTraits = attributeData.activeTraits || [];
    const config = createGw2SimulationConfig({
      app,
      attributeData,
      specialization,
      disabled,
      selectedTraits: activeTraits.map(trait => trait.name),
      selectedTraitIds: activeTraits
        .map(trait => trait.id)
        .filter(id => id != null),
      ...(buildConfigInputs
        ? buildConfigInputs(app, { attributeData, specialization, activeTraits })
        : null),
    });
    return buildConfigExtras
      ? { ...config, ...buildConfigExtras(app) }
      : config;
  }

  function modifierCandidates(app) {
    const candidates = [];
    const assumptions = app.build.assumptions;
    if (Number(assumptions.might) > 0) {
      candidates.push({
        id: "Boon:Might",
        type: "Boon",
        name: "Might",
        label: "Might",
      });
    }
    if (assumptions.fury) {
      candidates.push({
        id: "Boon:Fury",
        type: "Boon",
        name: "Fury",
        label: "Fury",
      });
    }
    if (assumptions.resolution) {
      candidates.push({
        id: "Boon:Resolution",
        type: "Boon",
        name: "Resolution",
        label: "Resolution",
      });
    }
    if (Number(assumptions.targetConditions?.Vulnerability) > 0) {
      candidates.push({
        id: "Target:Vulnerability",
        type: "Target",
        name: "Vulnerability",
        label: "Vulnerability",
      });
    }
    for (const name of new Set((app.build.weaponSigils || []).flat())) {
      if (!name) continue;
      candidates.push({
        id: `Sigil:${name}`,
        type: "Sigil",
        name,
        label: `Sigil of ${name}`,
      });
    }
    if (app.build.relic) {
      candidates.push({
        id: `Relic:${app.build.relic}`,
        type: "Relic",
        name: app.build.relic,
        label: `Relic of ${app.build.relic}`,
      });
    }
    if (FOOD_DATA[app.build.food]?.proc) {
      candidates.push({
        id: `Food:${app.build.food}`,
        type: "Food",
        name: app.build.food,
        label: `Food: ${FOOD_DATA[app.build.food].proc.name}`,
      });
    }
    for (const trait of app.attributeData.activeTraits || []) {
      if (!isContributionTrait(trait, app)) continue;
      candidates.push({
        id: `Trait:${trait.name}`,
        type: "Trait",
        name: trait.name,
        label: trait.name,
      });
    }
    return candidates;
  }

  function modifierContributionRequest(app) {
    const baseConfig = simulationConfig(app);
    if (app.build.relic !== "Eagle") {
      baseConfig.target = { ...baseConfig.target, health: 0 };
    }
    const comparisons = modifierCandidates(app).map(modifier => {
      const config = simulationConfig(app, modifier);
      if (app.build.relic !== "Eagle") {
        config.target = { ...config.target, health: 0 };
      }
      return { modifier, config };
    });
    return {
      professionId: profession.id,
      rotation: app.build.rotation,
      baseConfig,
      comparisons,
    };
  }

  function calculateModifierContributions({
    rotation,
    baseConfig,
    comparisons,
  }) {
    return calculateContributionComparisons(
      { rotation, baseConfig, comparisons },
      simulateBuild,
    );
  }

  function computeModifierContributions(app) {
    return calculateModifierContributions(modifierContributionRequest(app));
  }

  function runSimulation(app) {
    app.results = simulateBuild(
      app.build.rotation,
      simulationConfig(app),
    );
    return app.results;
  }

  return {
    simulateBuild,
    eliteSpecialization,
    recalculate,
    simulationConfig,
    modifierCandidates,
    modifierContributionRequest,
    calculateModifierContributions,
    computeModifierContributions,
    runSimulation,
  };
}
