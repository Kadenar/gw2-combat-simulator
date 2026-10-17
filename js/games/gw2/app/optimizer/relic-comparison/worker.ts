import { createGameWorkerEndpoint, type GameWorkerRequestEnvelope } from '#browser/game/worker-harness.js';
import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import type { RelicComparisonWorkerRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';

/** The worker owns expensive simulation and series construction so cancellation can terminate all comparison work. */
createGameWorkerEndpoint<Gw2ProfessionSource, GameWorkerRequestEnvelope<RelicComparisonWorkerRequest>>({
  calculate(profession, { request }) {
    return { comparison: calculateRelicComparison(request, profession) };
  }
});
