import type { Gw2AttributeProvenance, Gw2Config } from './types.js';

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

export function attributeProvenance(config: Gw2Config = {}): Readonly<Gw2AttributeProvenance> {
  return createAttributeProvenance(config.attributeProvenance || {});
}

export function professionStaticRulesApplied(config: Gw2Config = {}): boolean {
  return attributeProvenance(config).professionStaticRulesApplied;
}
