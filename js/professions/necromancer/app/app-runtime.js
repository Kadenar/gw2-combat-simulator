import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { necromancerProfession } from "../definition.js";

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
  profession: necromancerProfession,
  calculateAttributes,
  buildConfigInputs: app => ({
    initialResource: app.build.initialResource,
  }),
  buildConfigExtras: app => ({
    initialBlight: app.build.initialBlight,
    necromancerBuildAttributesApplied: true,
  }),
});
