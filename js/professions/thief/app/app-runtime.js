import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { thiefProfession } from "../definition.js";

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
  profession: thiefProfession,
  calculateAttributes,
  buildConfigInputs: app => ({
    initialResource: app.build.initialInitiative,
  }),
  buildConfigExtras: app => ({
    initialInitiative: app.build.initialInitiative,
    initialShadowForce: app.build.initialShadowForce,
    selectedDodge: app.build.selectedDodge,
    thiefBuildAttributesApplied: true,
  }),
});
