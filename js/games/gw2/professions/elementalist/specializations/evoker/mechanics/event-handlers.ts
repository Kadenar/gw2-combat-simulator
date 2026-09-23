/**
 * Evoker reactions to events as they are scheduled.
 *
 * The single scheduler subscription that fans out to the attunement recharge
 * policy, the Fire familiar's burning-driven Might, Electric Enchantment
 * consumption, and the Elemental Balance / Elemental Dynamo attunement-entry
 * traits.
 */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { elementalistEventSkill, emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyEvokerAttunementRechargePolicy } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { consumeElectricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Reacts to every newly scheduled event: applies the Evoker attunement recharge
 * policy, procs the Fire familiar's Might on burning, spends an armed Electric
 * Enchantment stack on qualifying player strikes, then handles the
 * attunement-entry traits.
 */
export function onEventScheduled(context: ElementalistSchedulerContext, event: SimulationEvent): void {
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
      emitSkillBuff(context, elementalistEventSkill(context, 'Fire Familiar', sourceId), {
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

  // forward-facing consumption; enchantments.ts covers strikes already queued when the stack was granted
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
      emitElementalistProc(context as never, {
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
