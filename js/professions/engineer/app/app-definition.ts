// Browser-facing Engineer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defaultIsSkillAvailable,
  defineProfessionApp,
  preferOffhand,
} from "../../../app/profession/define-app.js";
import { applyEngineerBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { engineerProfession } from "../definition.js";
import type {
  EngineerApplicationBuild,
  EngineerEvolveAttributePool,
} from "../types.js";

export const engineerApp = defineProfessionApp({
  profession: engineerProfession,
  applyBuildAttributeRules: applyEngineerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Explosives",
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: (app.build as EngineerApplicationBuild).initialHeat,
    }),
    buildConfigExtras: (app) => {
      const build = app.build as EngineerApplicationBuild;
      const evolveAttributePool = (
        app.attributeData as {
          amalgamEvolveAttributePool?: EngineerEvolveAttributePool;
        }
      ).amalgamEvolveAttributePool;
      const amalgam = build.specializations?.some(
        (specialization) => specialization.name === "Amalgam",
      );
      return {
        ...(amalgam
          ? {
              amalgamEvolveAttributePool: {
                ...evolveAttributePool,
              },
            }
          : {}),
        initialHeat: build.initialHeat,
        selectedMorphSkillIds: [...build.selectedMorphSkillIds],
      };
    },
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
