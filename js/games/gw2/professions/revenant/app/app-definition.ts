// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { preferOffhand } from '#gw2/app/create-adapter.js';
import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { applyRevenantBuildAttributeRules } from '#gw2/professions/revenant/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/revenant/build/build.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';
import type { RevenantApplicationBuild } from '#gw2/professions/revenant/types.js';

// Exposes Revenant only through the shared browser application contract.
export const revenantAppAdapter = definePatchedProfessionApp({
  tooltips: revenantTooltips,
  profession: revenantProfession,
  applyBuildAttributeRules: applyRevenantBuildAttributeRules,
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
      startingLegend: (app.build as RevenantApplicationBuild).startingLegend
    })
  },
  defaultOffhand: preferOffhand('Sword')
});
