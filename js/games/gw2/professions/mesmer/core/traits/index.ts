import {
  chaoticInterruption,
  chaoticPersistence,
  illusionaryMembrane,
  methodOfMadness
} from '#gw2/professions/mesmer/core/traits/chaos/index.js';
import {
  bountifulBlades,
  dazzling,
  egotism,
  empoweredIllusions,
  fragility,
  mentalAnguish,
  rendingShatter,
  viciousExpression
} from '#gw2/professions/mesmer/core/traits/domination/index.js';
import {
  blindingDissipation,
  criticalInfusion,
  deceptiveEvasion,
  fencersFinesse,
  ineptitude,
  masterFencer,
  phantasmalFury,
  sharperImages,
  superiorityComplex
} from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import {
  compoundingPower,
  cryOfPain,
  maimTheDisillusioned,
  maliciousSorcery,
  masterOfFragmentation,
  masterOfMisdirection,
  phantasmalForce,
  phantasmalHaste,
  shatterStorm,
  thePledge
} from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { egoRestoration, wardensFeedback } from '#gw2/professions/mesmer/core/traits/inspiration/index.js';

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
