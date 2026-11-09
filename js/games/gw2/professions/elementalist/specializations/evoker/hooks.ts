import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { registerElementalistAttunementTransition } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { registerElementalistEliteEvents } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { evokerBuffPolicies } from '#gw2/professions/elementalist/specializations/evoker/effect-state.js';
import { completeEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { electricEnchantmentDamageEffect } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  applyCalcifyProtection,
  onAcceptedEvent
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { evokerFamiliarLifecycle } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { evokerInitialized } from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/** Familiar casts own pending packets; accepted impacts spend enchantments in chronological order. */
export const evokerHooks = composeRuntimeHooks<ElementalistRuntimeState, ElementalistSkill>([
  evokerFamiliarLifecycle,
  {
    buffPolicies: (runtime) => evokerBuffPolicies(runtime.helpers),
    damageEffects: [electricEnchantmentDamageEffect],

    initialize(runtime) {
      runtime.fireTrigger(evokerInitialized);
      registerElementalistEliteEvents(runtime, onAcceptedEvent);
      registerElementalistAttunementTransition(runtime, (context, cast) => {
        completeEvokerAttunement(context, cast, cast.skill);
      });
    },
    reactions: {
      'damage.resolved': onAcceptedEvent,
      'condition.applied': onAcceptedEvent,
      'control.resolved': applyCalcifyProtection
    }
  }
]);
