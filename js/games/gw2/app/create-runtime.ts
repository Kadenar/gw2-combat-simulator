import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

import { relicComparisonAvailable } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import { cloneRotation } from '#gw2/app/rotation/editing/history.js';
import { calculateBaselineSimulation as calculateBaseline } from '#gw2/app/simulation/baseline/baseline-simulation.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { createModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/request.js';
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/types.js';

import {
  DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
  calculateRandomDistribution as calculateDistribution
} from '#gw2/app/simulation/random-distribution/random-distribution.js';
import type {
  RandomDistributionJobRequest,
  RandomDistributionOptions,
  RandomDistributionRequest,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';
import type { ProfessionAppState, ProfessionRuntimeApi, ProfessionRuntimeOptions } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import { clamp } from '#kernel/core/numeric.js';
import { analysisViewIsActive } from '#browser/shell/result-view.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';

/** Coordinates browser analysis requests using the shared headless build calculation. */
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

  function randomDistributionRequest(app: ProfessionAppState): RandomDistributionJobRequest {
    const config = createBuildContext({
      build: app.build,
      patch: app.patch,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
    }).simulationConfig();
    const baseConfig = {
      ...config,
      randomness: {
        ...config.randomness,
        mode: SIMULATION_RANDOMNESS_MODES.STOCHASTIC
      }
    };
    return {
      gameId: 'gw2',
      contentId: profession.id,
      rotation: app.build.rotation,
      baseConfig,
      trials: DEFAULT_RANDOM_DISTRIBUTION_TRIALS
    };
  }

  /** Uses the on-screen equipped relic as the baseline for an explicitly selected alternative. */
  function relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonRequest | null {
    const opponentRelic = String(app.build.relic || '');
    const targetRelic = String(comparisonRelic || '');

    if (!app.relicNames.includes(targetRelic) || !relicComparisonAvailable(opponentRelic, targetRelic)) return null;

    return {
      rotation: app.build.rotation,
      baseConfig: baselineSimulationConfig(app),
      opponentRelic,
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

  function baselineSimulationConfig(app: ProfessionAppState, patchId = app.patch.id): Gw2Config {
    return deterministicSimulationConfig(
      createBuildContext({
        build: app.build,
        patch: profession.resolvePatch({ id: patchId, values: app.patch.values }),
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays)
      }).simulationConfig()
    );
  }

  function rotationPlanningStateAt(
    app: ProfessionAppState,
    insertionIndex: number
  ): Gw2SimulationResult['planningState'] {
    const rotation = app.build.rotation;
    const index = clamp(rotation.length, 0, Math.floor(Number(insertionIndex) || 0));

    // A tail-resolved result cannot supply availability at the insertion boundary.
    if (
      index === rotation.length &&
      app.results &&
      app.results.planningState.atSeconds === app.results.rotationEndTime
    ) {
      return app.results.planningState;
    }

    return rotationPreviewAt(app, index).planningState;
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
        ? (app.results ?? simulateGw2({ profession, rotation, config, observationPolicy: { kind: 'rotation' } }))
            .combatStartTime
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

  /** Captures a clone-safe baseline job before later edits can mutate the rotation. */
  function baselineSimulationRequest(app: ProfessionAppState): BaselineSimulationRequest {
    // Prepare each patch once; the selected run and reference share that same captured config.
    const patchConfigs = profession.preview?.id
      ? {
          current: baselineSimulationConfig(app, 'current'),
          preview: baselineSimulationConfig(app, profession.preview.id)
        }
      : undefined;
    const baseConfig = patchConfigs
      ? app.patch.id === patchConfigs.preview.patchId
        ? patchConfigs.preview
        : patchConfigs.current
      : baselineSimulationConfig(app);
    return {
      gameId: 'gw2',
      contentId: profession.id,
      rotation: cloneRotation(app.build.rotation),
      damageDiagnostics: app.damageDiagnostics,
      collectChartData: analysisViewIsActive(),
      ...(app.rotationComparison?.referenceStatus === 'queued'
        ? { referenceRotation: cloneRotation(app.rotationComparison.referenceRotation) }
        : null),
      baseConfig,
      selectedPatchId: app.patch.id,
      ...(patchConfigs ? { patchConfigs } : null)
    };
  }

  /** Runs a serialized baseline job without depending on browser application state. */
  function calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput {
    return calculateBaseline(request, profession);
  }

  const api: ProfessionRuntimeApi = {
    eliteSpecialization,
    createBuildContext,
    modifierContributionRequest: (app, baselineDps) =>
      createModifierContributionRequest(app, profession, createBuildContext, baselineDps),
    calculateModifierContributions,
    randomDistributionRequest,
    relicComparisonRequest,
    calculateRandomDistribution,
    rotationPlanningStateAt,
    rotationPreviewAt,
    baselineSimulationRequest,
    calculateBaselineSimulation
  };
  return api;
}
