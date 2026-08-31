import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2AttributeProvenance } from '#gw2/platform/builds/types.js';

/**
 * Describes which static profession rules are already included in a
 * simulation's supplied attributes.
 */
export function createAttributeProvenance({
  professionStaticRulesApplied = false,
  calculatedWeaponSet = 1,
  calculatedPrimaryWeapon = ''
}: Partial<Gw2AttributeProvenance> = {}): Readonly<Gw2AttributeProvenance> {
  const weaponSet = Number(calculatedWeaponSet) === 2 ? 2 : 1;
  return Object.freeze({
    professionStaticRulesApplied: professionStaticRulesApplied === true,
    calculatedWeaponSet: weaponSet,
    calculatedPrimaryWeapon: String(calculatedPrimaryWeapon || '')
  });
}

/** Returns normalized build-attribute provenance from a simulation config. */
export function attributeProvenance(config: Gw2Config = {}): Readonly<Gw2AttributeProvenance> {
  return createAttributeProvenance(config.attributeProvenance || {});
}

/** Reports whether profession static rules are already included in supplied attributes. */
export function professionStaticRulesApplied(config: Gw2Config = {}): boolean {
  return attributeProvenance(config).professionStaticRulesApplied;
}
