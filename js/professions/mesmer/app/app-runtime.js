// Runtime orchestration layer that bridges UI state to the simulation engine.
// Shared logic lives in app/create-profession-runtime.js; only Mesmer-specific
// config seams (clone-start resource, Malicious Sorcery duration) live here.

import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { mesmerProfession } from "../definition.js";
import { mesmerResourceDefinition as getResourceDefinition } from "../ui.js";

export const {
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = createProfessionRuntime({
  profession: mesmerProfession,
  calculateAttributes,
  buildConfigInputs(app, { specialization, activeTraits }) {
    const startsWithClones =
      getResourceDefinition(specialization).singular === "clone";
    const hasMaliciousSorcery = activeTraits
      .some(trait => trait.name === "Malicious Sorcery");
    return {
      initialResource: startsWithClones ? 0 : app.build.initialResource,
      // This trait is resolved at hit time, not as an equipment bonus.
      adjustConditionDurationBonus(name, bonus) {
        return name === "Confusion" && hasMaliciousSorcery
          ? bonus - 25
          : bonus;
      },
    };
  },
  buildConfigExtras() {
    return { weaponmasterTraining: true };
  },
});
