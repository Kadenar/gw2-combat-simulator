import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/thief/build/context.js';
// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';

// Exposes Thief only through the shared browser application contract.
export const thiefAppAdapter = defineProfessionApp({
  tooltips: thiefTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  resetPrompt: 'Reset the Thief build, assumptions, and rotation?',
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if (['Dagger', 'Pistol'].includes(mainHand || '')) {
      return offHands.includes('Pistol') ? 'Pistol' : offHands[0] || '';
    }

    return offHands[0] || '';
  }
});
