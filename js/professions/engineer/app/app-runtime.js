import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { engineerProfession } from "../definition.js";

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
  profession: engineerProfession,
  calculateAttributes,
  buildConfigInputs: app => ({
    initialResource: app.build.initialHeat,
  }),
  buildConfigExtras: app => ({
    initialHeat: app.build.initialHeat,
    selectedMorphSkillIds: [...app.build.selectedMorphSkillIds],
    engineerBuildAttributesApplied: true,
  }),
});

