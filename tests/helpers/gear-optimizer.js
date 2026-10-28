import {
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerScore,
  ordinaryEquipmentAt,
  retainOptimizerCandidate
} from '#gw2/app/optimizer/gear/search.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

/** Exhaustive detailed simulations provide a small-search correctness reference for the production optimizers. */
export function runOrdinaryOptimizer(request, adapter) {
  const space = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(request, adapter);
  const winners = [];
  for (let ordinal = 0n; ordinal < space.rawCount; ordinal++) {
    const equipment = ordinaryEquipmentAt(space, ordinal);
    const config = evaluator.prepare(equipment, true);

    if (!config) continue;

    retainOptimizerCandidate(
      winners,
      {
        key: JSON.stringify(equipment),
        equipment,
        score: optimizerScore(
          simulateGw2({
            profession: adapter.profession,
            rotation: request.build.rotation,
            config,
            observationPolicy: { kind: 'rotation' }
          })
        ),
        represented: '1'
      },
      request.limit
    );
  }

  return winners;
}
