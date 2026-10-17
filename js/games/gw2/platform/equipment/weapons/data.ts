import { WEAPON } from '#gw2/platform/constants.js';
/** Combines shared weapon-family strength with profession-owned weapon availability. */
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import type { Gw2WeaponDataEntry } from '#gw2/platform/equipment/weapons/types.js';
import { weaponStrengthMidpoint, weaponStrengthProfile } from '#gw2/platform/equipment/weapons/strength.js';

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
  [WEAPON.AXE]: weaponData('mh+oh', 'weapon.axe'),
  [WEAPON.DAGGER]: weaponData('mh+oh', 'weapon.dagger'),
  [WEAPON.MACE]: weaponData('mh+oh', 'weapon.mace'),
  [WEAPON.SCEPTER]: weaponData('mh', 'weapon.scepter'),
  // Main-hand or off-hand
  [WEAPON.SWORD]: weaponData('mh+oh', 'weapon.sword'),
  // Off-hand only
  [WEAPON.FOCUS]: weaponData('oh', 'weapon.focus'),
  [WEAPON.PISTOL]: weaponData('mh+oh', 'weapon.pistol'),
  [WEAPON.SHIELD]: weaponData('oh', 'weapon.shield'),
  [WEAPON.TORCH]: weaponData('oh', 'weapon.torch'),
  [WEAPON.WARHORN]: weaponData('oh', 'weapon.warhorn'),
  // Two-handed
  [WEAPON.GREATSWORD]: weaponData('2h', 'weapon.greatsword'),
  [WEAPON.HAMMER]: weaponData('2h', 'weapon.hammer'),
  [WEAPON.LONGBOW]: weaponData('2h', 'weapon.longbow'),
  [WEAPON.RIFLE]: weaponData('2h', 'weapon.rifle'),
  [WEAPON.SHORTBOW]: weaponData('2h', 'weapon.shortbow'),
  [WEAPON.SPEAR]: weaponData('2h', 'weapon.spear'),
  [WEAPON.STAFF]: weaponData('2h', 'weapon.staff'),
  // Special / internal
  Unequipped: weaponData('-', 'nonweapon.unequipped'),
  'Profession mechanic': weaponData('-', 'nonweapon.profession-mechanic')
};

function derivedProfessionWielding(catalog: CanonicalCatalog, weapon: string, fallback: string): string {
  const explicit = catalog.weaponHands.get(weapon);

  if (explicit) return explicit;

  if (fallback === '2h' || fallback === '-') return fallback;

  const slots = catalog.skills.filter((skill) => skill.weapon === weapon).map((skill) => String(skill.slot || ''));
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
      [...catalog.weapons]
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
