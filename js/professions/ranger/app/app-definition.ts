import {
  defineProfessionApp,
  preferOffhand,
} from "../../../app/profession/define-app.js";
import { applyRangerBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { rangerProfession } from "../definition.js";
import type { RangerApplicationBuild } from "../types.js";

export const rangerApp = defineProfessionApp({
  profession: rangerProfession,
  applyBuildAttributeRules: applyRangerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Marksmanship",
  resetPrompt: "Reset the Ranger build, pet, assumptions, and rotation?",
  runtime: {
    buildConfigExtras: (app) => {
      const build = app.build as RangerApplicationBuild;
      return {
        initialAstralForce: build.initialAstralForce,
        initialArrows: build.initialArrows,
        selectedPet: build.selectedPet,
        selectedPet2: build.selectedPet2,
        selectedHammerSkillIds: [...build.selectedHammerSkillIds],
        initialUntamedState: build.initialUntamedState,
      };
    },
  },
  defaultOffhand: preferOffhand("Axe"),
});

export const {
  appAdapter: rangerAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = rangerApp;
