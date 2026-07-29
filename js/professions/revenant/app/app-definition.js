// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import {
  defineProfessionApp,
  preferOffhand,
} from "../../../app/define-profession-app.js";
import { TRAIT_COVERAGE_STATUSES } from "../../../platform/gw2/trait-coverage.js";
import { applyRevenantBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { REVENANT_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { REVENANT_TRAIT_COVERAGE } from "../data/trait-coverage.js";
import { revenantProfession } from "../definition.js";

const DAMAGE_NEUTRAL_IMPLEMENTED_TRAITS = new Set([
  TRAIT.HARDENING_PERSISTENCE,
  TRAIT.ELEVATED_COMPASSION,
  TRAIT.RIGHTEOUS_REBEL,
]);
const DAMAGE_CONTRIBUTION_TRAITS = new Set(
  REVENANT_TRAIT_COVERAGE.filter(
    (entry) =>
      entry.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED &&
      !DAMAGE_NEUTRAL_IMPLEMENTED_TRAITS.has(entry.traitId),
  ).map((entry) => entry.traitId),
);

export const revenantApp = defineProfessionApp({
  profession: revenantProfession,
  applyBuildAttributeRules: applyRevenantBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Invocation",
  resetPrompt: "Reset the Revenant build, legends, and rotation?",
  runtime: {
    isContributionTrait: (trait) =>
      DAMAGE_CONTRIBUTION_TRAITS.has(Number(trait.id)),
    buildConfigInputs: (app) => ({
      initialResource: app.build.initialEnergy,
    }),
    buildConfigExtras: (app) => ({
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
