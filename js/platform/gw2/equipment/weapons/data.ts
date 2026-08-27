/** Combines shared weapon-family strength with profession-owned weapon availability. */
import type { CanonicalCatalog } from '../../../engine/types.js';
import type { Gw2WeaponDataEntry } from '../types.js';
import { weaponStrengthMidpoint, weaponStrengthProfile } from './strength.js';

// ─── Weapon Data ──────────────────────────────────────────────────────────────
// wielding: 'mh' = main-hand only, 'oh' = off-hand only,
//           'mh+oh' = either hand, '2h' = two-handed, '-' = special
function weaponData(wielding: string, weaponStrengthProfileId: string): Readonly<Gw2WeaponDataEntry> {
  const profile = weaponStrengthProfile(weaponStrengthProfileId);
  return Object.freeze({
    wielding,
    weaponStrengthProfileId: profile.id,
    weaponStrength: weaponStrengthMidpoint(profile)
  });
}

export const WEAPON_DATA: Readonly<Record<string, Readonly<Gw2WeaponDataEntry>>> = {
  // Broadly available in either hand; profession catalogs narrow these.
  Axe: weaponData('mh+oh', 'weapon.axe'),
  Dagger: weaponData('mh+oh', 'weapon.dagger'),
  Mace: weaponData('mh+oh', 'weapon.mace'),
  Scepter: weaponData('mh', 'weapon.scepter'),
  // Main-hand or off-hand
  Sword: weaponData('mh+oh', 'weapon.sword'),
  // Off-hand only
  Focus: weaponData('oh', 'weapon.focus'),
  Pistol: weaponData('mh+oh', 'weapon.pistol'),
  Shield: weaponData('oh', 'weapon.shield'),
  Torch: weaponData('oh', 'weapon.torch'),
  Warhorn: weaponData('oh', 'weapon.warhorn'),
  // Two-handed
  Greatsword: weaponData('2h', 'weapon.greatsword'),
  Hammer: weaponData('2h', 'weapon.hammer'),
  Longbow: weaponData('2h', 'weapon.longbow'),
  Rifle: weaponData('2h', 'weapon.rifle'),
  Shortbow: weaponData('2h', 'weapon.shortbow'),
  Spear: weaponData('2h', 'weapon.spear'),
  Staff: weaponData('2h', 'weapon.staff'),
  // Special / internal
  Unequipped: weaponData('-', 'nonweapon.unequipped'),
  'Profession mechanic': weaponData('-', 'nonweapon.profession-mechanic')
};

function derivedProfessionWielding(catalog: CanonicalCatalog, weapon: string, fallback: string): string {
  const explicit = catalog?.weaponHands?.get?.(weapon);

  if (explicit) return explicit;

  if (fallback === '2h' || fallback === '-') return fallback;

  const slots = (catalog?.skills || [])
    .filter((skill) => skill.weapon === weapon)
    .map((skill) => String(skill.slot || ''));
  const mainHand = slots.some((slot) => /^Weapon_[1-3]$/.test(slot));
  const offHand = slots.some((slot) => /^Weapon_[4-5]$/.test(slot));

  if (mainHand && offHand) return 'mh+oh';

  if (mainHand) return 'mh';

  if (offHand) return 'oh';
  return fallback;
}

/**
 * Combines shared weapon-family strength with profession-owned availability.
 */
export function createProfessionWeaponData(
  catalog: CanonicalCatalog,
  {
    weaponData = WEAPON_DATA
  }: {
    readonly weaponData?: Readonly<Record<string, Gw2WeaponDataEntry>>;
  } = {}
): Readonly<Record<string, Readonly<Gw2WeaponDataEntry>>> {
  return Object.freeze(
    Object.fromEntries(
      [...(catalog?.weapons || [])]
        .filter((name) => weaponData[name])
        .map((name) => {
          const shared = weaponData[name];
          return [
            name,
            Object.freeze({
              ...shared,
              wielding: derivedProfessionWielding(catalog, name, shared.wielding)
            })
          ];
        })
    )
  );
}
