import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import {
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage
} from '#gw2/integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import { reaperResolverEventReactions } from '#gw2/content/professions/necromancer/specializations/reaper/mechanics/shroud-effects.js';
import {
  reaperAttributeRules,
  reaperCastRules,
  reaperSchedulerHooks
} from '#gw2/content/professions/necromancer/specializations/reaper/mechanics/reaper-shroud.js';
import { reaperState } from '#gw2/content/professions/necromancer/specializations/reaper/state.js';
import { reaperUi } from '#gw2/content/professions/necromancer/specializations/reaper/presentation.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/specializations/reaper/skills/index.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import { REAPER_BALANCE_PROFILES } from '#gw2/content/professions/necromancer/specializations/reaper/profiles.js';

export const reaperModule = defineNativeModule({
  id: 'Reaper',
  data: createNecromancerModuleData('Reaper', {
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    balanceProfiles: REAPER_BALANCE_PROFILES,
    // Shroud autoattack chain runs separately from the out-of-shroud chain; both must be registered.
    autoattackChains: {
      additional: [[ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]]
    }
  }),
  // Reaper adds no persistent specialization state; both phases share the same empty factory.
  state: { scheduler: reaperState.create, resolver: reaperState.create },
  mechanics: {
    modifiers: reaperAttributeRules,
    execution: {
      castRules: reaperCastRules,
      hooks: reaperSchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'necromancer.reaper.damage',
          handler: reaperResolverEventReactions.damage
        }),
        onResolvedControl({
          id: 'necromancer.reaper.control',
          handler: reaperResolverEventReactions.control
        }),
        onConditionApplied({
          id: 'necromancer.reaper.condition',
          handler: reaperResolverEventReactions.condition
        })
      ]
    }
  },
  presentation: reaperUi
});
