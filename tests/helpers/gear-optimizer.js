import {
  createOptimizerEvaluator,
  createOptimizerSpace,
  meetsOptimizerOvercapRequirements,
  optimizerScore,
  ordinaryEquipmentAt,
  retainOptimizerCandidate
} from '#gw2/app/optimizer/gear/search.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

/** Exhaustive detailed simulations provide a small-search correctness reference for the production optimizers. */
export function runOrdinaryOptimizer(request, adapter) {
  const space = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(space, adapter);
  const winners = [];
  for (let ordinal = 0n; ordinal < space.rawCount; ordinal++) {
    const equipment = ordinaryEquipmentAt(space, ordinal);
    const config = evaluator.prepare(equipment, true);

    if (!config) continue;

    const score = optimizerScore(
      simulateGw2({
        profession: adapter.profession,
        rotation: request.build.rotation,
        config,
        collectBoonCoverage:
          request.selections.minQuicknessOvercapPercent !== undefined ||
          request.selections.minAlacrityOvercapPercent !== undefined,
        observationPolicy: { kind: 'rotation' }
      })
    );

    if (!meetsOptimizerOvercapRequirements(score, request.selections)) continue;

    retainOptimizerCandidate(
      winners,
      {
        key: JSON.stringify(equipment),
        equipment,
        score,
        representedCombinationCount: '1'
      },
      request.limit
    );
  }

  return winners;
}
