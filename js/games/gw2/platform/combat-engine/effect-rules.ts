/**
 * Boon, condition, and weapon rules hard-coded by the pinned reference.
 *
 * These tables mirror `utils/effect_utils.hpp`, `system/effects.cpp`, and
 * `actor/weapon.hpp`. They are shared combat rules rather than profession
 * content: every profession's boons, conditions, and weapon strength ranges go
 * through the same formulas.
 */
import { roundHalfEven } from '#gw2/platform/combat-engine/numeric.js';
import type { Attribute, Effect, Stacking, WeaponType } from '#gw2/platform/combat-engine/configuration.js';

const DURATION_STACKING = new Set<Effect>([
  'AEGIS',
  'ALACRITY',
  'FURY',
  'QUICKNESS',
  'RESOLUTION',
  'RESISTANCE',
  'PROTECTION',
  'REGENERATION',
  'VIGOR',
  'SWIFTNESS',
  'STABILITY',
  'BLINDED',
  'CHILLED',
  'CRIPPLED',
  'FEAR',
  'IMMOBILIZED',
  'SLOW',
  'TAUNT',
  'WEAKNESS'
]);

const INTENSITY_STACKING = new Set<Effect>([
  'MIGHT',
  'BURNING',
  'BLEEDING',
  'TORMENT',
  'POISON',
  'CONFUSION',
  'VULNERABILITY'
]);

const BOONS = new Set<Effect>([
  'AEGIS',
  'ALACRITY',
  'FURY',
  'MIGHT',
  'QUICKNESS',
  'RESOLUTION',
  'RESISTANCE',
  'PROTECTION',
  'REGENERATION',
  'VIGOR',
  'SWIFTNESS',
  'STABILITY'
]);

const DAMAGING = new Set<Effect>(['BURNING', 'BLEEDING', 'TORMENT', 'POISON', 'CONFUSION', 'BINDING_BLADE']);

const SOFT_CONTROL = new Set<Effect>([
  'BLINDED',
  'CHILLED',
  'CRIPPLED',
  'FEAR',
  'IMMOBILIZED',
  'SLOW',
  'TAUNT',
  'WEAKNESS'
]);

export function effectStacking(effect: Effect): Stacking {
  if (DURATION_STACKING.has(effect)) return 'duration';
  if (INTENSITY_STACKING.has(effect)) return 'intensity';
  return 'replace';
}

/** How many instances contribute to attribute modifiers; Might and Vulnerability cap at 25. */
export function maxConsideredStacks(effect: Effect): number {
  if (effect === 'MIGHT' || effect === 'VULNERABILITY') return 25;
  return INTENSITY_STACKING.has(effect) ? 1500 : 1;
}

export function maxEffectDuration(effect: Effect): number {
  if (SOFT_CONTROL.has(effect)) return 10_000;
  if (BOONS.has(effect)) return 30_000;
  return 1_000_000_000;
}

export function isDamagingEffect(effect: Effect): boolean {
  return DAMAGING.has(effect);
}

/** Relative attributes as seen by a source against one target. */
export type AttributeReader = (attribute: Attribute) => number;

const BOON_DURATION_ATTRIBUTE: Partial<Record<Effect, Attribute>> = {
  AEGIS: 'aegis_duration_multiplier',
  ALACRITY: 'alacrity_duration_multiplier',
  FURY: 'fury_duration_multiplier',
  MIGHT: 'might_duration_multiplier',
  QUICKNESS: 'quickness_duration_multiplier',
  RESOLUTION: 'resolution_duration_multiplier',
  RESISTANCE: 'resistance_duration_multiplier',
  PROTECTION: 'protection_duration_multiplier',
  REGENERATION: 'regeneration_duration_multiplier',
  VIGOR: 'vigor_duration_multiplier',
  SWIFTNESS: 'swiftness_duration_multiplier',
  STABILITY: 'stability_duration_multiplier'
};

const CONDITION_DURATION_ATTRIBUTE: Partial<Record<Effect, Attribute>> = {
  BURNING: 'burning_duration_multiplier',
  BLEEDING: 'bleeding_duration_multiplier',
  TORMENT: 'torment_duration_multiplier',
  POISON: 'poison_duration_multiplier',
  CONFUSION: 'confusion_duration_multiplier'
};

/**
 * Applied duration. The generic and specific multipliers do not stack: the
 * larger one applies, capped at +100%, and the result is banker's-rounded.
 */
export function effectiveEffectDuration(baseDuration: number, effect: Effect, source: AttributeReader): number {
  if (effect === 'BINDING_BLADE') return baseDuration;
  const scale = (uniform: number, specific: number) =>
    roundHalfEven(baseDuration * Math.min(2, Math.max(uniform, specific)));

  const boonAttribute = BOON_DURATION_ATTRIBUTE[effect];
  if (boonAttribute) return scale(source('boon_duration_multiplier'), source(boonAttribute));

  const conditionAttribute = CONDITION_DURATION_ATTRIBUTE[effect];
  const specific = conditionAttribute ? source(conditionAttribute) : 1;
  return scale(source('condition_duration_multiplier'), specific);
}

/** One second of a damaging condition before progress scaling, per the reference golem formulas. */
export function conditionDamagePerSecond(effect: Effect, source: AttributeReader, baseMultiplier: number): number {
  const conditionDamage = source('condition_damage');
  switch (effect) {
    case 'BURNING':
      return (131.0 + 0.155 * conditionDamage) * source('burning_damage_multiplier') * baseMultiplier;
    case 'BLEEDING':
      return (22.0 + 0.06 * conditionDamage) * source('bleeding_damage_multiplier') * baseMultiplier;
    case 'TORMENT':
      // Reference limitation: stationary-target torment only.
      return (31.8 + 0.09 * conditionDamage) * source('torment_damage_multiplier') * baseMultiplier;
    case 'POISON':
      return (33.5 + 0.06 * conditionDamage) * source('poison_damage_multiplier') * baseMultiplier;
    case 'CONFUSION':
      // Reference limitation: idle-target confusion only.
      return (18.25 + 0.05 * conditionDamage) * source('confusion_damage_multiplier') * baseMultiplier;
    case 'BINDING_BLADE':
      return 160.0 + 0.3 * source('power');
    default:
      throw new Error(`missing damage formula for effect_type: "${effect}"`);
  }
}

/** Weapon strength ranges from the reference `weapon_type_to_strength_range_map`. */
export const WEAPON_STRENGTH_RANGES: Readonly<Partial<Record<WeaponType, readonly [number, number]>>> = {
  empty_handed: [656, 725],
  greatsword: [1045, 1155],
  longbow: [966, 1134],
  sword: [950, 1050],
  axe: [900, 1100],
  torch: [828, 972],
  scepter: [940, 1060],
  focus: [873, 927],
  kit_conjure: [920, 1017],
  tome: [876, 969],
  dagger: [970, 1030],
  mace: [940, 1060],
  pistol: [920, 1080],
  shield: [846, 954],
  warhorn: [855, 945],
  hammer: [1034, 1166],
  rifle: [1035, 1265],
  shortbow: [950, 1050],
  staff: [1034, 1166],
  aquatic: [950, 1050],
  spear: [950, 1050]
};
