import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyRevenantBuildAttributeRules } from '#gw2/professions/revenant/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/revenant/build/build.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import type { RevenantApplicationBuild } from '#gw2/professions/revenant/types.js';

// Exposes Revenant only through the shared browser application contract.
export const revenantAppAdapter = defineProfessionApp({
  profession: withActivePatchPreview(revenantProfession),
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
      startingLegend: (app.build as RevenantApplicationBuild).startingLegend,
      selectedDodge: (app.build as RevenantApplicationBuild).selectedDodge,
      allianceSide: (app.build as RevenantApplicationBuild).allianceSide
    })
  },
  defaultOffhand: preferOffhand('Sword')
});
