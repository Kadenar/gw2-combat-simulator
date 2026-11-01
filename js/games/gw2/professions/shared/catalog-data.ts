type ProfessionWeaponHand = 'mh' | 'oh' | 'mh+oh' | '2h';

interface ProfessionWeaponData {
  readonly weapons: readonly string[];
  readonly weaponHands: Readonly<Record<string, ProfessionWeaponHand>>;
}

/**
 * Defines the weapon catalog for a profession from a single source of truth.
 *
 * Object key insertion order determines the resulting `weapons` ordering.
 */
export function defineProfessionWeapons(
  weaponHands: Readonly<Record<string, ProfessionWeaponHand>>
): ProfessionWeaponData {
  const frozenWeaponHands = Object.freeze({
    ...weaponHands
  });

  return Object.freeze({
    weapons: Object.freeze(Object.keys(frozenWeaponHands)),
    weaponHands: frozenWeaponHands
  });
}
