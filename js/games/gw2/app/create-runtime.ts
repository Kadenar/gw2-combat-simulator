import { withScenarioConfig } from '#gw2/app/boss-scenarios/simulation.js';
import { relicComparisonAvailable } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import { captureAnalysisRequestSnapshot } from '#gw2/app/simulation/analysis-request-snapshot.js';
import { calculateBaselineSimulation as calculateBaseline } from '#gw2/app/simulation/baseline/baseline-simulation.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/types.js';
import { calculateRandomDistribution as calculateDistribution } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import type {
  RandomDistributionOptions,
  RandomDistributionRequest,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';
import type { ProfessionAppState, ProfessionRuntimeApi, ProfessionRuntimeOptions } from '#gw2/app/types.js';
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { clamp } from '#kernel/core/numeric.js';

/** Binds headless analysis capture and calculation; synchronous preview and relic workflows retain their own inputs. */
export function createProfessionRuntime({
  profession,
  createBuildContext
}: ProfessionRuntimeOptions): ProfessionRuntimeApi {
  const eliteNames = new Set(
    profession.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );

  function eliteSpecialization(build: Gw2CanonicalBuild): string {
    return build.specializations.find((specialization) => eliteNames.has(specialization.name))?.name || 'Core';
  }

  function calculateModifierContributions({ rotation, baselineDps, comparisons }: ModifierContributionRequest) {
    // Main-thread comparisons need only DPS, matching workers without constructing unused chart histories.
    return calculateContributionComparisons({ rotation, baselineDps, comparisons }, (rotation, config) =>
      simulateGw2({ profession, rotation, config, output: 'score' })
    );
  }

  /** Uses the on-screen equipped relic as the baseline for an explicitly selected alternative. */
  function relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonRequest | null {
    const equippedRelic = String(app.build.relic || '');
    const targetRelic = String(comparisonRelic || '');

    if (!relicComparisonAvailable(equippedRelic, targetRelic, app.relicNames)) return null;

    return {
      rotation: app.build.rotation,
      baseConfig: baselineSimulationConfig(app),
      equippedRelic,
      comparisonRelic: targetRelic
    };
  }

  function calculateRandomDistribution(
    request: RandomDistributionRequest,
    options?: RandomDistributionOptions
  ): RandomDistributionSummary {
    // Distribution explanations need events, but never boon or attribute chart histories.
    return calculateDistribution(
      request,
      (rotation, config) => simulateGw2({ profession, rotation, config, collectChartData: false }),
      options
    );
  }

  function baselineSimulationConfig(app: ProfessionAppState): Gw2Config {
    const patch = profession.resolvePatch({ id: app.patch.id, values: app.patch.values });
    const config = deterministicSimulationConfig(
      createBuildContext({
        build: app.build,
        patch,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
      }).simulationConfig()
    );
    return withScenarioConfig(config, app.workspace?.scenario);
  }

  /** Prefix and candidate previews use the same engine and inherited combat boundary, without an observation tail. */
  function rotationPreviewAt(
    app: ProfessionAppState,
    insertionIndex: number,
    appended: readonly RotationCommand[] = []
  ): Gw2SimulationResult {
    const rotation = app.build.rotation;
    const index = clamp(Math.floor(Number(insertionIndex) || 0), 0, rotation.length);
    const config = baselineSimulationConfig(app);
    // A prefix before the marker still uses the full rotation's boundary, including casts that finish across it.
    const combatStartTime =
      index <= rotation.findIndex((command) => command.type === 'combat-start')
        ? (
            app.analysis.state.results ??
            simulateGw2({ profession, rotation, config, observationPolicy: { kind: 'rotation' } })
          ).combatStartTime
        : undefined;
    return simulateGw2({
      profession,
      rotation: [...rotation.slice(0, index), ...appended],
      config,
      observationPolicy: { kind: 'rotation' },
      collectChartData: false,
      combatStartTime: combatStartTime ?? undefined
    });
  }

  /** Runs a serialized baseline job without depending on browser application state. */
  function calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput {
    return calculateBaseline(request, profession);
  }

  const api: ProfessionRuntimeApi = {
    eliteSpecialization,
    createBuildContext,
    captureAnalysis: (input) => captureAnalysisRequestSnapshot(input, { profession, createBuildContext }),
    calculateModifierContributions,
    relicComparisonRequest,
    calculateRandomDistribution,
    rotationPreviewAt,
    calculateBaselineSimulation
  };
  return api;
}
