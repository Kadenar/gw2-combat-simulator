import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyWarriorBuildAttributeRules } from '#gw2/professions/warrior/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/warrior/build/build.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';

// Exposes Warrior only through the shared browser application contract.
export const warriorAppAdapter = defineProfessionApp({
  profession: withActivePatchPreview(warriorProfession),
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
