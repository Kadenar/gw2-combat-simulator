/**
 * Describes which static profession rules are already included in a
 * simulation's supplied attributes. Direct engine callers normally omit this
 * field so runtime hooks apply static rules. Browser adapters set it after
 * build attribute calculation so those rules are not applied twice.
 */
export function createAttributeProvenance({
  professionStaticRulesApplied = false,
  calculatedWeaponSet = 1,
  calculatedPrimaryWeapon = "",
} = {}) {
  const weaponSet = Number(calculatedWeaponSet) === 2 ? 2 : 1;
  return Object.freeze({
    professionStaticRulesApplied: professionStaticRulesApplied === true,
    calculatedWeaponSet: weaponSet,
    calculatedPrimaryWeapon: String(calculatedPrimaryWeapon || ""),
  });
}

export function attributeProvenance(config = {}) {
  return createAttributeProvenance(config.attributeProvenance || {});
}

export function professionStaticRulesApplied(config = {}) {
  return attributeProvenance(config).professionStaticRulesApplied;
}
