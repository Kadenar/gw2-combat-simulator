import type { OptimizerContext } from '#gw2/app/optimizer/gear/context.js';
import {
  createOptimizerRangeScorer,
  optimizerEquivalenceKey,
  type OptimizerRangeProgress
} from '#gw2/app/optimizer/gear/search-space.js';
import {
  assignOptimizerChoice,
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerEquipment,
  ordinaryEquipmentAt,
  type GearOptimizerRequest,
  type OptimizerCandidate,
  type OptimizerEquipment
} from '#gw2/app/optimizer/gear/search.js';

const ROUND_SIZE = 256;
const PASS_BUDGET = 2048;

/** Sample legal builds, then expand promising neighbors without ever constructing the full stat index. */
export function createFastOptimizer(request: GearOptimizerRequest, adapter: OptimizerContext) {
  const ordinary = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(ordinary, adapter);
  const scoreRange = createOptimizerRangeScorer(ordinary, adapter, evaluator);
  const seen = new Set<string>();
  let candidates: OptimizerEquipment[] = [];
  let searchBudget = PASS_BUDGET;
  let secondPassAvailable = request.search === 'two-pass' && ordinary.rawCount > BigInt(ROUND_SIZE);
  const space = { ordinary, count: 0n };
  const add = (equipment: OptimizerEquipment): void => {
    if (seen.size >= searchBudget || candidates.length >= ROUND_SIZE) return;

    const key = optimizerEquivalenceKey(equipment, ordinary, adapter);

    if (seen.has(key)) return;

    seen.add(key);
    candidates.push(equipment);
  };

  // Start at the equipped choices, replacing only selections that are no longer allowed.
  const current = optimizerEquipment(request.build);
  for (const dimension of ordinary.dimensions) {
    const matches = dimension.choices.find((choice) => {
      const changed = structuredClone(current);
      assignOptimizerChoice(changed, dimension.key, choice);
      return JSON.stringify(changed) === JSON.stringify(current);
    });
    assignOptimizerChoice(current, dimension.key, matches ?? dimension.choices[0]);
  }

  add(current);

  const sample = (seed: number): void => {
    let random = seed;
    for (let attempt = 0; attempt < ROUND_SIZE * 16 && candidates.length < ROUND_SIZE; attempt++) {
      const equipment = optimizerEquipment(request.build);
      for (const dimension of ordinary.dimensions) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        assignOptimizerChoice(equipment, dimension.key, dimension.choices[(random >>> 0) % dimension.choices.length]);
      }

      add(equipment);
    }
  };

  if (ordinary.rawCount <= BigInt(ROUND_SIZE)) {
    for (let ordinal = 0n; ordinal < ordinary.rawCount; ordinal++) add(ordinaryEquipmentAt(ordinary, ordinal));
  } else {
    // Include homogeneous prefixes as useful endpoints, then deterministic independent choices for diverse starts.
    for (const prefix of request.selections.prefixes || []) {
      const equipment = structuredClone(current);
      for (const dimension of ordinary.dimensions) {
        if (
          (dimension.key.startsWith('Alternate') || Object.hasOwn(equipment.gear, dimension.key)) &&
          dimension.choices.includes(prefix)
        )
          assignOptimizerChoice(equipment, dimension.key, prefix);
      }

      add(equipment);
    }

    sample(0x9e3779b9);
  }

  space.count = BigInt(candidates.length);

  // Score each batch of single changes before choosing which setups to refine next.
  const refine = (winners: readonly OptimizerCandidate[]): boolean => {
    candidates = [];
    outer: for (const winner of winners.slice(0, 8)) {
      for (const dimension of ordinary.dimensions) {
        for (const choice of dimension.choices) {
          if (seen.size >= searchBudget || candidates.length >= ROUND_SIZE) break outer;

          const equipment = structuredClone(winner.equipment);
          assignOptimizerChoice(equipment, dimension.key, choice);
          add(equipment);
        }
      }
    }

    // Give the second sample its own budget and winners while skipping setups scored by either pass.
    // ponytail: pass 2 cannot refine through a pass-1 setup it skips, so it can stop at pass 1's explored area.
    let startedSecondPass = false;

    if (!candidates.length && secondPassAvailable) {
      secondPassAvailable = false;
      searchBudget = seen.size + PASS_BUDGET;
      sample(0x243f6a88);
      // Equivalent setups share a key, so only the sample itself shows whether unscored setups remain.
      startedSecondPass = candidates.length > 0;
    }

    space.count = BigInt(candidates.length);
    return startedSecondPass;
  };

  const evaluateRange = (start: bigint, end: bigint, onProgress?: OptimizerRangeProgress) => {
    if (start < 0n || end > space.count || end <= start) throw new RangeError('Invalid optimizer chunk.');

    return scoreRange(
      start,
      end,
      (ordinal) => ({
        equipment: candidates[Number(ordinal)],
        representedCombinationCount: 1n
      }),
      onProgress
    );
  };

  return { space, evaluator, evaluateRange, refine };
}
