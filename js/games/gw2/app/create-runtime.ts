import type { ProfessionAttributeData } from '#gw2/app/build/types.js';
import { relicComparisonAvailable } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonJobRequest } from '#gw2/app/optimizer/relic-comparison/types.js';
import { cloneRotation } from '#gw2/app/rotation/editing/history.js';
import { calculateBaselineSimulation as calculateBaseline } from '#gw2/app/simulation/baseline/baseline-simulation.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import { createGw2SimulationConfig, deterministicSimulationConfig } from '#gw2/app/simulation/build-config.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions/modifier-contributions.js';
import { createModifierContributionRequest } from '#gw2/app/simulation/modifier-contributions/request.js';
import type {
  ModifierContributionRequest,
  ProfessionModifier
} from '#gw2/app/simulation/modifier-contributions/types.js';
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
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import type { SkillDamageEvaluation, SkillDamageRequest } from '#gw2/platform/skill-damage/types.js';
import { clamp } from '#kernel/core/numeric.js';
import { analysisViewIsActive } from '#browser/shell/result-view.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';

/**
 * Builds the shared browser runtime orchestration for a GW2 profession.
 *
 * Every profession bridges UI build state to the simulation engine the same
 * way: recalculate attributes, assemble a simulation config, run the sequence
 * simulator, and enumerate modifier-contribution comparisons. Only two small
 * seams differ per profession, both optional:
 *
 * - `buildConfigInputs(app, { attributeData, specialization, activeTraits })`
 *   returns extra fields passed *into* `createGw2SimulationConfig` (e.g.
 *   Necromancer's `initialResource` and Mesmer's clone-start resource).
 * - `buildConfigExtras(app)` returns extra fields merged *onto* the resulting
 *   config (e.g. Guardian's `initialTomePages`, Necromancer's `initialBlight`).
 * Runtime functions shared by the
 * profession app adapter.
 */
export function createProfessionRuntime({
  profession,
  calculateAttributes,
  buildConfigInputs,
  buildConfigExtras
}: ProfessionRuntimeOptions): ProfessionRuntimeApi {
  const simulateBuild = (
    rotation: readonly RotationCommand[],
    config: Gw2Config,
    observationPolicy?: ObservationPolicy
  ): Gw2SimulationResult =>
    simulateGw2({
      profession,
      rotation,
      config,
      observationPolicy
    });

  const eliteNames = new Set(
    profession.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );

  function eliteSpecialization(build: Gw2CanonicalBuild): string {
    return build.specializations.find((specialization) => eliteNames.has(specialization.name))?.name || 'Core';
  }

  function selectedSkills(app: ProfessionAppState): Skill[] {
    const catalog = app.activeCatalog || profession.catalog;
    const loadout = profession.ui.slotLoadout;
    if (loadout) {
      return loadout
        .selectedSkillIds({
          build: app.build,
          specialization: eliteSpecialization(app.build),
          professionState: app.results?.planningState?.profession
        })
        .map((id) => catalog.skillsById.get(id))
        .filter((skill): skill is Skill => skill != null);
    }

    const skillById = app.skillById || catalog.skillsById;
    return Object.values(app.build.selectedSkillIds)
      .map((id) => (id === null ? undefined : skillById.get(id)))
      .filter((skill): skill is Skill => skill != null);
  }

  // Previews can omit a static trait before conversions without changing the saved build.
  function recalculate(app: ProfessionAppState, disabledTrait: string | null = null): void {
    app.attributeData = calculateAttributes(
      app.build,
      selectedSkills(app),
      app.attributeWeaponSet || 1,
      disabledTrait,
      null,
      profession.balanceContextFor(app.patchId)
    ) as ProfessionAttributeData;
  }

  function attributesWithModifierDisabled(
    app: ProfessionAppState,
    disabled: ProfessionModifier | null,
    weaponSet: number
  ): ProfessionAttributeData {
    if (!app.attributeData) {
      throw new Error('Profession attributes must be calculated before simulation.');
    }

    const displayedWeaponSet = Number(app.attributeWeaponSet) === 2 ? 2 : 1;
    const recalculatesAttributes =
      disabled?.type === 'Trait' ||
      disabled?.type === 'Boon' ||
      disabled?.type === 'Sigil' ||
      disabled?.type === 'Food';
    if (weaponSet === displayedWeaponSet && !recalculatesAttributes) {
      return app.attributeData;
    }

    // Attribute-backed modifiers must be removed before recalculation; config filtering only removes runtime effects.
    let build: Gw2CanonicalBuild = app.build;
    if (disabled?.type === 'Boon') {
      const key = disabled.name.toLowerCase();
      build = {
        ...app.build,
        assumptions: {
          ...app.build.assumptions,
          [key]: key === 'might' ? 0 : false
        }
      };
    } else if (disabled?.type === 'Food') {
      build = { ...app.build, food: '' };
    }

    return calculateAttributes(
      build,
      selectedSkills(app),
      weaponSet,
      disabled?.type === 'Trait' ? disabled.name : null,
      disabled?.type === 'Sigil' ? disabled.name : null,
      profession.balanceContextFor(app.patchId)
    ) as ProfessionAttributeData;
  }

  function simulationConfig(app: ProfessionAppState, disabled: ProfessionModifier | null = null): Gw2Config {
    const attributeDataByWeaponSet = [1, 2].map((weaponSet) =>
      attributesWithModifierDisabled(app, disabled, weaponSet)
    );
    // Reuse the displayed set from this pass so removing a modifier calculates each weapon set only once.
    const attributeData = attributeDataByWeaponSet[Number(app.attributeWeaponSet) === 2 ? 1 : 0];
    const specialization = eliteSpecialization(app.build);
    const activeTraits = attributeData.activeTraits || [];
    const runtimeContext = { attributeData, specialization };
    const config = createGw2SimulationConfig({
      app,
      attributeData,
      attributeDataByWeaponSet,
      specialization,
      disabled,
      selectedTraitIds: activeTraits.map((trait) => trait.id).filter((id) => id != null),
      ...(buildConfigInputs ? buildConfigInputs(app, runtimeContext) : null)
    });
    return buildConfigExtras ? { ...config, ...buildConfigExtras(app, runtimeContext) } : config;
  }

  function calculateModifierContributions({ rotation, baseConfig, comparisons }: ModifierContributionRequest) {
    // Main-thread comparisons need only DPS, matching workers without constructing unused chart histories.
    return calculateContributionComparisons({ rotation, baseConfig, comparisons }, (rotation, config) =>
      simulateGw2({ profession, rotation, config, output: 'score' })
    );
  }

  function randomDistributionRequest(app: ProfessionAppState): RandomDistributionJobRequest {
    const config = simulationConfig(app);
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
  function relicComparisonRequest(app: ProfessionAppState, comparisonRelic?: string): RelicComparisonJobRequest | null {
    const opponentRelic = String(app.build.relic || '');
    const targetRelic = String(comparisonRelic || '');
    if (!app.relicNames.includes(targetRelic) || !relicComparisonAvailable(opponentRelic, targetRelic)) return null;
    return {
      gameId: 'gw2',
      contentId: profession.id,
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
    return calculateDistribution(request, simulateBuild, options);
  }

  function baselineSimulationConfig(app: ProfessionAppState): Gw2Config {
    return deterministicSimulationConfig(simulationConfig(app));
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
        ? (app.results ?? simulateBuild(rotation, config, { kind: 'rotation' })).combatStartTime
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
    return {
      gameId: 'gw2',
      contentId: profession.id,
      rotation: cloneRotation(app.build.rotation),
      damageDiagnostics: app.damageDiagnostics,
      collectChartData: analysisViewIsActive(),
      ...(app.rotationComparison?.referenceStatus === 'queued'
        ? { referenceRotation: cloneRotation(app.rotationComparison.referenceRotation) }
        : null),
      baseConfig: baselineSimulationConfig(app),
      selectedPatchId: app.patchId,
      ...(profession.preview?.id ? { previewPatchId: profession.preview.id } : null)
    };
  }

  /** Runs a serialized baseline job without depending on browser application state. */
  function calculateBaselineSimulation(request: BaselineSimulationRequest): BaselineSimulationOutput {
    return calculateBaseline(request, profession);
  }

  /** Runs the same probe evaluation as the skill damage worker, with damage diagnostics for its breakdowns. */
  function calculateSkillDamage(request: SkillDamageRequest): SkillDamageEvaluation {
    return evaluateSkillDamage(request, profession);
  }

  const api: ProfessionRuntimeApi = {
    simulateBuild,
    eliteSpecialization,
    recalculate,
    simulationConfig,
    modifierContributionRequest: (app) => createModifierContributionRequest(app, profession.id, simulationConfig),
    calculateModifierContributions,
    randomDistributionRequest,
    relicComparisonRequest,
    calculateRandomDistribution,
    rotationPlanningStateAt,
    rotationPreviewAt,
    baselineSimulationRequest,
    calculateBaselineSimulation,
    calculateSkillDamage
  };
  return api;
}
