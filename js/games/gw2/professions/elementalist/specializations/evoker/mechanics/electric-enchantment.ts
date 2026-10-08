/** Electric Enchantment owns its shared identity, charge lifecycle, combat payload, and damage preview. */
import { activeChargeGrants, consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import type { DamageEffectDefinition } from '#gw2/platform/skill-damage/types.js';
import { elementalistConditionRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

// Combat packets, announcements, and the preview share one identity independently of the granting skill or trait.
const electricEnchantment = Object.freeze({
  id: 'electric-enchantment',
  sourceId: 'elementalist.electric-enchantment',
  name: 'Electric Enchantment',
  icon: 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png'
});

/** Announcements retain the granting or consuming skill while using the enchantment's presentation. */
function announceElectricEnchantment(
  context: ElementalistRuntime,
  announcement: Omit<Parameters<typeof elementalistAnnouncement>[0], 'name' | 'icon'>
): void {
  context.effects.emit(
    elementalistAnnouncement({
      ...announcement,
      name: electricEnchantment.name,
      icon: electricEnchantment.icon
    })
  );
}

/** Discards spent or expired grants at the scheduler clock, preserving future queued-hit eligibility. */
function expireElectricEnchantments(state: EvokerState, at: number): void {
  state.electricEnchantmentGrants = activeChargeGrants(state.electricEnchantmentGrants, at);
}

/** Each grant retains its own expiry; its announcement identifies the skill that supplied the charges. */
export function grantElectricEnchantments(
  context: ElementalistRuntime,
  {
    at,
    stacks,
    duration,
    skill,
    procType
  }: {
    at: number;
    stacks: number;
    duration: number;
    skill: Pick<Skill, 'id' | 'name'>;
    procType: 'trait' | 'skill';
  }
): void {
  const state = evokerState.from(context);
  state.electricEnchantmentGrants.push({
    ...grantCharges(stacks, gw2EffectExpiresAt(at, duration)),
    at: canonicalTime(at)
  });
  expireElectricEnchantments(state, at);
  announceElectricEnchantment(context, {
    at,
    procType,
    sourceId: skill.id,
    sourceSkill: skill.name,
    detail: `+${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`
  });
}

// Materialize Electric Enchantment's strike and condition package for the invoking
// skill while preserving shared event attribution.
function emitElectricEnchantment(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  // The enchantment owns damage; the consuming skill remains available as its trigger.
  const attribution = {
    source: electricEnchantment.name,
    sourceId: electricEnchantment.sourceId,
    skillId: event.skillId,
    procType: 'profession' as const,
    icon: electricEnchantment.icon,
    actorType: 'effect' as const,
    ownerActorType: 'player' as const,
    skillName: electricEnchantment.name
  };
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
          ...attribution,
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
          ...attribution,
          condition: String(burning.condition),
          stacks: Number(burning.stacks),
          duration: Number(burning.duration)
        },
        emissionCast
      )
    );
  }

  if (strike || burning)
    announceElectricEnchantment(context, {
      at: event.at,
      procType: 'trait',
      sourceId: event.skillId ?? event.sourceId,
      sourceSkill: event.skillName || event.source || ''
    });
}

/** Consumes one currently active grant at an accepted hit, preferring the earliest expiry. */
export function consumeElectricEnchantment(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const state = evokerState.from(context);
  expireElectricEnchantments(state, context.time);
  const grant = state.electricEnchantmentGrants.find(
    (candidate) => event.at >= canonicalTime(candidate.at) && consumeCharge(candidate, event.at)
  );
  if (grant) emitElectricEnchantment(context, event, emissionCast);
}

/** Preview executes the combat payload directly, without requiring or spending a live charge. */
export const electricEnchantmentDamageEffect = Object.freeze<DamageEffectDefinition>({
  id: electricEnchantment.id,
  name: electricEnchantment.name,
  icon: electricEnchantment.icon,
  source: 'Profession',
  unit: 'charge',
  sourceIds: [electricEnchantment.sourceId],
  emit: (runtime) => emitElectricEnchantment(runtime, damageInputEvent(runtime))
});
