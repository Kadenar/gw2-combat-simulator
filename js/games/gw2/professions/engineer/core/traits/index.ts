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

/** Declaration order is causal: critical procs precede explosion reactions, and Power Wrench precedes Adrenal Implant. */
export const engineerCoreTraits = [
  grenadier,
  streamlinedKits,
  serratedSteel,
  noScope,
  incendiaryPowder,
  optimizedActivation,
  staticDischarge,
  kineticBattery,
  explosiveEntrance,
  steelPackedPowder,
  shortFuse,
  explosiveTemper,
  grandEntrance,
  shrapnel,
  aimAssistedRocket,
  thermalVision,
  sanguineArray,
  hematicFocus,
  chemicalRounds,
  energyAmplifier,
  highCaliber,
  heavyMetal,
  hgh,
  powerWrench,
  adrenalImplant,
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
