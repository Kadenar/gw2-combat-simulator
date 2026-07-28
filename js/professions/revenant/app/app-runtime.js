import {
  createProfessionRuntime,
} from "../../../app/create-profession-runtime.js";
import { calculateAttributes } from "../core/calc-attributes.js";
import { revenantProfession } from "../definition.js";

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
  profession: revenantProfession,
  calculateAttributes,
  buildConfigInputs: app => ({ initialResource: app.build.initialEnergy }),
  buildConfigExtras: app => ({
    initialEnergy: app.build.initialEnergy,
    selectedLegends: [...app.build.selectedLegends],
    startingLegend: app.build.startingLegend,
    selectedDodge: app.build.selectedDodge,
    allianceSide: app.build.allianceSide,
    revenantBuildAttributesApplied: true,
  }),
});

