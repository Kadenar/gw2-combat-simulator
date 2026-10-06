/**
 * Canonical level-80 ascended/legendary PvE weapon-strength profiles, their ID and weapon-name lookups, and sampling.
 * It has no runtime imports, so event and effect validation can check profile IDs without loading loadout or ownership
 * code; choosing a packet's profile belongs to resolver/weapon-strength-resolution.ts.
 *
 * Bounds are the only stored source data. Midpoints and half-ranges are always derived so every consumer stays
 * consistent with the sampled ranges.
 */

import type { Gw2WeaponStrengthProfile } from '#gw2/platform/equipment/weapons/types.js';

const PROFILE_ROWS: ReadonlyArray<readonly [string, number, number]> = Object.freeze([
  ['weapon.axe', 900, 1100],
  ['weapon.dagger', 970, 1030],
  ['weapon.mace', 940, 1060],
  ['weapon.pistol', 920, 1080],
  ['weapon.scepter', 940, 1060],
  ['weapon.sword', 950, 1050],
  ['weapon.focus', 873, 927],
  ['weapon.shield', 846, 954],
  ['weapon.torch', 828, 972],
  ['weapon.warhorn', 855, 945],
  ['weapon.greatsword', 1045, 1155],
  ['weapon.hammer', 1034, 1166],
  ['weapon.longbow', 966, 1134],
  ['weapon.rifle', 1035, 1265],
  ['weapon.shortbow', 950, 1050],
  ['weapon.spear', 950, 1050],
  ['weapon.staff', 1034, 1166],
  ['nonweapon.unequipped', 656, 725],
  ['nonweapon.profession-mechanic', 1034, 1166],
  ['summon.weapon-type-1', 2427, 2680],
  // Storm Spirit has its own observed range while sharing type 1's midpoint.
  ['summon.storm-spirit', 2426, 2681],
  ['summon.weapon-type-2', 2706, 3050],
  ['summon.weapon-type-3', 2448, 3050],
  ['bundle.exotic', 876, 969],
  ['bundle.ascended', 920, 1017],
  ['transform.radiant-forge', 954, 1076],
  ['transform.rampage', 726, 819],
  ['transform.photon-forge', 954, 1076],
  ['transform.celestial-avatar', 580, 654],
  ['transform.cyclone-bow', 954, 1076],
  ['transform.shadow-shroud', 1002, 1129],
  ['transform.lich-form', 726, 819],
  ['transform.death-shroud', 1034, 1166],
  ['transform.reaper-shroud', 1002, 1129],
  ['transform.harbinger-shroud', 1034, 1166],
  ['transform.ritualist-shroud', 1034, 1166]
]);

function defineProfile(rawId: unknown, rawMin: unknown, rawMax: unknown): Readonly<Gw2WeaponStrengthProfile> {
  const id = String(rawId || '');
  const min = Number(rawMin);
  const max = Number(rawMax);
  if (!id) throw new TypeError('Weapon-strength profiles require an ID.');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new TypeError(`Weapon-strength profile ${id} has invalid bounds.`);
  }

  return Object.freeze({ id, min, max });
}

export const WEAPON_STRENGTH_PROFILES: Readonly<Record<string, Readonly<Gw2WeaponStrengthProfile>>> = Object.freeze(
  Object.fromEntries(
    PROFILE_ROWS.map(([id, min, max]) => {
      const profile = defineProfile(id, min, max);
      return [profile.id, profile];
    })
  )
);

const NAME_TO_PROFILE_ID: Readonly<Record<string, string>> = Object.freeze({
  axe: 'weapon.axe',
  dagger: 'weapon.dagger',
  mace: 'weapon.mace',
  pistol: 'weapon.pistol',
  scepter: 'weapon.scepter',
  sword: 'weapon.sword',
  focus: 'weapon.focus',
  shield: 'weapon.shield',
  torch: 'weapon.torch',
  warhorn: 'weapon.warhorn',
  greatsword: 'weapon.greatsword',
  hammer: 'weapon.hammer',
  longbow: 'weapon.longbow',
  rifle: 'weapon.rifle',
  shortbow: 'weapon.shortbow',
  spear: 'weapon.spear',
  staff: 'weapon.staff',
  unequipped: 'nonweapon.unequipped',
  utility: 'nonweapon.unequipped',
  'profession mechanic': 'nonweapon.profession-mechanic'
});

/** Returns a validated weapon-strength profile by stable identifier. */
export function weaponStrengthProfile(id: unknown): Readonly<Gw2WeaponStrengthProfile> {
  const key = String(id || '');
  const profile = WEAPON_STRENGTH_PROFILES[key];
  if (!profile) throw new RangeError(`Unknown weapon-strength profile: ${key}.`);
  return profile;
}

/** Resolves an equipment name to its weapon-strength profile. */
export function weaponStrengthProfileForName(name: unknown): Readonly<Gw2WeaponStrengthProfile> | null {
  const value = String(name || '')
    .trim()
    .toLowerCase();
  const id = (Object.hasOwn(WEAPON_STRENGTH_PROFILES, value) ? value : null) || NAME_TO_PROFILE_ID[value];
  return id ? weaponStrengthProfile(id) : null;
}

/** Calculates the midpoint of a weapon-strength profile's range. */
export function weaponStrengthMidpoint(profile: Gw2WeaponStrengthProfile): number {
  return (profile.min + profile.max) / 2;
}

/** Maps a unit-interval sample onto a weapon-strength profile. */
export function sampleWeaponStrength(profile: Gw2WeaponStrengthProfile, unitIntervalValue: number): number {
  const sample = unitIntervalValue;
  if (!(sample >= 0 && sample < 1)) {
    throw new RangeError('Weapon-strength samples must be in [0, 1).');
  }

  return profile.min + sample * (profile.max - profile.min);
}
