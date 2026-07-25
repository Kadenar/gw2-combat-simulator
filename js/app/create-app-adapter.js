import {
  WEAPON_DATA,
  createProfessionWeaponData,
  RELIC_NAMES,
} from "../platform/gw2/gear-data.js";
import {
  renderResults,
  renderRotationBuilder,
} from "./rotation-ui.js";

/**
 * Builds the browser application adapter for a GW2 profession.
 *
 * The shared shell consumes one adapter per profession for its build codec,
 * storage key, runtime/config builder, renderer hooks, filenames,
 * specialization fallback, and weapon selector data. Everything except a
 * handful of literals and two small predicates (`isSkillAvailable`,
 * `defaultOffhand`) is identical across professions, so it is assembled here.
 *
 * @param {Object} options - Profession-specific adapter configuration.
 * @returns {Object} Frozen application adapter.
 */
export function createGw2AppAdapter({
  profession,
  storageKey,
  globalName,
  filenames,
  resetPrompt,
  specializationFallback,
  createDefaultTargetConditions,
  toApplicationBuild,
  eliteSpecialization,
  recalculate,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  isSkillAvailable,
  defaultOffhand,
}) {
  const weaponData = createProfessionWeaponData(
    profession.catalog,
    { weaponData: WEAPON_DATA },
  );

  return Object.freeze({
    id: profession.id,
    name: profession.name,
    profession,
    storageKey,
    globalName,
    filenames: Object.freeze({ ...filenames }),
    resetPrompt,
    specializationFallback,
    specializations: profession.catalog.specializations,
    weaponData,
    relicNames: RELIC_NAMES,
    createDefaultTargetConditions,
    toApplicationBuild,
    eliteSpecialization,
    recalculate,
    runSimulation,
    modifierContributionRequest,
    calculateModifierContributions,
    renderResults,
    renderRotationBuilder,
    isSkillAvailable,
    defaultOffhand,
  });
}
