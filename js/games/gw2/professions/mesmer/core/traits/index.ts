import { mesmerChaosTraits } from '#gw2/professions/mesmer/core/traits/chaos.js';
import { mesmerDominationTraits } from '#gw2/professions/mesmer/core/traits/domination.js';
import { mesmerDuelingTraits } from '#gw2/professions/mesmer/core/traits/dueling.js';
import { mesmerIllusionsTraits } from '#gw2/professions/mesmer/core/traits/illusions.js';

/** Collect canonical Core owners without making runtime trait decisions. */
export const mesmerCoreTraits = [
  ...mesmerDominationTraits,
  ...mesmerDuelingTraits,
  ...mesmerChaosTraits,
  ...mesmerIllusionsTraits
];
