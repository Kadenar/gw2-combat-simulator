import {
  createGw2SimulationConfig,
} from "../../../app/gw2-simulation-config.js";
import {
  calculateContributionComparisons,
} from "../../../app/app-runtime.js";
import {
  FOOD_DATA,
} from "../../../platform/gw2/gear-data.js";
import { simulateGw2 } from "../../../platform/gw2/simulate.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { guardianProfession } from "../definition.js";

const simulateSequence = (rotation, config) => simulateGw2({
  profession: guardianProfession,
  rotation,
  config,
  mode: "sequence",
});

const eliteNames = new Set(
  guardianProfession.catalog.specializations
    .filter(specialization => specialization.elite)
    .map(specialization => specialization.name),
);

export function eliteSpecialization(build) {
  return build.specializations
    .find(specialization => eliteNames.has(specialization.name))
    ?.name || "Core";
}

function selectedSkills(app) {
  return Object.values(app.build.selectedSkills)
    .map(name => app.skillByName.get(name))
    .filter(Boolean);
}

export function recalculate(app) {
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

export function simulationConfig(app, disabled = null) {
  const attributeData = attributesWithModifierDisabled(app, disabled);
  const activeTraits = attributeData.activeTraits || [];
  return {
    ...createGw2SimulationConfig({
      app,
      attributeData,
      specialization: eliteSpecialization(app.build),
      disabled,
      selectedTraits: activeTraits.map(trait => trait.name),
      selectedTraitIds: activeTraits
        .map(trait => trait.id)
        .filter(id => id != null),
    }),
    initialTomePages: app.build.initialTomePages,
  };
}

export function modifierCandidates(app) {
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
    candidates.push({
      id: `Trait:${trait.name}`,
      type: "Trait",
      name: trait.name,
      label: trait.name,
    });
  }
  return candidates;
}

export function modifierContributionRequest(app) {
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
    professionId: guardianProfession.id,
    rotation: app.build.rotation,
    baseConfig,
    comparisons,
  };
}

export function calculateModifierContributions({
  rotation,
  baseConfig,
  comparisons,
}) {
  return calculateContributionComparisons(
    { rotation, baseConfig, comparisons },
    simulateSequence,
  );
}

export function runSimulation(app) {
  app.results = simulateSequence(
    app.build.rotation,
    simulationConfig(app),
  );
  return app.results;
}
