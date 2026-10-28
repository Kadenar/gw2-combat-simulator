// Browser-facing Guardian composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.ts.
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/guardian/build/context.js';

// Exposes Guardian only through the shared browser application contract.
export const guardianAppAdapter = defineProfessionApp({
  tooltips: guardianTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  defaultOffhand: preferOffhand(WEAPON.FOCUS)
});
