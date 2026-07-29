// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defineProfessionApp,
  preferOffhand,
} from "../../../app/define-profession-app.js";
import { applyGuardianBuildAttributeRules } from "../build-attributes.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { guardianProfession } from "../definition.js";

export const guardianApp = defineProfessionApp({
  profession: guardianProfession,
  applyBuildAttributeRules: applyGuardianBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Zeal",
  runtime: {
    buildConfigExtras: app => ({
      initialTomePages: app.build.initialTomePages,
      guardianStaticTraitsApplied: true,
      guardianStaticTraitWeapon: (
        Number(app.attributeWeaponSet || 1) === 2
          ? app.build.alternateWeapons
          : app.build.weapons
      )?.[0] || "",
    }),
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
