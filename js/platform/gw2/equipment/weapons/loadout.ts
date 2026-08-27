import type { Gw2Config } from '../../simulation/config.js';

export type Gw2ConfiguredWeaponSet = readonly [string | undefined, string | undefined];

/** Reads the exact configured main-hand and off-hand for a caller-selected weapon set. */
export function gw2ConfiguredWeaponSet(config: Gw2Config | null | undefined, set: number): Gw2ConfiguredWeaponSet {
  return set === 2
    ? [config?.weaponSet2Primary, config?.weaponSet2Secondary]
    : [config?.primaryWeapon, config?.secondaryWeapon];
}

/** Reads the exact configured main-hand without deciding which weapon set is active. */
export function gw2PrimaryWeapon(config: Gw2Config | null | undefined, set: number): string | undefined {
  return gw2ConfiguredWeaponSet(config, set)[0];
}
