import { preferOffhand } from '#gw2/app/create-adapter.js';
import { definePatchedProfessionApp } from '#gw2/app/create-patched-adapter.js';
import { applyWarriorBuildAttributeRules } from '#gw2/professions/warrior/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/warrior/build/build.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

// Exposes Warrior only through the shared browser application contract.
export const warriorAppAdapter = definePatchedProfessionApp({
  tooltips: warriorTooltips,
  profession: warriorProfession,
  applyBuildAttributeRules: applyWarriorBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Strength',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: app.build.initialResource
    })
  },
  defaultOffhand: preferOffhand('Axe')
});
