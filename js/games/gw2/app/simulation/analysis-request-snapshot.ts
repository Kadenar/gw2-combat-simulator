/** Detaches analysis inputs once so lazy requests and cache identity describe the same baseline. */
import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import { withScenarioConfig } from '#gw2/app/boss-scenarios/simulation.js';
import { buildWithPatchSkillSelections } from '#gw2/app/build/state/skill-selection.js';
import type { BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import { createModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/request.js';
import type { ModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/types.js';
import type { PatchResultIdentity } from '#gw2/app/simulation/patch-result-cache.js';
import { DEFAULT_RANDOM_DISTRIBUTION_TRIALS } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import type { RandomDistributionJobRequest } from '#gw2/app/simulation/random-distribution/types.js';
import type { SimulationSettings } from '#gw2/app/simulation/settings.js';
import { deterministicSimulationConfig } from '#gw2/build-context/simulation-config.js';
import type { BuildContextFactory, BuildContextProfession, ProfessionModifier } from '#gw2/build-context/types.js';
import type { PatchSelection } from '#gw2/integrations/patches/selection.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';

export interface AnalysisRequestInput {
  readonly build: Gw2CanonicalBuild;
  readonly patch: PatchSelection;
  readonly simulationSettings?: SimulationSettings;
  readonly scenario?: BossScenarioDraft;
  readonly damageDiagnostics?: boolean;
}

export interface BaselineRequestIntent {
  readonly collectChartData: boolean;
  readonly comparePatch: boolean;
  readonly referenceRotation?: readonly RotationCommand[];
}

/** In-process snapshots prepare clone-safe worker payloads without consulting editor or presentation state. */
export interface AnalysisRequestSnapshot {
  readonly identity: PatchResultIdentity;
  readonly rotationLength: number;
  baseline(intent: BaselineRequestIntent): BaselineSimulationRequest;
  modifiers(baselineDps: number): ModifierContributionRequest;
  distribution(): RandomDistributionJobRequest;
  withRotation(rotation: readonly RotationCommand[]): AnalysisRequestSnapshot;
}

export function captureAnalysisRequestSnapshot(
  input: AnalysisRequestInput,
  {
    profession,
    createBuildContext
  }: { readonly profession: BuildContextProfession; readonly createBuildContext: BuildContextFactory }
): AnalysisRequestSnapshot {
  const owner = input.build;
  const build = structuredClone(input.build);
  const values = { ...input.patch.values };
  const transitionDelays = normalizeTransitionDelays(input.simulationSettings?.transitionDelays);
  const environment = JSON.stringify({ transitionDelays });
  const scenario = input.scenario ? structuredClone(input.scenario) : undefined;
  const previewId = profession.preview?.id ?? null;
  const selectedPatchId = input.patch.id;
  const damageDiagnostics = input.damageDiagnostics === true;
  const selected = profession.resolvePatch({ id: selectedPatchId, values });
  const patches = new Map(
    [selectedPatchId, ...(previewId ? ['current', previewId] : [])].map((id) => [
      id,
      id === selectedPatchId ? selected : profession.resolvePatch({ id, values })
    ])
  );
  const builds = new Map(
    [...patches].map(([id, patch]) => [
      id,
      id === selectedPatchId
        ? build
        : buildWithPatchSkillSelections({ build, activeCatalog: selected.catalog }, patch.catalog)
    ])
  );

  // Shared immutable catalogs are borrowed; mutable build and encounter data stay private to this capture.
  function snapshot(rotation?: readonly RotationCommand[]): AnalysisRequestSnapshot {
    const capturedBuild = rotation ? { ...build, rotation: rotation.map((command) => ({ ...command })) } : build;
    const identity: PatchResultIdentity = Object.freeze({
      build: owner,
      selectedPatchId,
      previewId,
      environment,
      values: JSON.stringify(values),
      builds: Object.freeze(
        Object.fromEntries(
          [...builds].map(([id, value]) => [
            id,
            JSON.stringify(rotation ? { ...value, rotation: capturedBuild.rotation } : value)
          ])
        )
      ),
      damageDiagnostics,
      scenario: Boolean(scenario)
    });
    const context = (disabledModifier?: ProfessionModifier, requestedPatch = selectedPatchId) =>
      createBuildContext({
        build:
          requestedPatch === selectedPatchId
            ? capturedBuild
            : { ...builds.get(requestedPatch)!, rotation: capturedBuild.rotation },
        patch: requestedPatch === selectedPatchId ? selected : patches.get(requestedPatch)!,
        transitionDelays,
        disabledModifier
      });
    const deterministicConfig = (disabledModifier?: ProfessionModifier, requestedPatch = selectedPatchId) =>
      withScenarioConfig(
        deterministicSimulationConfig(context(disabledModifier, requestedPatch).simulationConfig()),
        scenario
      );
    const copyRotation = () => capturedBuild.rotation.map((command) => ({ ...command }));
    return Object.freeze({
      identity,
      rotationLength: capturedBuild.rotation.length,
      baseline(intent: BaselineRequestIntent): BaselineSimulationRequest {
        const opposite =
          previewId && !scenario && intent.comparePatch
            ? selectedPatchId === 'current'
              ? previewId
              : 'current'
            : null;
        return {
          gameId: 'gw2',
          contentId: profession.id,
          selectedPatchId,
          rotation: copyRotation(),
          baseConfig: deterministicConfig(),
          damageDiagnostics,
          collectChartData: intent.collectChartData,
          ...(intent.referenceRotation
            ? { referenceRotation: intent.referenceRotation.map((command) => ({ ...command })) }
            : {}),
          ...(opposite
            ? {
                comparisonConfig: {
                  ...deterministicConfig(undefined, opposite),
                  patchId: opposite
                }
              }
            : {})
        };
      },
      modifiers: (baselineDps: number) =>
        createModifierContributionRequest(
          capturedBuild,
          () => context().attributes(1),
          profession,
          deterministicConfig,
          baselineDps
        ),
      distribution(): RandomDistributionJobRequest {
        const config = withScenarioConfig(context().simulationConfig(), scenario);
        return {
          gameId: 'gw2',
          contentId: profession.id,
          rotation: copyRotation(),
          trials: DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
          baseConfig: { ...config, randomness: { ...config.randomness, mode: SIMULATION_RANDOMNESS_MODES.STOCHASTIC } }
        };
      },
      withRotation: (commands: readonly RotationCommand[]) => snapshot(commands)
    });
  }

  return snapshot();
}
