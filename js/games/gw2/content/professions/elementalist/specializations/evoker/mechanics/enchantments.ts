/**
 * Electric Enchantment (Galvanic Enchantment) payload delivery.
 *
 * Stacks are armed elsewhere - familiar completions and a few Evoker utility
 * skills - and spent here by attaching a strike plus condition package to the
 * player strikes that consume them, marking each consumed strike so it can never
 * be charged twice.
 */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  ElementalistCastContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import { emitElementalistProc } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { elementalistBalanceEffect } from '#gw2/content/professions/elementalist/core/profiles.js';
import { ELECTRIC_ENCHANTMENT_ICON } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { type EvokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/evoker/profiles.js';

// Materialize Electric Enchantment's strike and control package for the invoking
// skill while preserving shared event attribution.
export function emitElectricEnchantment(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const strike = elementalistBalanceEffect(context, PROFILE.galvanicEnchantment, 'strike');
  const burning = elementalistBalanceEffect(context, PROFILE.galvanicEnchantment, 'condition');
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

/**
 * Retroactively spends armed stacks on already-scheduled player strikes,
 * earliest first, covering stacks granted after those strikes were queued. Stops
 * as soon as the stack pool runs out.
 */
export function materializeArmedElectricEnchantments(context: ElementalistCastContext, state: EvokerState): void {
  // electricEnchantmentConsumed prevents double-consuming the same hit if this runs twice
  // sorted chronologically so the earliest hits in the window consume stacks first
  const candidates = context.events
    .filter(
      (event) =>
        event.type === 'damage' &&
        event.actorType === 'player' &&
        Number(event.coefficient || 0) > 0 &&
        event.at >= Number(context.combatStartTime || 0) - context.epsilon &&
        event.electricEnchantmentConsumed !== true
    )
    .sort((left, right) => left.at - right.at);
  for (const event of candidates) {
    if (state.electricEnchantmentStacks <= 0) break;
    state.electricEnchantmentStacks -= 1;
    context.replaceEvent(event, { electricEnchantmentConsumed: true });
    emitElectricEnchantment(context, event);
  }
}
