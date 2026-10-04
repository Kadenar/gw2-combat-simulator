import {
  chaoticPersistence,
  illusionaryMembrane,
  chaoticInterruption,
  methodOfMadness
} from '#gw2/professions/mesmer/core/traits/chaos.js';
import {
  rendingShatter,
  dazzling,
  fragility,
  viciousExpression,
  empoweredIllusions,
  mentalAnguish,
  egotism,
  bountifulBlades
} from '#gw2/professions/mesmer/core/traits/domination.js';
import {
  criticalInfusion,
  fencersFinesse,
  ineptitude,
  masterFencer,
  sharperImages,
  phantasmalFury,
  superiorityComplex,
  blindingDissipation,
  deceptiveEvasion
} from '#gw2/professions/mesmer/core/traits/dueling.js';
import {
  compoundingPower,
  cryOfPain,
  maimTheDisillusioned,
  maliciousSorcery,
  masterOfMisdirection,
  masterOfFragmentation,
  phantasmalHaste,
  shatterStorm,
  thePledge,
  phantasmalForce
} from '#gw2/professions/mesmer/core/traits/illusions.js';
import { wardensFeedback, egoRestoration } from '#gw2/professions/mesmer/core/traits/inspiration.js';

/** Register each Core trait directly, preserving the execution order of its rules. */
export const mesmerCoreTraits = [
  rendingShatter,
  dazzling,
  fragility,
  viciousExpression,
  empoweredIllusions,
  mentalAnguish,
  egotism,
  bountifulBlades,
  criticalInfusion,
  fencersFinesse,
  ineptitude,
  masterFencer,
  sharperImages,
  phantasmalFury,
  superiorityComplex,
  blindingDissipation,
  deceptiveEvasion,
  chaoticPersistence,
  illusionaryMembrane,
  chaoticInterruption,
  methodOfMadness,
  compoundingPower,
  cryOfPain,
  maimTheDisillusioned,
  maliciousSorcery,
  masterOfMisdirection,
  masterOfFragmentation,
  phantasmalHaste,
  shatterStorm,
  thePledge,
  phantasmalForce,
  wardensFeedback,
  egoRestoration
];
