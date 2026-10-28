// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.
import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { WEAPON } from '#gw2/platform/constants.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { createBuildContext, profession, toApplicationBuild } from '#gw2/professions/thief/build/context.js';

// Exposes Thief only through the shared browser application contract.
export const thiefAppAdapter = defineProfessionApp({
  tooltips: thiefTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  resetPrompt: 'Reset the Thief build, assumptions, and rotation?',
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if ([WEAPON.DAGGER, WEAPON.PISTOL].some((member) => member === mainHand)) {
      return offHands.includes(WEAPON.PISTOL) ? WEAPON.PISTOL : offHands[0] || '';
    }

    return offHands[0] || '';
  }
});
