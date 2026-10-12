// Browser-facing Thief composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../profession.js.

import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';
import { toApplicationBuild } from '#gw2/professions/thief/build/build.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import type { ThiefCanonicalBuild } from '#gw2/professions/thief/types.js';

// Exposes Thief only through the shared browser application contract.
export const thiefAppAdapter = defineProfessionApp({
  tooltips: thiefTooltips,
  profession: thiefProfession,
  applyBuildAttributeRules: createProfessionBuildAttributeRules(thiefCatalog, getActiveTraits),
  toApplicationBuild,
  resetPrompt: 'Reset the Thief build, assumptions, and rotation?',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: (app.build as ThiefCanonicalBuild).initialInitiative
    }),
    buildConfigExtras: (app) => ({
      initialInitiative: (app.build as ThiefCanonicalBuild).initialInitiative,
      initialSpinningAxes: (app.build as ThiefCanonicalBuild).initialSpinningAxes,
      initialPreSteal: (app.build as ThiefCanonicalBuild).initialPreSteal,
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
