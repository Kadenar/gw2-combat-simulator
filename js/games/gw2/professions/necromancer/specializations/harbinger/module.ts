import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { harbingerSkillHandlers } from '#gw2/professions/necromancer/specializations/harbinger/execution/index.js';
import { harbingerResolverEventReactions } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight-effects.js';
import {
  harbingerAttributeRules,
  harbingerCastRules,
  harbingerSchedulerHooks
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight-and-shroud.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { HARBINGER_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { restoreNecromancerStateSlice } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';

export const harbingerModule = defineNativeModule({
  id: 'Harbinger',
  data: createNecromancerModuleData('Harbinger', {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    balanceProfiles: HARBINGER_BALANCE_PROFILES
  }),
  // Scheduler and resolver share the same state factory because blight stacks must be readable in both phases.
  state: { scheduler: harbingerState.create, resolver: harbingerState.create },
  mechanics: {
    modifiers: harbingerAttributeRules,
    execution: {
      skillHandlers: harbingerSkillHandlers,
      castRules: harbingerCastRules,
      hooks: harbingerSchedulerHooks
    },
    resolution: {
      hooks: {
        eventHandlers: {
          // Passive Blight updates cannot overwrite Core resources or shroud transitions.
          'necromancer.blight': (context: NecromancerResolverContext, event: NecromancerResolverEvent) =>
            restoreNecromancerStateSlice(harbingerState.from(context), event.state || {})
        }
      },
      reactions: [
        onResolvedDamage({
          id: 'necromancer.harbinger.damage',
          handler: harbingerResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: bindHarbingerUi
});
