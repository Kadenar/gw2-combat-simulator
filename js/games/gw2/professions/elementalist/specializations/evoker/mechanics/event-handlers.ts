/** Evoker trait and enchantment reactions consume actual transitions and accepted impacts. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/live-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { elementalistEventSkill, emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyEvokerAttunementRechargePolicy } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/** Applies familiar, enchantment, and attunement-entry rewards at their actual event boundary. */
export function onAcceptedEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  applyEvokerAttunementRechargePolicy(context, event, state);
  // ignitePassiveReadyAt gates the Fire familiar's Might proc to an ICD; without it every burning tick would trigger
  if (
    event.type === 'condition' &&
    event.condition === 'Burning' &&
    state.element === 'Fire' &&
    isInternalCooldownReady(event.at, state.ignitePassiveReadyAt)
  ) {
    const evocationProfile = requireBalanceProfileFromContext(context, PROFILE.evocation);
    const might = requireEffect(evocationProfile, 'boon', 'Fire Familiar');
    const sourceId = event.skillId ?? event.sourceId;
    if (might) {
      const igniteProfile = requireBalanceProfileFromContext(context, PROFILE.ignite);
      state.ignitePassiveReadyAt = event.at + balanceProfileNumber(igniteProfile, 'pulseInterval');
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Fire Familiar', sourceId),
        at: event.at,
        source: 'Fire Familiar',
        sourceId,
        actorType: 'player',
        kind: String(might.boon).toLowerCase(),
        stacks: Number(might.stacks),
        duration: Number(might.duration),
        skillName: 'Fire Familiar'
      });
    }
  }

  // Spend an enchantment only after the shared runtime accepts this player hit.
  if (event.type === 'damage' && event.actorType === 'player' && Number(event.coefficient) > 0) {
    consumeElectricEnchantment(context, state, event);
  }

  // everything past this point is an attunement-entry trait
  if (event.type !== 'elementalist.attunement' && event.type !== 'elementalist.attunement-enter') {
    return;
  }

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (event.to !== state.element) return;
  if (hasTrait(context, 'Elemental Balance')) {
    state.elementalBalanceProgress += 1;
    const elementalBalanceProfile = requireBalanceProfileFromContext(context, PROFILE.elementalBalance);
    const threshold = balanceProfileNumber(elementalBalanceProfile, 'threshold');
    if (state.elementalBalanceProgress >= threshold) {
      // subtract rather than reset so any overflow from simultaneous gains isn't lost
      state.elementalBalanceProgress -= threshold;
      // Temporary-effect expiry uses the absolute combat tick, including patched durations.
      const duration = balanceProfileNumber(elementalBalanceProfile, 'durationMultiplier');
      state.elementalBalanceUntil = gw2EffectExpiresAt(event.at, duration);
      emitElementalistProc(context, {
        at: event.at,
        name: 'Elemental Balance',
        procType: 'skill',
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: String(event.skillName || event.source || ''),
        detail: `CDR armed (${duration}s)`,
        icon: 'https://wiki.guildwars2.com/images/4/4c/Elemental_Balance.png'
      });
    }
  }

  // Elemental Dynamo turns each entry into familiar charges and reports the new total
  if (!hasTrait(context, 'Elemental Dynamo')) return;
  const elementalDynamoProfile = requireBalanceProfileFromContext(context, PROFILE.elementalDynamo);
  state.charges = Math.min(
    state.maximumCharges,
    state.charges + balanceProfileNumber(elementalDynamoProfile, 'resourceGain')
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
