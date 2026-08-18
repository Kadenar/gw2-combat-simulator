import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '../../../app/profession/define-app.js';
import { applyWarriorBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { warriorProfession } from '../definition.js';

export const warriorApp = defineProfessionApp({
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

export const {
  appAdapter: warriorAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation
} = warriorApp;
