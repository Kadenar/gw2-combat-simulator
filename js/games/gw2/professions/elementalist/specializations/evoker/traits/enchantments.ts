import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { elementalistConditionRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import {
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  evokerState,
  expireElectricEnchantments,
  grantElectricEnchantments,
  type EvokerState
} from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
// Materialize Electric Enchantment's strike and condition package for the invoking
// skill while preserving shared event attribution.
export function emitElectricEnchantment(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, TRAIT.GALVANIC_ENCHANTMENT);
  const strike = requireEffect(galvanicEnchantmentProfile, 'strike', 'Galvanic Enchantment');
  const burning = requireEffect(galvanicEnchantmentProfile, 'condition', 'Burning');
  if (strike) {
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          cause: event,
          at: event.at,
          source: 'Electric Enchantment',
          // Skill and trait grants share one consumed enchantment pool; the consuming attack does not own its damage.
          sourceId: 'elementalist.electric-enchantment',
          skillId: event.skillId,
          procType: 'profession',
          icon: ELECTRIC_ENCHANTMENT_ICON,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Electric Enchantment',
          coefficient: Number(strike.coefficient),
          skillWeapon: 'Unequipped'
        },
        emissionCast
      )
    );
  }

  if (burning) {
    context.effects.emit(
      elementalistConditionRequest(
        {
          cause: event,
          at: event.at,
          source: 'Electric Enchantment',
          sourceId: 'elementalist.electric-enchantment',
          skillId: event.skillId,
          procType: 'profession',
          icon: ELECTRIC_ENCHANTMENT_ICON,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Electric Enchantment',
          condition: String(burning.condition),
          stacks: Number(burning.stacks),
          duration: Number(burning.duration)
        },
        emissionCast
      )
    );
  }

  if (strike || burning)
    context.effects.emit(
      elementalistAnnouncement({
        at: event.at,
        name: 'Electric Enchantment',
        procType: 'trait',
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: event.skillName || event.source || '',
        icon: ELECTRIC_ENCHANTMENT_ICON
      })
    );
}

/** Consumes one currently active grant at an accepted hit, preferring the earliest expiry. */
export function consumeElectricEnchantment(
  context: ElementalistRuntime,
  state: EvokerState,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  expireElectricEnchantments(state, context.time);
  const grant = state.electricEnchantmentGrants.find(
    (candidate) => event.at >= canonicalTime(candidate.at) && consumeCharge(candidate, event.at)
  );
  if (grant) emitElectricEnchantment(context, event, emissionCast);
}

/** Familiar completion grants trait enchantments before the skill's resource settlement. */
export function applyGalvanicEnchantment(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = evokerState.from(context);
  const at = cast.effectiveEnd;
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  if (familiarElement && hasTrait(context, TRAIT.GALVANIC_ENCHANTMENT)) {
    const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, TRAIT.GALVANIC_ENCHANTMENT);
    const stacks = balanceProfileNumber(galvanicEnchantmentProfile, 'playerStacks');
    const duration = balanceProfileNumber(galvanicEnchantmentProfile, 'durationMultiplier');
    grantElectricEnchantments(state, at, stacks, duration);
    context.effects.emit(
      elementalistAnnouncement({
        at,
        name: 'Electric Enchantment',
        procType: 'trait',
        sourceId: skill.id,
        sourceSkill: skill.name,
        detail: `+${stacks} stacks`,
        icon: ELECTRIC_ENCHANTMENT_ICON
      })
    );
  }
}
