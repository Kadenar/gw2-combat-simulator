import { WEAPON } from '#gw2/platform/constants.js';

/**
 * Core weapon-strength defaults used by shared packet construction.
 */

export const MESMER_CORE_WEAPON_STRENGTH: Readonly<Record<string, number>> = Object.freeze({
  [WEAPON.AXE]: 1000,
  [WEAPON.DAGGER]: 1000,
  [WEAPON.FOCUS]: 900,
  [WEAPON.GREATSWORD]: 1100,
  [WEAPON.HAMMER]: 1100,
  [WEAPON.PISTOL]: 1000,
  [WEAPON.RIFLE]: 1150,
  [WEAPON.SCEPTER]: 1000,
  [WEAPON.SHIELD]: 900,
  [WEAPON.SPEAR]: 1000,
  [WEAPON.STAFF]: 1100,
  [WEAPON.SWORD]: 1000,
  [WEAPON.TORCH]: 900,
  Utility: 690.5,
  Unequipped: 690.5,
  'Phantasm high': 2877,
  'Phantasm medium': 2615.5,
  'Phantasm defender': 2362.5
});
