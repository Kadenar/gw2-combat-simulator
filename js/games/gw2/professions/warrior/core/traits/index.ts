import {
  blademaster,
  bloodlust,
  burstPrecision,
  deepStrikes,
  dualWielding,
  furious,
  furiousBurst,
  opportunist,
  signetMastery,
  sunderingBurst,
  unsuspectingFoe,
  woundingPrecision
} from '#gw2/professions/warrior/core/traits/arms.js';
import {
  cullTheWeak,
  mercilessHammer,
  stalwartStrength,
  thickSkin
} from '#gw2/professions/warrior/core/traits/defense.js';
import {
  axeMastery,
  burstMastery,
  crackShot,
  heightenedFocus,
  versatilePower,
  versatileRage,
  warriorsSprint
} from '#gw2/professions/warrior/core/traits/discipline.js';
import {
  aggressiveOnslaught,
  berserkersPower,
  bodyBlow,
  braveStride,
  buildingMomentum,
  forcefulGreatsword,
  greatFortitude,
  peakPerformance,
  pinnacleOfStrength,
  recklessDodge,
  restorativeStrength
} from '#gw2/professions/warrior/core/traits/strength.js';
import {
  empowerAllies,
  empowered,
  legSpecialist,
  marchingOrders,
  martialCadence,
  roaringReveille,
  soldiersComfort,
  vigorousShouts,
  warriorsCunning
} from '#gw2/professions/warrior/core/traits/tactics.js';

/** Register native owners once in declaration order. */
export const warriorCoreTraits = [
  dualWielding,
  signetMastery,
  burstPrecision,
  burstMastery,
  crackShot,
  berserkersPower,
  recklessDodge,
  restorativeStrength,
  braveStride,
  peakPerformance,
  bloodlust,
  furious,
  sunderingBurst,
  opportunist,
  mercilessHammer,
  stalwartStrength,
  bodyBlow,
  aggressiveOnslaught,
  legSpecialist,
  marchingOrders,
  soldiersComfort,
  vigorousShouts,
  martialCadence,
  buildingMomentum,
  empowerAllies,
  furiousBurst,
  pinnacleOfStrength,
  forcefulGreatsword,
  axeMastery,
  roaringReveille,
  greatFortitude,
  deepStrikes,
  unsuspectingFoe,
  cullTheWeak,
  versatileRage,
  thickSkin,
  woundingPrecision,
  blademaster,
  versatilePower,
  empowered,
  warriorsCunning,
  warriorsSprint,
  heightenedFocus
] as const;
