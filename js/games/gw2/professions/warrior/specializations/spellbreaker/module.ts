import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedControl, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/catalog/module-data.js';
import { SPELLBREAKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/spellbreaker/skills/index.js';
import { spellbreakerSkillHandlers } from '#gw2/professions/warrior/specializations/spellbreaker/execution/index.js';
import {
  reactToSpellbreakerControl,
  reactToSpellbreakerDamage
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';
import {
  spellbreakerAttributeRules,
  spellbreakerSchedulerHooks
} from '#gw2/professions/warrior/specializations/spellbreaker/mechanics/full-counter-rules.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spellbreakerUi } from '#gw2/professions/warrior/specializations/spellbreaker/presentation.js';
import { SPELLBREAKER_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';

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
