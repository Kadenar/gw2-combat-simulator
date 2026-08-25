import { hasTrait as hasGw2Trait } from '../../../../platform/gw2/combat/state/traits.js';
import type { SimulationEvent } from '../../../../platform/engine/types.js';
import type { ElementalistSchedulerContext } from '../../types.js';
import { emitElementalistBuff, emitElementalistProc } from '../../core/mechanics.js';
import { elementalistBalanceEffect, elementalistBalanceValue } from '../../core/profiles.js';
import { applyEvokerAttunementRechargePolicy } from './attunements.js';
import { emitElectricEnchantment } from './enchantments.js';
import { evokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function onEventScheduled(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = evokerState.from(context);
  applyEvokerAttunementRechargePolicy(context, event, state);
  // ignitePassiveReadyAt gates the Fire familiar's Might proc to an ICD; without it every burning tick would trigger
  if (
    event.type === 'condition' &&
    event.condition === 'Burning' &&
    state.element === 'Fire' &&
    state.ignitePassiveReadyAt <= event.at + context.epsilon
  ) {
    state.ignitePassiveReadyAt = event.at + elementalistBalanceValue(context, PROFILE.ignite, 'pulseInterval', 1);
    const might = elementalistBalanceEffect(context, PROFILE.evocation, 'boon', 'Fire Familiar');
    emitElementalistBuff(
      context as never,
      event.at,
      String(might?.boon || 'Might'),
      Number(might?.stacks ?? 1),
      Number(might?.duration ?? 6),
      'Fire Familiar',
      event.skillId ?? event.sourceId
    );
  }

  if (event.type === 'damage' && event.actorType === 'player' && Number(event.coefficient) > 0) {
    if (state.electricEnchantmentStacks > 0) {
      state.electricEnchantmentStacks -= 1;
      context.replaceEvent(event, { electricEnchantmentConsumed: true });
      emitElectricEnchantment(context, event);
    }
  }

  if (event.type !== 'elementalist.attunement' && event.type !== 'elementalist.attunement-enter') {
    return;
  }

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (event.to !== state.element) return;
  if (hasTrait(context, 'Elemental Balance')) {
    state.elementalBalanceProgress += 1;
    const threshold = elementalistBalanceValue(context, PROFILE.elementalBalance, 'threshold', 2);
    if (state.elementalBalanceProgress >= threshold) {
      // subtract rather than reset so any overflow from simultaneous gains isn't lost
      state.elementalBalanceProgress -= threshold;
      state.elementalBalanceUntil =
        event.at + elementalistBalanceValue(context, PROFILE.elementalBalance, 'durationMultiplier', 5);
      emitElementalistProc(context as never, {
        at: event.at,
        name: 'Elemental Balance',
        procType: 'skill',
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: String(event.skillName || event.source || ''),
        detail: 'CDR armed (5s)',
        icon: 'https://wiki.guildwars2.com/images/4/4c/Elemental_Balance.png'
      });
    }
  }

  if (!hasTrait(context, 'Elemental Dynamo')) return;
  state.charges = Math.min(
    state.maximumCharges,
    state.charges + elementalistBalanceValue(context, PROFILE.elementalDynamo, 'resourceGain', 1)
  );
  context.emitDerived(event, {
    type: 'resource',
    at: event.at,
    source: 'Elemental Dynamo',
    sourceId: event.sourceId,
    actorType: 'player',
    skillName: 'Elemental Dynamo',
    kind: 'evoker-charges',
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered
  });
}
