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
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { elementalistProfiledBuffRequest } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/** Accepted player disables trigger the equipped Earth familiar's personal boon at most once per interval. */
export function applyCalcifyProtection(context: ElementalistRuntime, event: SimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player' || evokerState.from(context).element !== 'Earth') return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.calcify);
  if (!requireEffect(profile, 'boon', 'Protection')) return;
  if (
    !context.procs.claimCooldown(
      'elementalist.evoker.calcifyPassive',
      event.at,
      balanceProfileNumber(profile, 'internalCooldown')
    )
  )
    return;
  context.effects.emit(
    elementalistProfiledBuffRequest(context, event.at, PROFILE.calcify, 'Protection', 'Calcify', ID.CALCIFY)
  );
}

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
