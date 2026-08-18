// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp, preferOffhand } from '../../../app/profession/define-app.js';
import { TRAIT_COVERAGE_STATUSES } from '../../../platform/gw2/trait-coverage.js';
import { applyRevenantBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { REVENANT_TRAIT_COVERAGE } from '../data/trait-coverage.js';
import { revenantProfession } from '../definition.js';
import type { RevenantApplicationBuild } from '../types.js';

const DAMAGE_NEUTRAL_IMPLEMENTED_TRAITS = new Set<number>([
  TRAIT.HARDENING_PERSISTENCE,
  TRAIT.ELEVATED_COMPASSION,
  TRAIT.RIGHTEOUS_REBEL
]);
const DAMAGE_CONTRIBUTION_TRAITS = new Set<number>(
  REVENANT_TRAIT_COVERAGE.filter(
    (entry) =>
      entry.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED && !DAMAGE_NEUTRAL_IMPLEMENTED_TRAITS.has(entry.traitId)
  ).map((entry) => entry.traitId)
);

export const revenantApp = defineProfessionApp({
  profession: revenantProfession,
  applyBuildAttributeRules: applyRevenantBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Invocation',
  resetPrompt: 'Reset the Revenant build, legends, and rotation?',
  runtime: {
    isContributionTrait: (trait) => DAMAGE_CONTRIBUTION_TRAITS.has(Number(trait.id)),
    buildConfigInputs: (app) => ({
      initialResource: (app.build as RevenantApplicationBuild).initialEnergy
    }),
    buildConfigExtras: (app) => ({
      initialEnergy: (app.build as RevenantApplicationBuild).initialEnergy,
      selectedLegends: [...(app.build as RevenantApplicationBuild).selectedLegends],
      startingLegend: (app.build as RevenantApplicationBuild).startingLegend,
      selectedDodge: (app.build as RevenantApplicationBuild).selectedDodge,
      allianceSide: (app.build as RevenantApplicationBuild).allianceSide
    })
  },
  defaultOffhand: preferOffhand('Sword')
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
  runSimulation
} = revenantApp;
