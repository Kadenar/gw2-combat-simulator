/**
 * Electric Enchantment (Galvanic Enchantment) payload delivery.
 *
 * Stacks are armed elsewhere - familiar completions and a few Evoker utility
 * skills - and spent here by attaching a strike plus condition package to the
 * player strikes that consume them, marking each consumed strike so it can never
 * be charged twice.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELECTRIC_ENCHANTMENT_ICON } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Materialize Electric Enchantment's strike and condition package for the invoking
// skill while preserving shared event attribution.
function emitElectricEnchantment(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const strike = balanceProfileEffectFromContext(context, PROFILE.galvanicEnchantment, 'strike');
  const burning = balanceProfileEffectFromContext(context, PROFILE.galvanicEnchantment, 'condition');
  emitSkillDamage(context, {
    cause: event,

    at: event.at,
    source: 'Electric Enchantment',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Electric Enchantment',
    coefficient: Number(strike?.coefficient ?? 0.4),
    skillWeapon: 'Unequipped'
  });
  emitSkillCondition(context, {
    cause: event,

    at: event.at,
    source: 'Electric Enchantment',
    sourceId: event.skillId ?? event.sourceId,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Electric Enchantment',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks ?? 1),
    duration: Number(burning?.duration ?? 1.5)
  });
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
  if (state.electricEnchantmentStacks <= 0 || current.electricEnchantmentConsumed === true) return;
  state.electricEnchantmentStacks -= 1;
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
        event.at >= context.effectiveEnd - context.epsilon &&
        event.electricEnchantmentConsumed !== true
    )
    .sort((left, right) => left.at - right.at);
  for (const event of candidates) {
    if (state.electricEnchantmentStacks <= 0) break;
    consumeElectricEnchantment(context, state, event);
  }
}
