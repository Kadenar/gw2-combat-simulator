import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import { ritualistEventHandlers, ritualistResolverEventReactions } from '#gw2/content/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import {
  ritualistAttributeRules,
  ritualistCastRules,
  ritualistSchedulerHooks
} from '#gw2/content/professions/necromancer/specializations/ritualist/mechanics/spirits-and-shards.js';
import { ritualistState } from '#gw2/content/professions/necromancer/specializations/ritualist/state.js';
import { ritualistUi } from '#gw2/content/professions/necromancer/specializations/ritualist/presentation.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/specializations/ritualist/skills/index.js';
import { ritualistSkillHandlers } from '#gw2/content/professions/necromancer/specializations/ritualist/skills/execution.js';
import { RITUALIST_BALANCE_PROFILES } from '#gw2/content/professions/necromancer/specializations/ritualist/profiles.js';

export const ritualistModule = defineNativeModule({
  id: 'Ritualist',
  data: createNecromancerModuleData('Ritualist', {
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS,
    balanceProfiles: RITUALIST_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent state instance; they do not share the same object
  state: { scheduler: ritualistState.create, resolver: ritualistState.create },
  mechanics: {
    modifiers: ritualistAttributeRules,
    execution: {
      skillHandlers: ritualistSkillHandlers,
      castRules: ritualistCastRules,
      hooks: ritualistSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: ritualistEventHandlers },
      reactions: [
        onResolvedDamage({
          id: 'necromancer.ritualist.damage',
          handler: ritualistResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: ritualistUi
});
