import { RELIC_NAMES, WEAPON_DATA, createProfessionWeaponData } from '../../platform/gw2/gear-data.js';
import { defaultWeaponSkillMatchesSet } from '../../platform/gw2/weapon-skill-matcher.js';
import { renderRotationBuilder } from '../rotation/index.js';
import { renderResults } from '../rotation/result/view.js';
import type {
  Gw2AppAdapter,
  Gw2AppAdapterOptions,
  ProfessionAssumptionControl,
  ProfessionSlotLoadout
} from './types.js';

/**
 * Builds the browser application adapter for a GW2 profession.
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
  simulateBuild,
  simulationConfig,
  rotationEndStateAt,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  randomDistributionRequest,
  relicComparisonRequest,
  calculateRandomDistribution,
  isSkillAvailable,
  defaultOffhand
}: Gw2AppAdapterOptions): Readonly<Gw2AppAdapter> {
  const weaponData = createProfessionWeaponData(profession.catalog, {
    weaponData: WEAPON_DATA
  });

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
    simulateBuild,
    simulationConfig,
    rotationEndStateAt,
    runSimulation,
    modifierContributionRequest,
    calculateModifierContributions,
    randomDistributionRequest,
    relicComparisonRequest,
    calculateRandomDistribution,
    renderResults,
    renderRotationBuilder,
    slotLoadout: profession.ui.slotLoadout ? (profession.ui.slotLoadout as unknown as ProfessionSlotLoadout) : null,
    assumptionControls: (profession.ui.assumptionControls ||
      Object.freeze([])) as readonly ProfessionAssumptionControl[],
    weaponSkillMatchesSet: profession.ui.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet,
    isSkillAvailable,
    defaultOffhand
  });
}
