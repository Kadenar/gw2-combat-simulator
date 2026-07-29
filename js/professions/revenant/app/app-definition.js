// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defineProfessionApp,
  preferOffhand,
} from "../../../app/define-profession-app.js";
import { applyRevenantBuildAttributeRules } from "../build-attributes.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { revenantProfession } from "../definition.js";

export const revenantApp = defineProfessionApp({
  profession: revenantProfession,
  applyBuildAttributeRules: applyRevenantBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Invocation",
  resetPrompt: "Reset the Revenant build, legends, and rotation?",
  runtime: {
    buildConfigInputs: app => ({
      initialResource: app.build.initialEnergy,
    }),
    buildConfigExtras: app => ({
      initialEnergy: app.build.initialEnergy,
      selectedLegends: [...app.build.selectedLegends],
      startingLegend: app.build.startingLegend,
      selectedDodge: app.build.selectedDodge,
      allianceSide: app.build.allianceSide,
      revenantBuildAttributesApplied: true,
    }),
  },
  defaultOffhand: preferOffhand("Sword"),
});

export const {
  appAdapter: revenantAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = revenantApp;
