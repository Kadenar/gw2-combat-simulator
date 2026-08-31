import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import { harbingerResolverEventReactions } from '#gw2/content/professions/necromancer/specializations/harbinger/mechanics/blight-effects.js';
import { harbingerAttributeRules, harbingerCastRules, harbingerSchedulerHooks } from '#gw2/content/professions/necromancer/specializations/harbinger/mechanics/blight-and-shroud.js';
import { harbingerState } from '#gw2/content/professions/necromancer/specializations/harbinger/state.js';
import { harbingerUi } from '#gw2/content/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/specializations/harbinger/skills/index.js';
import { harbingerSkillHandlers } from '#gw2/content/professions/necromancer/specializations/harbinger/skills/execution.js';
import { HARBINGER_BALANCE_PROFILES } from '#gw2/content/professions/necromancer/specializations/harbinger/profiles.js';

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
      reactions: [
        onResolvedDamage({
          id: 'necromancer.harbinger.damage',
          handler: harbingerResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: harbingerUi
});
