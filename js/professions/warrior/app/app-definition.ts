import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '../../../app/profession/define-app.js';
import { applyWarriorBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
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
  isSkillAvailable(skill, context = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    return defaultIsSkillAvailable(skill, context);
  },
  defaultOffhand: preferOffhand('Axe')
});
