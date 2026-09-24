import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onConditionApplied } from '#gw2/platform/profession-definition/mechanics.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { scourgeSkillHandlers } from '#gw2/professions/necromancer/specializations/scourge/execution/index.js';
import { scourgeResolverEventReactions } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-effects.js';
import {
  scourgeAttributeRules,
  scourgeCastRules,
  scourgeSchedulerHooks
} from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-rules.js';
import { scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { bindScourgeUi } from '#gw2/professions/necromancer/specializations/scourge/presentation.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/scourge/skills/index.js';
import { SCOURGE_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

export const scourgeModule = defineNativeModule({
  id: 'Scourge',
  data: createNecromancerModuleData('Scourge', {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    balanceProfiles: SCOURGE_BALANCE_PROFILES
  }),
  state: { scheduler: scourgeState.create, resolver: scourgeState.create },
  mechanics: {
    modifiers: scourgeAttributeRules,
    execution: {
      skillHandlers: scourgeSkillHandlers,
      castRules: scourgeCastRules,
      hooks: scourgeSchedulerHooks
    },
    resolution: {
      reactions: [
        // Demonic Lore fires on every Torment application; ICD is enforced inside the handler
        onConditionApplied({
          id: 'necromancer.scourge.condition',
          handler: scourgeResolverEventReactions.condition
        })
      ]
    }
  },
  presentation: bindScourgeUi
});
