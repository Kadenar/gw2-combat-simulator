import {
  applyEvocationBurning,
  applyEvokerEntryTraits
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
/** Evoker trait and enchantment reactions consume actual transitions and accepted impacts. */
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { applyEvokerAttunementRechargePolicy } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/traits/enchantments.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
/** Applies familiar, enchantment, and attunement-entry rewards at their actual event boundary. */
export function onAcceptedEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  applyEvokerAttunementRechargePolicy(context, event, state);
  applyEvocationBurning(context, event, undefined);
  // Spend an enchantment only after the shared runtime accepts this player hit.
  if (event.type === 'damage' && event.actorType === 'player' && Number(event.coefficient) > 0) {
    consumeElectricEnchantment(context, state, event, undefined);
  }

  applyEvokerEntryTraits(context, event);
}
