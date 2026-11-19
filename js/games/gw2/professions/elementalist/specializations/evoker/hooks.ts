import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { evokerBuffPolicies } from '#gw2/professions/elementalist/specializations/evoker/effect-state.js';
import {
  electricEnchantment,
  electricEnchantmentDamageEffect
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  applyCalcifyProtection,
  onAcceptedEvent
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { evokerFamiliarLifecycle } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { evokerInitialized } from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Familiar casts own pending packets; accepted impacts spend enchantments in chronological order. */
export const evokerHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  evokerFamiliarLifecycle,
  {
    buffPolicies: (runtime) => evokerBuffPolicies(runtime.helpers),
    // Each unspent enchantment retains the expiry of the grant it came from.
    observeEffects(runtime) {
      const grants = evokerState.from(runtime.profession).electricEnchantmentGrants;
      return [
        timedEffectState(
          electricEnchantment.id,
          grants.map(({ count, expiresAt }) => ({ stacks: count, expiresAt })),
          null,
          { name: electricEnchantment.name }
        )
      ];
    },
    damageEffects: [electricEnchantmentDamageEffect],

    initialize(runtime) {
      runtime.fireTrigger(evokerInitialized);
    },
    reactions: {
      'damage.resolved': onAcceptedEvent,
      'condition.applied': onAcceptedEvent,
      'control.resolved': applyCalcifyProtection
    }
  }
]);
