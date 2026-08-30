import { defineProfessionApp, preferOffhand } from '../../../../app/create-adapter.js';
import { applyWarriorBuildAttributeRules } from '../build/attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build/build.js';
import { warriorProfession } from '../definition.js';

// Exposes Warrior only through the shared browser application contract.
export const warriorAppAdapter = defineProfessionApp({
  profession: warriorProfession,
  applyBuildAttributeRules: applyWarriorBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Strength',
  runtime: {
    buildConfigInputs: (app) => ({
      initialResource: app.build.initialResource
    })
  },
  defaultOffhand: preferOffhand('Axe')
});
