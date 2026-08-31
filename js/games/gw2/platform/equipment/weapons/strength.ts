/**
 * Canonical level-80 ascended/legendary PvE weapon-strength profiles.
 *
 * Bounds are the only stored source data. Midpoints and half-ranges are always
 * derived so compatibility consumers cannot drift from the sampled ranges.
 */

import type { SimulationEventInput, Skill } from '#gw2/platform/engine/types.js';
import { isGw2NonWeaponEffectEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2WeaponStrengthProfile } from '#gw2/platform/equipment/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

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
  ['summon.weapon-type-2', 2706, 3050],
  ['summon.weapon-type-3', 2448, 3050],
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
  'profession mechanic': 'nonweapon.profession-mechanic',
  // Gunsaber and Dragon Trigger are bundle skill sets, despite replacing the
  // Bladesworn's weapon-swap profession mechanic.
  gunsaber: 'bundle.ascended',
  'ascended bundle': 'bundle.ascended',
  bundle: 'bundle.ascended',
  kit: 'bundle.ascended',
  'radiant forge': 'transform.radiant-forge',
  rampage: 'transform.rampage',
  'photon forge': 'transform.photon-forge',
  'celestial avatar': 'transform.celestial-avatar',
  'cyclone bow': 'transform.cyclone-bow',
  'shadow shroud': 'transform.shadow-shroud',
  'lich form': 'transform.lich-form',
  'death shroud': 'transform.death-shroud',
  'reaper shroud': 'transform.reaper-shroud',
  "reaper's shroud": 'transform.reaper-shroud',
  'harbinger shroud': 'transform.harbinger-shroud',
  'ritualist shroud': 'transform.ritualist-shroud',
  "ritualist's shroud": 'transform.ritualist-shroud'
});

/** Returns a validated weapon-strength profile by stable identifier. */
export function weaponStrengthProfile(id: unknown): Readonly<Gw2WeaponStrengthProfile> {
  const key = String(id || '');
  const profile = WEAPON_STRENGTH_PROFILES[key];
  if (!profile) throw new RangeError(`Unknown weapon-strength profile: ${key}.`);
  return profile;
}

/** Resolves a weapon or transform name to its weapon-strength profile. */
export function weaponStrengthProfileForName(name: unknown): Readonly<Gw2WeaponStrengthProfile> | null {
  const value = String(name || '')
    .trim()
    .toLowerCase();
  const id = (Object.hasOwn(WEAPON_STRENGTH_PROFILES, value) ? value : null) || NAME_TO_PROFILE_ID[value];
  return id ? weaponStrengthProfile(id) : null;
}

/** Calculates the midpoint of a weapon-strength profile's range. */
export function weaponStrengthMidpoint(profile: Gw2WeaponStrengthProfile): number {
  return (Number(profile.min) + Number(profile.max)) / 2;
}

/** Calculates half of a weapon-strength profile's range. */
export function weaponStrengthHalfRange(profile: Gw2WeaponStrengthProfile): number {
  return (Number(profile.max) - Number(profile.min)) / 2;
}

/** Maps a unit-interval sample onto a weapon-strength profile. */
export function sampleWeaponStrength(profile: Gw2WeaponStrengthProfile, unitIntervalValue: number): number {
  const sample = Number(unitIntervalValue);
  if (!(sample >= 0 && sample < 1)) {
    throw new RangeError('Weapon-strength samples must be in [0, 1).');
  }

  return profile.min + sample * (profile.max - profile.min);
}

const SHROUD_PROFILE_IDS: Readonly<Record<string, string>> = Object.freeze({
  death: 'transform.death-shroud',
  reaper: 'transform.reaper-shroud',
  harbinger: 'transform.harbinger-shroud',
  ritualist: 'transform.ritualist-shroud',
  lich: 'transform.lich-form'
});

interface WeaponStrengthProfileContext {
  readonly skill?: Skill | null;
  readonly state?: Record<string, unknown> | null;
  readonly config?: Gw2Config;
}

/**
 * Selects a profile from canonical event and skill metadata. This function is
 * intended to run while an activation is being scheduled, before a delayed
 * packet can observe a later weapon or transform state.
 */
export function weaponStrengthProfileIdForEvent(
  event: SimulationEventInput,
  { skill = null, state = null, config = {} }: WeaponStrengthProfileContext = {}
): string | null {
  if (event.weaponStrengthProfileId != null) {
    return weaponStrengthProfile(event.weaponStrengthProfileId).id;
  }

  const professionValue = state?.profession || state || {};
  const profession =
    professionValue && typeof professionValue === 'object' ? (professionValue as Record<string, unknown>) : {};
  if (skill?.radiantForgeSkill) return 'transform.radiant-forge';
  if (skill?.cycloneBowSkill) return 'transform.cyclone-bow';
  // Celestial Avatar replaces the weapon bar and scales its strikes from the transform, not the equipped weapon.
  if (skill?.celestialAvatarSkill) return 'transform.celestial-avatar';
  if (skill?.forgeSkill) {
    return 'transform.photon-forge';
  }

  if (skill?.shadowShroudSkill) {
    return 'transform.shadow-shroud';
  }

  const skillShroud = String(skill?.shroud || '').toLowerCase();
  if (skillShroud && SHROUD_PROFILE_IDS[skillShroud]) {
    return SHROUD_PROFILE_IDS[skillShroud];
  }

  // Only explicit kits use bundle strength; other Bundle-tagged profession skills retain their weapon fallback.
  if (skill?.kit) return 'bundle.ascended';

  for (const candidate of [event.weapon, event.skillWeapon]) {
    const profile = weaponStrengthProfileForName(candidate);
    if (profile) return profile.id;
  }

  if (event.weaponStrengthSource === 'equipped') {
    const activeSet = Number(state?.activeWeaponSet) === 2 ? 2 : 1;
    const configured = gw2PrimaryWeapon(config, activeSet) || gw2PrimaryWeapon(config, 1);
    const profile = weaponStrengthProfileForName(configured);
    if (profile) return profile.id;
  }

  if (isGw2NonWeaponEffectEvent(event)) {
    return 'nonweapon.unequipped';
  }

  const activeShroud = String(profession.activeShroud || '').toLowerCase();
  if (activeShroud && SHROUD_PROFILE_IDS[activeShroud]) {
    return SHROUD_PROFILE_IDS[activeShroud];
  }

  if (profession.radiantForge === true) return 'transform.radiant-forge';
  if (profession.photonForgeActive === true) {
    return 'transform.photon-forge';
  }

  if (profession.shadowShroudActive === true) {
    return 'transform.shadow-shroud';
  }

  for (const candidate of [skill?.weapon, skill?.skillWeapon]) {
    const profile = weaponStrengthProfileForName(candidate);
    if (profile) return profile.id;
  }

  // Slot skills and system actions are explicitly independent of equipped weapons.
  if (['Action', 'Heal', 'Utility', 'Elite'].includes(String(skill?.type || ''))) {
    return 'nonweapon.unequipped';
  }

  if (String(skill?.type || '') === 'Profession') {
    return 'nonweapon.profession-mechanic';
  }

  // This final configured-weapon branch only runs in the scheduler, where the
  // active set still represents activation time.
  const activeSet = Number(state?.activeWeaponSet) === 2 ? 2 : 1;
  const configured = gw2PrimaryWeapon(config, activeSet) || gw2PrimaryWeapon(config, 1);
  return weaponStrengthProfileForName(configured)?.id || null;
}
