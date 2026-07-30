// Browser-facing Engineer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defaultIsSkillAvailable,
  defineProfessionApp,
  preferOffhand,
} from "../../../app/define-profession-app.js";
import { applyEngineerBuildAttributeRules } from "../build-attributes.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { engineerProfession } from "../definition.js";

export const engineerApp = defineProfessionApp({
  profession: engineerProfession,
  applyBuildAttributeRules: applyEngineerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Explosives",
  runtime: {
    buildConfigInputs: app => ({
      initialResource: app.build.initialHeat,
    }),
    buildConfigExtras: app => ({
      initialHeat: app.build.initialHeat,
      selectedMorphSkillIds: [...app.build.selectedMorphSkillIds],
    }),
  },
  isSkillAvailable(skill, context) {
    if (skill.id === -3) return true;
    return defaultIsSkillAvailable(skill, context);
  },
  defaultOffhand: preferOffhand("Pistol"),
});

export const {
  appAdapter: engineerAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = engineerApp;
