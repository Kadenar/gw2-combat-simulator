import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { skillHandler, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { createNecromancerModuleData } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import { harbingerResolverEventReactions } from '#gw2/content/professions/necromancer/specializations/harbinger/mechanics/blight-effects.js';
import {
  harbingerAttributeRules,
  harbingerCastRules,
  harbingerSchedulerHooks
} from '#gw2/content/professions/necromancer/specializations/harbinger/mechanics/blight-and-shroud.js';
import { harbingerState } from '#gw2/content/professions/necromancer/specializations/harbinger/state.js';
import { harbingerUi } from '#gw2/content/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/specializations/harbinger/skills/index.js';
import { necromancerBlightSkillHandlers } from '#gw2/content/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { darkBarrage } from '#gw2/content/professions/necromancer/specializations/harbinger/skills/dark-barrage.js';
import { darkBarrageHandlerMode } from '#gw2/content/professions/necromancer/specializations/harbinger/traits/index.js';
import { HARBINGER_BALANCE_PROFILES } from '#gw2/content/professions/necromancer/specializations/harbinger/profiles.js';

/** Materializes Harbinger skills whose runtime state replaces declarative packets. */
const harbingerSkillHandlers = new Map([
  [
    'necromancer.elixir',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
      beforeEffects: necromancerBlightSkillHandlers['necromancer.elixir']
    })
  ],
  [
    'necromancer.blight-skill',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
      beforeEffects: necromancerBlightSkillHandlers['necromancer.blight-skill']
    })
  ],
  [
    'necromancer.dark-barrage',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: darkBarrageHandlerMode,
      beforeEffects: darkBarrage
    })
  ]
]);

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
