import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { canonicalTime } from '#kernel/core/clock.js';
/**
 * Electric Enchantment (Galvanic Enchantment) payload delivery.
 *
 * Stacks are armed elsewhere - familiar completions and a few Evoker utility
 * skills - and spent here by attaching a strike plus condition package to the
 * accepted player strikes that consume them. Each accepted impact dispatches once.
 */
import { emitElementalistCondition, emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELECTRIC_ENCHANTMENT_ICON } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  expireElectricEnchantments,
  type EvokerState
} from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Materialize Electric Enchantment's strike and condition package for the invoking
// skill while preserving shared event attribution.
function emitElectricEnchantment(context: ElementalistRuntime, event: SimulationEvent): void {
  const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, PROFILE.galvanicEnchantment);
  const strike = requireEffect(galvanicEnchantmentProfile, 'strike', 'Galvanic Enchantment');
  const burning = requireEffect(galvanicEnchantmentProfile, 'condition', 'Burning');
  if (strike) {
    emitElementalistDamage(context, {
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
    emitElementalistCondition(context, {
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

/** Consumes one currently active grant at an accepted hit, preferring the earliest expiry. */
export function consumeElectricEnchantment(
  context: ElementalistRuntime,
  state: EvokerState,
  event: SimulationEvent
): void {
  expireElectricEnchantments(state, context.time);
  const grant = state.electricEnchantmentGrants.find(
    (candidate) => event.at >= canonicalTime(candidate.at) && consumeCharge(candidate, event.at)
  );
  if (grant) emitElectricEnchantment(context, event);
}
