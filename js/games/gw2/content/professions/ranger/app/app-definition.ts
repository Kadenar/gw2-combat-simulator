import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '../../../../app/create-adapter.js';
import { flattenProfessionState } from '../../../../platform/engine/profession/state.js';
import { applyRangerBuildAttributeRules } from '../build-attributes.js';
import { createDefaultTargetConditions, toApplicationBuild } from '../build.js';
import { RANGER_SKILL_IDS as ID } from '../data/ids.js';
import { rangerProfession } from '../definition.js';
import type { RangerApplicationBuild } from '../types.js';

// Exposes Ranger only through the shared browser application contract.
export const rangerAppAdapter = defineProfessionApp({
  profession: rangerProfession,
  applyBuildAttributeRules: applyRangerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: 'Marksmanship',
  resetPrompt: 'Reset the Ranger build, pet, assumptions, and rotation?',
  runtime: {
    buildConfigExtras: (app) => {
      const build = app.build as RangerApplicationBuild;
      return {
        initialAstralForce: build.initialAstralForce,
        initialArrows: build.initialArrows,
        selectedPet: build.selectedPet,
        selectedPet2: build.selectedPet2,
        selectedHammerSkillIds: [...build.selectedHammerSkillIds],
        initialUntamedState: build.initialUntamedState
      };
    }
  },
  isSkillAvailable(skill, context = {}) {
    if (!defaultIsSkillAvailable(skill, context)) return false;
    if (skill.unleashedAmbushSkill && context.specialization !== 'Untamed') {
      return false;
    }

    if (
      skill.id === ID.PET_SWAP &&
      context.specialization === 'Soulbeast' &&
      flattenProfessionState(context.professionState).beastmodeActive !== false
    ) {
      return false;
    }

    return true;
  },
  defaultOffhand: preferOffhand('Axe')
});
