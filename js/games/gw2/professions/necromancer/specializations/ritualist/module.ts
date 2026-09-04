import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { skillHandler, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { NecromancerCastContext } from '#gw2/professions/necromancer/types.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/catalog/module-data.js';
import {
  ritualistEventHandlers,
  ritualistResolverEventReactions
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import {
  ritualistAttributeRules,
  ritualistCastRules,
  ritualistSchedulerHooks
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits-and-shards.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { ritualistUi } from '#gw2/professions/necromancer/specializations/ritualist/presentation.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { necromancerSpiritSkillHandlers } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { necromancerWeaponSpellSkillHandlers } from '#gw2/professions/necromancer/specializations/ritualist/execution/weapon-spells.js';
import { RITUALIST_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';

/** Runs Ritualist behavior before replacing the corresponding declarative effects. */
function declarativeReplacingHandler(beforeEffects: SkillHandlerPhase<NecromancerCastContext>) {
  return skillHandler<NecromancerCastContext>({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects
  });
}

const ritualistSkillHandlers = new Map([
  ['necromancer.ritualist', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.ritualist'])],
  ['necromancer.innervate', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.innervate'])],
  [
    'necromancer.weapon-spell',
    declarativeReplacingHandler(necromancerWeaponSpellSkillHandlers['necromancer.weapon-spell'])
  ]
]);

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
