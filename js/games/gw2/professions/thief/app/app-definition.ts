// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.

import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { applyThiefBuildAttributeRules } from '#gw2/professions/thief/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/thief/build/build.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import type { ThiefCanonicalBuild } from '#gw2/professions/thief/types.js';

// Exposes Thief only through the shared browser application contract.
export const thiefAppAdapter = definePatchedProfessionApp({
  tooltips: thiefTooltips,
  profession: thiefProfession,
  applyBuildAttributeRules: applyThiefBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Trickery',
  resetPrompt: 'Reset the Thief build, assumptions, and rotation?',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: (app.build as ThiefCanonicalBuild).initialInitiative
    }),
    buildConfigExtras: (app) => ({
      initialInitiative: (app.build as ThiefCanonicalBuild).initialInitiative,
      initialShadowForce: (app.build as ThiefCanonicalBuild).initialShadowForce,
      selectedDodge: (app.build as ThiefCanonicalBuild).selectedDodge
    })
  },
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if (['Dagger', 'Pistol'].includes(mainHand || '')) {
      return offHands.includes('Pistol') ? 'Pistol' : offHands[0] || '';
    }

    return offHands[0] || '';
  }
});
