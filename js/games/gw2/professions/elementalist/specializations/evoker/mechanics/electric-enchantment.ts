import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
/** Electric Enchantment owns its shared identity, charge lifecycle, combat payload, and damage preview. */
import { activeChargeGrants, consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import type { DamageEffectDefinition } from '#gw2/platform/skill-damage/types.js';

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

/**
 * Each grant retains its own expiry and owner; its announcement identifies the skill that supplied the charges. A trait
 * grant names its trait, so only the charges it supplied make their consumption trait-owned.
 */
export function grantElectricEnchantments(
  context: ElementalistRuntime,
  {
    at,
    stacks,
    duration,
    skill,
    traitId
  }: {
    at: number;
    stacks: number;
    duration: number;
    skill: Pick<Skill, 'id' | 'name'>;
    traitId?: SkillId;
  }
): void {
  const state = evokerState.from(context);
  state.electricEnchantmentGrants.push({
    ...grantCharges(stacks, gw2EffectExpiresAt(at, duration)),
    at: canonicalTime(at),
    ...(traitId == null ? {} : { traitId })
  });
  expireElectricEnchantments(state, at);
  announceElectricEnchantment(context, {
    at,
    procType: traitId == null ? 'skill' : 'trait',
    sourceId: skill.id,
    sourceSkill: skill.name,
    detail: `+${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`
  });
}

/**
 * Materialize Electric Enchantment's strike and condition package for the invoking skill while preserving shared event
 * attribution. The payload profile is authored under Galvanic Enchantment, but the enchantment is an Evoker mechanic:
 * only a charge Galvanic Enchantment granted carries its trait ownership, so familiar charges never read as trait procs.
 */
function emitElectricEnchantment(context: ElementalistRuntime, event: SimulationEvent, traitId?: SkillId): void {
  // Charge admission is stateful; the profile owns both payloads and their authored strike rules.
  const profile = requireBalanceProfileFromContext(context, TRAIT.GALVANIC_ENCHANTMENT);
  const strike = requireEffect(profile, 'strike', 'Galvanic Enchantment');
  const burning = requireEffect(profile, 'condition', CONDITION.BURNING);
  const attribution = {
    source: electricEnchantment.name,
    sourceId: electricEnchantment.sourceId,
    actorType: ACTOR.EFFECT,
    ownerActorType: ACTOR.PLAYER,
    skillId: event.skillId,
    skillName: electricEnchantment.name,
    icon: electricEnchantment.icon
  };
  // Attribution is reapplied after materialization so authored effect fields cannot replace the enchantment identity.
  const owned = (packet: SimulationEventBase, name: string): SimulationEventBase => ({
    ...packet,
    ...attribution,
    name,
    procType: 'profession',
    ...(traitId == null ? {} : { traitId })
  });

  if (strike)
    context.effects.emit({
      kind: 'profile',
      profile,
      effects: [strike],
      at: event.at,
      fullEnd: event.at,
      skillWeaponFallback: 'Unequipped',
      cause: event,
      attribution: { ...attribution, activationId: context.combat.allocateEffectActivation('elementalist.effect:') },
      transform: (packet) => owned(packet, electricEnchantment.name)
    });

  if (burning)
    context.effects.emit({
      kind: 'profile',
      profile,
      effects: [burning],
      at: event.at,
      fullEnd: event.at,
      cause: event,
      attribution: { ...attribution, activationId: event.activationId },
      transform: (packet) => owned(packet, electricEnchantment.name + ' — ' + packet.condition)
    });

  if (strike || burning)
    announceElectricEnchantment(context, {
      at: event.at,
      procType: 'trait',
      sourceId: event.skillId ?? event.sourceId,
      sourceSkill: event.skillName || event.source || ''
    });
}

/** Consumes one currently active grant at an accepted hit, preferring the earliest expiry. */
export function consumeElectricEnchantment(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  expireElectricEnchantments(state, context.time);
  const grant = state.electricEnchantmentGrants.find(
    (candidate) => event.at >= canonicalTime(candidate.at) && consumeCharge(candidate, event.at)
  );

  if (grant) emitElectricEnchantment(context, event, grant.traitId);
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
