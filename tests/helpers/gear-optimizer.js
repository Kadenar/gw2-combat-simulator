import {
  createOptimizerSpace,
  createOptimizerEvaluator,
  ordinaryEquipmentAt,
  optimizerScore,
  retainOptimizerCandidate
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';

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
        score: optimizerScore(adapter.simulateBuild(request.build.rotation, config, request.observationPolicy)),
        represented: '1'
      },
      request.limit
    );
  }

  return winners;
}
