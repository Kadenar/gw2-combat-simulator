import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedControl, onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createWarriorModuleData } from '../../data/catalog.js';
import { SPELLBREAKER_SKILL_MECHANICS } from './skills/index.js';
import { spellbreakerSkillHandlers } from './skills/handlers.js';
import { reactToSpellbreakerControl, reactToSpellbreakerDamage } from './mechanics/full-counter-effects.js';
import { spellbreakerAttributeRules, spellbreakerSchedulerHooks } from './mechanics/full-counter-rules.js';
import { spellbreakerState } from './state.js';
import { spellbreakerUi } from './presentation.js';
import { SPELLBREAKER_BALANCE_PROFILES } from './profiles.js';

export const spellbreakerModule = defineNativeModule({
  id: 'Spellbreaker',
  data: createWarriorModuleData('Spellbreaker', {
    skillMechanics: SPELLBREAKER_SKILL_MECHANICS,
    balanceProfiles: SPELLBREAKER_BALANCE_PROFILES
  }),
  state: {
    scheduler: spellbreakerState.create,
    resolver: spellbreakerState.create
  },
  mechanics: {
    modifiers: spellbreakerAttributeRules,
    execution: {
      skillHandlers: spellbreakerSkillHandlers,
      hooks: spellbreakerSchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedControl({
          id: 'warrior.spellbreaker-control',
          handler: reactToSpellbreakerControl
        }),
        onResolvedDamage({
          id: 'warrior.spellbreaker-damage',
          handler: reactToSpellbreakerDamage
        })
      ]
    }
  },
  presentation: spellbreakerUi
});
