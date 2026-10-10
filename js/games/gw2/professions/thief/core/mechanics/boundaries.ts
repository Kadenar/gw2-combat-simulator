import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/**
 * Thief Core trigger points. They live in this leaf module because the owning mechanics also read trait value queries,
 * and trait files must be able to name a point without importing those mechanics.
 */

/** An accepted steal, or a specialization replacement accepted at its own boundary. */
export interface StealAcceptance {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** Every steal variant applies the on-steal traits in this cross-line order, before stolen-skill acquisition. */
export const stealAccepted = defineTriggerPoint<StealAcceptance>('thief.steal-accepted', [
  TRAIT.SERPENTS_TOUCH,
  TRAIT.MUG,
  TRAIT.EVEN_THE_ODDS,
  TRAIT.DEADLY_AMBUSH,
  TRAIT.THRILL_OF_THE_CRIME,
  TRAIT.BOUNTIFUL_THEFT,
  TRAIT.SLEIGHT_OF_HAND,
  TRAIT.HIDDEN_THIEF
]);

/** A completed steal whose stolen skills or artifacts are already stored; `swipe` marks an Antiquary Swipe. */
export interface StealCompletion {
  readonly at: number;
  readonly swipe?: boolean;
}

/**
 * Antiquary fires this Core point after Swipe's pilfer, where Improvisation reduces utility recharge before
 * Kleptomaniac's initiative; specializations add their own rewards afterwards.
 */
export const stealCompleted = defineTriggerPoint<StealCompletion>('thief.steal-completed', [
  TRAIT.IMPROVISATION,
  TRAIT.KLEPTOMANIAC
]);

/** A committed cast at the deferred completion owner, with the initiative cost captured from its accepted skill. */
export interface ThiefCastCompletion {
  readonly cast: RuntimeCast<ThiefSkill>;
  readonly initiativeCost: number;
}

/**
 * Completion stays deferred so these traits follow the packets they already follow: dodges grant Upper Hand, spent
 * initiative grants Lead Attacks, then movement skills open Fluid Strikes and grant Hard to Catch.
 */
export const thiefCastCompleted = defineTriggerPoint<ThiefCastCompletion>('thief.cast-completed', [
  TRAIT.UPPER_HAND,
  TRAIT.LEAD_ATTACKS,
  TRAIT.FLUID_STRIKES,
  TRAIT.HARD_TO_CATCH
]);

/** A committed stealth attack at the deferred completion owner. */
export interface StealthAttackCompletion {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** The stealth attack's Vulnerability precedes swap and completion rewards. */
export const stealthAttackCompleted = defineTriggerPoint<StealthAttackCompletion>('thief.stealth-attack-completed', [
  TRAIT.SUNDERING_SHADE
]);

/** A signet activation whose cast completed; an interrupted activation never reaches this point. */
export interface SignetCompletion {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** Signets of Power grants initiative at cast end, so an interrupted signet grants nothing. */
export const signetCompleted = defineTriggerPoint<SignetCompletion>('thief.signet-completed', [TRAIT.SIGNETS_OF_POWER]);

/** A completed weapon swap, after the Thief stands up. */
export interface ThiefWeaponSwap {
  readonly at: number;
}

/** Quick Pockets grants in-combat initiative once per its cooldown. */
export const thiefWeaponSwapped = defineTriggerPoint<ThiefWeaponSwap>('thief.weapon-swapped', [TRAIT.QUICK_POCKETS]);

/** An accepted dodge, at takeoff; the runtime has already paid its endurance. */
export interface ThiefDodge {
  readonly cast: RuntimeCast<ThiefSkill>;
}

/** Uncatchable queues its caltrops from the dodge's takeoff. */
export const thiefDodgeStarted = defineTriggerPoint<ThiefDodge>('thief.dodge-started', [TRAIT.UNCATCHABLE]);

/** A landed strike after stealth-breaking handling, with its resolved critical fact. */
export interface ThiefStrike {
  readonly cause: Gw2ResolverEvent;
  readonly details: NativeResolvedDamageDetails;
}

/**
 * Critical Fury traits share the resolved critical fact and random stream, then Deadly Ambition poisons dual attacks;
 * all of this precedes venom consumption.
 */
export const thiefStruck = defineTriggerPoint<ThiefStrike>('thief.strike', [
  TRAIT.UNRELENTING_STRIKES,
  TRAIT.NO_QUARTER,
  TRAIT.DEADLY_AMBITION
]);

/** The aggregate venom consumption of one strike. */
export interface VenomConsumption {
  readonly cause: Gw2ResolverEvent;
  readonly consumed: number;
}

/** Multiple venom types share one Leeching Venoms siphon per strike, before Panic Strike checks its threshold. */
export const venomsConsumed = defineTriggerPoint<VenomConsumption>('thief.venoms-consumed', [
  TRAIT.LEECHING_VENOMS,
  TRAIT.PANIC_STRIKE
]);

/** An applied condition. */
export interface ThiefConditionApplication {
  readonly cause: Gw2ResolverEvent;
}

/** Player and allied venom paths stay distinguishable: Lotus Poison, allied Leeching Venoms, then Panic Strike. */
export const thiefConditionApplied = defineTriggerPoint<ThiefConditionApplication>('thief.condition-applied', [
  TRAIT.LOTUS_POISON,
  TRAIT.LEECHING_VENOMS,
  TRAIT.PANIC_STRIKE
]);

/** A stealth transition, with the skill that caused it. */
export interface StealthTransition {
  readonly skill: ThiefSkill;
  readonly at: number;
}

/** Entering stealth grants initiative and Spider charges before Cloaked in Shadow blinds. */
export const stealthEntered = defineTriggerPoint<StealthTransition>('thief.stealth-entered', [
  TRAIT.SHADOWS_REJUVENATION,
  TRAIT.LEECHING_VENOMS,
  TRAIT.CLOAKED_IN_SHADOW
]);

/** Breaking stealth grants initiative and Spider charges before Revealed applies. */
export const stealthExited = defineTriggerPoint<StealthTransition>('thief.stealth-exited', [
  TRAIT.SHADOWS_REJUVENATION,
  TRAIT.LEECHING_VENOMS
]);
