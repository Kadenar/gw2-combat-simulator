// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp, preferOffhand } from '../../../../app/create-adapter.js';
import { applyRevenantBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { revenantProfession } from '../definition.js';
import type { RevenantApplicationBuild } from '../types.js';

// Exposes Revenant only through the shared browser application contract.
export const revenantAppAdapter = defineProfessionApp({
  profession: revenantProfession,
  applyBuildAttributeRules: applyRevenantBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Invocation',
  resetPrompt: 'Reset the Revenant build, legends, and rotation?',
  runtime: {
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
