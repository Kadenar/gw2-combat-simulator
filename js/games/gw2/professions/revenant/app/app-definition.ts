// Browser-facing Revenant composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.ts.
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/revenant/build/context.js';

// Exposes Revenant only through the shared browser application contract.
export const revenantAppAdapter = defineProfessionApp({
  tooltips: revenantTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  resetPrompt: 'Reset the Revenant build, legends, and rotation?',
  defaultOffhand: preferOffhand(WEAPON.SWORD)
});
