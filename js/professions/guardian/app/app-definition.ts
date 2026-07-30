// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defineProfessionApp,
  preferOffhand,
} from "../../../app/profession/define-app.js";
import { applyGuardianBuildAttributeRules } from "../build-attributes.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { guardianProfession } from "../definition.js";
import type { GuardianApplicationBuild } from "../types.js";

export const guardianApp = defineProfessionApp({
  profession: guardianProfession,
  applyBuildAttributeRules: applyGuardianBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Zeal",
  runtime: {
    buildConfigExtras: app => {
      const build = app.build as GuardianApplicationBuild;
      return { initialTomePages: build.initialTomePages };
    },
  },
  defaultOffhand: preferOffhand("Focus"),
});

export const {
  appAdapter: guardianAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = guardianApp;
