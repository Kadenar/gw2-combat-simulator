import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { createWarriorModuleData } from '#gw2/content/professions/warrior/catalog/module-data.js';
import { PARAGON_SKILL_MECHANICS } from '#gw2/content/professions/warrior/specializations/paragon/skills/index.js';
import {
  activateChant,
  activateCommand
} from '#gw2/content/professions/warrior/specializations/paragon/traits/index.js';
import {
  paragonAttributeRules,
  paragonSchedulerHooks
} from '#gw2/content/professions/warrior/specializations/paragon/mechanics/chants-and-motivation.js';
import { paragonState } from '#gw2/content/professions/warrior/specializations/paragon/state.js';
import { paragonUi } from '#gw2/content/professions/warrior/specializations/paragon/presentation.js';
import { paragonResolverEventHandlers } from '#gw2/content/professions/warrior/specializations/paragon/mechanics/chant-effects.js';
import { PARAGON_BALANCE_PROFILES } from '#gw2/content/professions/warrior/specializations/paragon/profiles.js';

/** Appends Paragon chant and command trait behavior to their native casts. */
const paragonSkillHandlers = Object.freeze({
  'warrior.chant': augmentSkillHandler(activateChant),
  'warrior.command': augmentSkillHandler(activateCommand)
});

export const paragonModule = defineNativeModule({
  id: 'Paragon',
  data: createWarriorModuleData('Paragon', {
    skillMechanics: PARAGON_SKILL_MECHANICS,
    balanceProfiles: PARAGON_BALANCE_PROFILES
  }),
  state: { scheduler: paragonState.create, resolver: paragonState.create },
  mechanics: {
    modifiers: paragonAttributeRules,
    execution: {
      skillHandlers: paragonSkillHandlers,
      hooks: paragonSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: paragonResolverEventHandlers }
    }
  },
  presentation: paragonUi
});
