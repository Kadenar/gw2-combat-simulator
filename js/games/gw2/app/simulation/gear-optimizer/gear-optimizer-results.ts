import {
  compareOptimizerCandidates,
  type OptimizerCandidate,
  type OptimizerEquipment
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import { INFUSION_STATS } from '#gw2/platform/equipment/gear/stats.js';

export const OPTIMIZER_RESULT_FILTERS = {
  none: 'No filtering',
  all: 'All combinations',
  sigils: 'Sigils',
  rune: 'Runes',
  relic: 'Relics',
  food: 'Food',
  utility: 'Utility'
} as const;
export type OptimizerResultFilter = keyof typeof OPTIMIZER_RESULT_FILTERS;
export type OptimizerGroupedFilter = Exclude<OptimizerResultFilter, 'none'>;
export type OptimizerResultGroups = Record<OptimizerGroupedFilter, OptimizerCandidate[]>;
export const OPTIMIZER_FILTER_LIMIT = 100;

/** Match actual gear choices, ignoring object order and equivalent infusion entry ordering, rather than matching DPS. */
export function optimizerEquipmentIdentity(equipment: OptimizerEquipment): string {
  return JSON.stringify([
    Object.keys(equipment.gear)
      .sort()
      .map((slot) => [slot, equipment.gear[slot]]),
    equipment.alternateWeaponPrefixes,
    equipment.weaponSigils,
    equipment.rune,
    equipment.relic,
    equipment.food,
    equipment.utility,
    INFUSION_STATS.map((stat) =>
      equipment.infusions.reduce((count, infusion) => count + (infusion.stat === stat ? infusion.count : 0), 0)
    )
  ]);
}

export function createOptimizerResultGroups(): OptimizerResultGroups {
  return { all: [], sigils: [], rune: [], relic: [], food: [], utility: [] };
}

/** Equivalent scores can have different display identities; keep their order independent of worker completion. */
function compareDisplayResults(left: OptimizerCandidate, right: OptimizerCandidate): number {
  const scoreOrder = compareOptimizerCandidates(left, right);
  if (scoreOrder) return scoreOrder;
  const a = JSON.stringify(left.equipment);
  const b = JSON.stringify(right.equipment);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Group by upgrade identity, retaining sigil order and every usable weapon set. */
function groupKey(candidate: OptimizerCandidate, filter: OptimizerGroupedFilter, sets: readonly number[]): string {
  const equipment = candidate.equipment;
  const sigils = sets.map((set) => equipment.weaponSigils[set]);
  return JSON.stringify(
    filter === 'all'
      ? [sigils, equipment.rune, equipment.relic, equipment.food, equipment.utility]
      : filter === 'sigils'
        ? sigils
        : equipment[filter]
  );
}

/** Keep group winners before the overall top-20 cutoff, with a fixed memory and display limit per filter. */
export function retainOptimizerGroup(
  results: OptimizerCandidate[],
  candidate: OptimizerCandidate,
  filter: OptimizerGroupedFilter,
  sets: readonly number[]
): void {
  const key = groupKey(candidate, filter, sets);
  const index = results.findIndex((result) => groupKey(result, filter, sets) === key);
  if (index >= 0) {
    if (compareDisplayResults(candidate, results[index]) >= 0) return;
    results.splice(index, 1);
  }

  results.push(candidate);
  results.sort(compareDisplayResults);
  if (results.length > OPTIMIZER_FILTER_LIMIT) results.pop();
}
