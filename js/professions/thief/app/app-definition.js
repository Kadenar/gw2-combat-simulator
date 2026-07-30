// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defineProfessionApp,
} from "../../../app/profession/define-app.js";
import { applyThiefBuildAttributeRules } from "../build-attributes.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { thiefProfession } from "../definition.js";

export const thiefApp = defineProfessionApp({
  profession: thiefProfession,
  applyBuildAttributeRules: applyThiefBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Trickery",
  resetPrompt: "Reset the Thief build, assumptions, and rotation?",
  runtime: {
    buildConfigInputs: app => ({
      initialResource: app.build.initialInitiative,
    }),
    buildConfigExtras: app => ({
      initialInitiative: app.build.initialInitiative,
      initialShadowForce: app.build.initialShadowForce,
      playerHealthFraction: 1,
      selectedDodge: app.build.selectedDodge,
    }),
  },
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if (["Dagger", "Pistol"].includes(mainHand)) {
      return offHands.includes("Pistol") ? "Pistol" : offHands[0] || "";
    }
    return offHands[0] || "";
  },
});

export const {
  appAdapter: thiefAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = thiefApp;
