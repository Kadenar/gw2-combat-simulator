import type { Gw2AppAdapter } from '#gw2/app/types.js';
import {
  assignOptimizerChoice,
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerEquipment,
  ordinaryEquipmentAt,
  type GearOptimizerRequest,
  type OptimizerCandidate,
  type OptimizerEquipment
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';
import {
  optimizerEquivalenceKey,
  scoreOptimizerRange
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer-space.js';

export const OPTIMIZER_SEARCH_BUDGET = 2048;
const ROUND_SIZE = 256;

/** Sample legal builds, then expand promising neighbors without ever constructing the full stat index. */
export function createFastOptimizer(request: GearOptimizerRequest, adapter: Gw2AppAdapter) {
  const ordinary = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(request, adapter);
  const seen = new Set<string>();
  let candidates: OptimizerEquipment[] = [];
  const space = { ordinary, count: 0n };
  const add = (equipment: OptimizerEquipment): void => {
    if (seen.size >= OPTIMIZER_SEARCH_BUDGET || candidates.length >= ROUND_SIZE) return;
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

    let random = 0x9e3779b9;
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
  }

  space.count = BigInt(candidates.length);

  // ponytail: single-dimension neighborhoods can miss interacting improvements; diverse starts reduce, not remove, that risk.
  const refine = (winners: readonly OptimizerCandidate[]): void => {
    candidates = [];
    outer: for (const winner of winners.slice(0, 8)) {
      for (const dimension of ordinary.dimensions) {
        for (const choice of dimension.choices) {
          if (seen.size >= OPTIMIZER_SEARCH_BUDGET || candidates.length >= ROUND_SIZE) break outer;
          const equipment = structuredClone(winner.equipment);
          assignOptimizerChoice(equipment, dimension.key, choice);
          add(equipment);
        }
      }
    }

    space.count = BigInt(candidates.length);
  };

  const evaluateRange = (start: bigint, end: bigint) => {
    if (start < 0n || end > space.count || end <= start) throw new RangeError('Invalid optimizer chunk.');
    return scoreOptimizerRange(ordinary, adapter, evaluator, start, end, (ordinal) => ({
      equipment: candidates[Number(ordinal)],
      represented: 1n
    }));
  };

  return { space, evaluator, evaluateRange, refine };
}
