import { WEAPON } from '#gw2/platform/constants.js';
import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/warrior/build/context.js';
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

// Exposes Warrior only through the shared browser application contract.
export const warriorAppAdapter = defineProfessionApp({
  tooltips: warriorTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  defaultOffhand: preferOffhand(WEAPON.AXE)
});
