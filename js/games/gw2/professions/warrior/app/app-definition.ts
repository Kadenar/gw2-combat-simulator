import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/warrior/build/context.js';

// Exposes Warrior only through the shared browser application contract.
export const warriorAppAdapter = defineProfessionApp({
  tooltips: warriorTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  defaultOffhand: preferOffhand(WEAPON.AXE)
});
