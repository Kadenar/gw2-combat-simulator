/** Runs fixed-health damage comparisons separately from the configured target's kill simulations. */
import {
  buildRelicComparisonModel,
  type RelicComparisonModel,
  type RelicKillResult
} from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonCalculationRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import { MAX_RELIC_COMPARISON_ALTERNATIVES } from '#gw2/app/optimizer/relic-comparison/types.js';
import { buildDamageSeries } from '#gw2/app/results/charts/time-series-model.js';
import { initialEncounterTarget } from '#gw2/platform/combat/state/encounter.js';
import { hitboxSizeForWidth } from '#gw2/platform/combat/state/targets.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2SimulationObservations, Gw2SimulationResult } from '#gw2/platform/results/types.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

export function calculateRelicComparison(
  request: RelicComparisonCalculationRequest,
  profession: Gw2ProfessionSource,
  simulate: typeof simulateGw2 = simulateGw2
): RelicComparisonModel {
  const relics = [
    request.equippedRelic,
    ...new Set(request.comparisonRelics.filter((relic) => relic !== request.equippedRelic))
  ];

  if (relics.length > MAX_RELIC_COMPARISON_ALTERNATIVES + 1)
    throw new RangeError(`Compare at most ${MAX_RELIC_COMPARISON_ALTERNATIVES} alternative relics at once.`);

  const originalConfigs = relics.map((relic, index) => ({
    ...request.baseConfig,
    relic,
    ...(index > 0 && relic === 'Thorns' ? { initialThornsStacks: request.initialStacks } : null)
  }));
  const kills = originalConfigs.map((config, index) =>
    index === 0 ? request.baselineResult : simulate({ profession, rotation: request.rotation, config, output: 'score' })
  );
  // Holding target health keeps execute modifiers consistent and prevents early death, including at zero health.
  const fixedHealthFraction =
    request.baseConfig.target?.fixedHealthFraction ?? request.baseConfig.target?.startingHealthFraction ?? 1;
  // Retain the opening boss target's geometry and armor when removing encounter phases and death.
  const encounterTarget = request.baseConfig.encounter ? initialEncounterTarget(request.baseConfig.encounter) : null;
  const configs = [...originalConfigs, { ...request.baseConfig, relic: '' }].map((config) => ({
    ...config,
    encounter: undefined,
    target: {
      ...config.target,
      ...(encounterTarget ? { armor: encounterTarget.armor } : {}),
      health: 0,
      fixedHealthFraction
    },
    ...(encounterTarget
      ? {
          professionAssumptions: {
            ...config.professionAssumptions,
            hitboxSize: hitboxSizeForWidth(encounterTarget.hitboxWidth)
          }
        }
      : {})
  }));
  const results = configs.map((config) =>
    simulate({ profession, rotation: request.rotation, config, output: 'observations' })
  );
  // Stop at the first completed rotation, including the no-relic run, so faster runs never idle for slower ones.
  const end = Math.min(...results.map((result) => result.rotationEndTime));
  // One origin prevents relic-triggered first hits from changing denominators between runs.
  const start = Math.min(...results.map((result) => result.dpsStartTime));
  const series = (result: Gw2SimulationObservations, direct = false) =>
    buildDamageSeries({
      ...result,
      dpsStartTime: start,
      combatEndTime: end,
      resolvedEvents: direct
        ? result.resolvedEvents.filter((event) => event.source === 'Relic' || event.name?.startsWith('Relic of '))
        : result.resolvedEvents
    }).dps;
  const kill = (
    result: Pick<Gw2SimulationResult, 'deathTime' | 'dpsStartTime' | 'combatEndTime'>
  ): RelicKillResult => ({
    killTimeMs: result.deathTime == null ? null : (result.deathTime - result.dpsStartTime) * 1000,
    observedMs: (result.combatEndTime - result.dpsStartTime) * 1000
  });
  return buildRelicComparisonModel({
    runs: relics.map((relic, index) => ({
      relic,
      dps: series(results[index]),
      directDps: series(results[index], true),
      kill: kill(kills[index])
    })),
    withoutRelicDps: series(results[results.length - 1]),
    targetHealthPercent: fixedHealthFraction * 100
  });
}
