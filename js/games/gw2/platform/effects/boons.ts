/** Canonical boon names shared by authored effects, combat rules, and presentation. */
export const BOON = Object.freeze({
  AEGIS: 'Aegis',
  ALACRITY: 'Alacrity',
  FURY: 'Fury',
  MIGHT: 'Might',
  PROTECTION: 'Protection',
  QUICKNESS: 'Quickness',
  REGENERATION: 'Regeneration',
  RESISTANCE: 'Resistance',
  RESOLUTION: 'Resolution',
  STABILITY: 'Stability',
  SWIFTNESS: 'Swiftness',
  VIGOR: 'Vigor'
});

export type BoonName = (typeof BOON)[keyof typeof BOON];

/** Runtime boon storage uses lowercase keys while effect declarations and labels use canonical names. */
export function boonKey<T extends BoonName>(name: T): Lowercase<T> {
  return name.toLowerCase() as Lowercase<T>;
}
