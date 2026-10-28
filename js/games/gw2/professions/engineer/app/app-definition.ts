// Browser-facing Engineer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { engineerTooltips } from '#gw2/professions/engineer/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/engineer/build/context.js';

// Exposes Engineer only through the shared browser application contract.
export const engineerAppAdapter = defineProfessionApp({
  tooltips: engineerTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  defaultOffhand: preferOffhand(WEAPON.PISTOL)
});
