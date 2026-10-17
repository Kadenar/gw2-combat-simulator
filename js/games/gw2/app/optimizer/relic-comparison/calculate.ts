import { buildTimeSeries } from '#gw2/app/results/charts/time-series-model.js';
import {
  buildRelicComparisonModel,
  relicDamageSummary,
  type RelicComparisonModel
} from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonWorkerRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

/** Calculates both counterfactuals and their chart data without accessing browser application state. */
export function calculateRelicComparison(
  request: RelicComparisonWorkerRequest,
  profession: Gw2ProfessionSource,
  simulate: typeof simulateGw2 = simulateGw2
): RelicComparisonModel {
  const targetResult = simulate({
    profession,
    rotation: request.rotation,
    config: {
      ...request.baseConfig,
      relic: request.comparisonRelic,
      ...(request.comparisonRelic === 'Thorns' ? { initialThornsStacks: request.initialStacks } : null)
    },
    collectChartData: false
  });
  const opponentSeries = buildTimeSeries(request.opponentResult, 250, { includeEffects: false });
  const targetSeries = buildTimeSeries(targetResult, 250, { includeEffects: false });
  // One shared no-relic run attributes both direct damage and modifier effects.
  const withoutRelic = simulate({
    profession,
    rotation: request.rotation,
    config: { ...request.baseConfig, relic: '' },
    output: 'score'
  });
  return {
    ...buildRelicComparisonModel({
      opponentRelic: request.opponentRelic,
      targetRelic: request.comparisonRelic,
      opponentDps: opponentSeries.dps,
      targetDps: targetSeries.dps,
      opponentFinalDps: request.opponentResult.dps,
      targetFinalDps: targetResult.dps
    }),
    opponentDamage: relicDamageSummary(request.opponentResult, withoutRelic.dps),
    targetDamage: relicDamageSummary(targetResult, withoutRelic.dps)
  };
}
