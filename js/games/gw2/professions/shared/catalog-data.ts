type ProfessionWeaponHand = 'mh' | 'oh' | 'mh+oh' | '2h';

interface ProfessionWeaponData {
  readonly weapons: readonly string[];
  readonly weaponHands: Readonly<Record<string, ProfessionWeaponHand>>;
}

/** Defines a profession's weapon catalog in object key insertion order. */
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
