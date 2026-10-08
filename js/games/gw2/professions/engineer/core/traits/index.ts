import {
  blastZone,
  boilingPoint,
  compoundingChemicals,
  equalAndOppositeReaction,
  hgh
} from '#gw2/professions/engineer/core/traits/alchemy/index.js';
import {
  aimAssistedRocket,
  bigBoomer,
  blastShield,
  explosiveEntrance,
  explosiveTemper,
  glassCannon,
  grandEntrance,
  grenadier,
  shapedCharge,
  shortFuse,
  shrapnel,
  steelPackedPowder
} from '#gw2/professions/engineer/core/traits/explosives/index.js';
import {
  chemicalRounds,
  heavyMetal,
  hematicFocus,
  highCaliber,
  incendiaryPowder,
  modifiedAmmunition,
  noScope,
  sanguineArray,
  serratedSteel,
  sharpshooter,
  thermalVision
} from '#gw2/professions/engineer/core/traits/firearms/index.js';
import { energyAmplifier } from '#gw2/professions/engineer/core/traits/inventions/index.js';
import {
  adrenalImplant,
  excessiveEnergy,
  gadgeteer,
  kineticBattery,
  mechanizedDeployment,
  optimizedActivation,
  powerWrench,
  staticDischarge,
  streamlinedKits,
  takedownRound
} from '#gw2/professions/engineer/core/traits/tools/index.js';

/** Collects Core trait declarations; the trait dispatcher preserves runtime order. */
export const engineerCoreTraits = [
  grenadier,
  streamlinedKits,
  optimizedActivation,
  staticDischarge,
  kineticBattery,
  explosiveEntrance,
  steelPackedPowder,
  shortFuse,
  explosiveTemper,
  shrapnel,
  serratedSteel,
  noScope,
  incendiaryPowder,
  aimAssistedRocket,
  thermalVision,
  sanguineArray,
  hematicFocus,
  chemicalRounds,
  energyAmplifier,
  highCaliber,
  grandEntrance,
  heavyMetal,
  hgh,
  adrenalImplant,
  powerWrench,
  mechanizedDeployment,
  gadgeteer,
  compoundingChemicals,
  blastShield,
  sharpshooter,
  glassCannon,
  bigBoomer,
  shapedCharge,
  modifiedAmmunition,
  excessiveEnergy,
  takedownRound,
  boilingPoint,
  blastZone,
  equalAndOppositeReaction
];
