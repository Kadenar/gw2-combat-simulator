// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp } from '#gw2/app/create-adapter.js';
import { applyThiefBuildAttributeRules } from '#gw2/content/professions/thief/build/attributes.js';
import { toApplicationBuild } from '#gw2/content/professions/thief/build/build.js';
import { thiefProfession } from '#gw2/content/professions/thief/definition.js';
import type { ThiefApplicationBuild } from '#gw2/content/professions/thief/types.js';

// Exposes Thief only through the shared browser application contract.
export const thiefAppAdapter = defineProfessionApp({
  profession: thiefProfession,
  applyBuildAttributeRules: applyThiefBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Trickery',
  resetPrompt: 'Reset the Thief build, assumptions, and rotation?',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: (app.build as ThiefApplicationBuild).initialInitiative
    }),
    buildConfigExtras: (app) => ({
      initialInitiative: (app.build as ThiefApplicationBuild).initialInitiative,
      initialShadowForce: (app.build as ThiefApplicationBuild).initialShadowForce,
      playerHealthFraction: 1,
      selectedDodge: (app.build as ThiefApplicationBuild).selectedDodge
    })
  },
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if (['Dagger', 'Pistol'].includes(mainHand || '')) {
      return offHands.includes('Pistol') ? 'Pistol' : offHands[0] || '';
    }

    return offHands[0] || '';
  }
});
