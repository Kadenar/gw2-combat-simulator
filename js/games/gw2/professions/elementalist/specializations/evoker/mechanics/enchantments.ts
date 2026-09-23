import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { canonicalTime } from '#kernel/core/clock.js';
/**
 * Electric Enchantment (Galvanic Enchantment) payload delivery.
 *
 * Stacks are armed elsewhere - familiar completions and a few Evoker utility
 * skills - and spent here by attaching a strike plus condition package to the
 * player strikes that consume them, marking each consumed strike so it can never
 * be charged twice.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELECTRIC_ENCHANTMENT_ICON } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  expireElectricEnchantments,
  type EvokerState
} from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Materialize Electric Enchantment's strike and condition package for the invoking
// skill while preserving shared event attribution.
function emitElectricEnchantment(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, PROFILE.galvanicEnchantment);
  const strike = requireEffect(galvanicEnchantmentProfile, 'strike', 'Galvanic Enchantment');
  const burning = requireEffect(galvanicEnchantmentProfile, 'condition', 'Burning');
  if (strike) {
    emitSkillDamage(context, {
      cause: event,

      at: event.at,
      source: 'Electric Enchantment',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Electric Enchantment',
      coefficient: Number(strike.coefficient),
      skillWeapon: 'Unequipped'
    });
  }

  if (burning) {
    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      source: 'Electric Enchantment',
      sourceId: event.skillId ?? event.sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Electric Enchantment',
      condition: String(burning.condition),
      stacks: Number(burning.stacks),
      duration: Number(burning.duration)
    });
  }

  if (strike || burning)
    emitElementalistProc(context as never, {
      at: event.at,
      name: 'Electric Enchantment',
      procType: 'trait',
      sourceId: event.skillId ?? event.sourceId,
      sourceSkill: String(event.skillName || event.source || ''),
      icon: ELECTRIC_ENCHANTMENT_ICON
    });
}

/** Marks the canonical hit before emission so repeated or reentrant processing cannot spend it twice. */
export function consumeElectricEnchantment(
  context: ElementalistSchedulerContext,
  state: EvokerState,
  event: SimulationEvent
): void {
  const current = context.eventByOrder(Number(event.eventOrder)) || event;
  // Scheduling a far-future packet must not expire charges still usable by an earlier, later-scheduled strike.
  expireElectricEnchantments(state, Math.min(context.state.time, current.at));
  if (current.electricEnchantmentConsumed === true) return;
  // The eligible grant owns spending; no separate total needs to stay synchronized.
  const grant = state.electricEnchantmentGrants.find(
    (candidate) => current.at >= canonicalTime(candidate.at) && consumeCharge(candidate, current.at)
  );
  if (!grant) return;
  context.replaceEvent(current, { electricEnchantmentConsumed: true });
  emitElectricEnchantment(context, current);
}

/**
 * Spends armed stacks on already-queued player strikes at or after the grant's
 * completion time, earliest first. Earlier hits cannot consume newly granted
 * stacks, even when they were scheduled during the same cast.
 */
export function applyElectricEnchantmentsRetrospectively(context: ElementalistCastContext, state: EvokerState): void {
  // electricEnchantmentConsumed prevents double-consuming the same hit if this runs twice
  // sorted chronologically so the earliest hits in the window consume stacks first
  const candidates = context.events
    .filter(
      (event) =>
        event.type === 'damage' &&
        event.actorType === 'player' &&
        Number(event.coefficient || 0) > 0 &&
        event.at >= canonicalTime(context.effectiveEnd) &&
        event.electricEnchantmentConsumed !== true
    )
    .sort((left, right) => left.at - right.at);
  for (const event of candidates) {
    if (!state.electricEnchantmentGrants.some((grant) => grant.charges > 0)) break;
    consumeElectricEnchantment(context, state, event);
  }
}
