import { createGw2SimulationConfig } from '#gw2/app/simulation/config.js';
import { calculateContributionComparisons } from '#gw2/app/simulation/modifier-contributions.js';
import {
  DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
  calculateRandomDistribution as calculateDistribution
} from '#gw2/app/simulation/random-distribution.js';
import { relicComparisonAvailable } from '#gw2/app/simulation/relic-comparison.js';
import { cloneRotation } from '#gw2/app/rotation/editing/history.js';
import { FOOD_DATA } from '#gw2/platform/equipment/consumables/food.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { ObservationPolicy, RotationCommand, Skill } from '#gw2/platform/engine/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  ModifierContributionRequest,
  ProfessionAppState,
  ProfessionAttributeData,
  ProfessionModifier,
  ProfessionRuntimeApi,
  ProfessionRuntimeOptions,
  ProfessionSlotLoadout,
  RandomDistributionJobRequest,
  RandomDistributionOptions,
  RandomDistributionRequest,
  RandomDistributionSummary,
  RelicComparisonJobRequest
} from '#gw2/app/types.js';
import type { Gw2ApplicationBuild, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';

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
 *   Necromancer's `initialResource`, Mesmer's clone-start resource and
 *   `adjustConditionDurationBonus`).
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

  function eliteSpecialization(build: Gw2ApplicationBuild): string {
    return build.specializations.find((specialization) => eliteNames.has(specialization.name))?.name || 'Core';
  }

  function selectedSkills(app: ProfessionAppState): Skill[] {
    const catalog = app.activeCatalog || profession.catalog;
    const loadout = profession.ui.slotLoadout ? (profession.ui.slotLoadout as ProfessionSlotLoadout) : null;
    if (loadout) {
      return loadout
        .selectedSkillIds({
          build: app.build,
          specialization: eliteSpecialization(app.build),
          professionState: app.results?.endState?.profession,
          catalog
        })
        .map((id) => catalog.skillsById.get(Number(id)))
        .filter((skill): skill is Skill => skill != null);
    }

    const skillByName = app.skillByName || catalog.skillsByName;
    return Object.values(app.build.selectedSkills)
      .map((name) => skillByName.get(name))
      .filter((skill): skill is Skill => skill != null);
  }

  function recalculate(app: ProfessionAppState): void {
    app.attributeData = calculateAttributes(
      app.build,
      selectedSkills(app),
      app.attributeWeaponSet || 1
    ) as ProfessionAttributeData;
  }

  function attributesWithModifierDisabled(
    app: ProfessionAppState,
    disabled: ProfessionModifier | null,
    weaponSet?: number
  ): ProfessionAttributeData {
    if (!app.attributeData) {
      throw new Error('Profession attributes must be calculated before simulation.');
    }

    const displayedWeaponSet = Number(app.attributeWeaponSet) === 2 ? 2 : 1;
    const targetWeaponSet = weaponSet ?? displayedWeaponSet;
    const recalculatesAttributes =
      disabled?.type === 'Trait' ||
      disabled?.type === 'Boon' ||
      disabled?.type === 'Sigil' ||
      disabled?.type === 'Food';
    if (targetWeaponSet === displayedWeaponSet && !recalculatesAttributes) {
      return app.attributeData;
    }

    // Attribute-backed modifiers must be removed before recalculation; config filtering only removes runtime effects.
    let build: Gw2ApplicationBuild = app.build;
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
      targetWeaponSet,
      disabled?.type === 'Trait' ? disabled.name : null,
      disabled?.type === 'Sigil' ? disabled.name : null
    ) as ProfessionAttributeData;
  }

  function simulationConfig(app: ProfessionAppState, disabled: ProfessionModifier | null = null): Gw2Config {
    const attributeData = attributesWithModifierDisabled(app, disabled);
    const attributeDataByWeaponSet = [1, 2].map((weaponSet) =>
      attributesWithModifierDisabled(app, disabled, weaponSet)
    );
    const specialization = eliteSpecialization(app.build);
    const activeTraits = attributeData.activeTraits || [];
    const runtimeContext = { attributeData, specialization, activeTraits };
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

  function modifierCandidates(app: ProfessionAppState): ProfessionModifier[] {
    const candidates: ProfessionModifier[] = [];
    const assumptions = app.build.assumptions as ProfessionBuildAssumptions;
    if (Number(assumptions.might) > 0) {
      candidates.push({
        id: 'Boon:Might',
        type: 'Boon',
        name: 'Might',
        label: 'Might'
      });
    }

    if (assumptions.fury) {
      candidates.push({
        id: 'Boon:Fury',
        type: 'Boon',
        name: 'Fury',
        label: 'Fury'
      });
    }

    if (assumptions.resolution) {
      candidates.push({
        id: 'Boon:Resolution',
        type: 'Boon',
        name: 'Resolution',
        label: 'Resolution'
      });
    }

    if (Number(assumptions.targetConditions?.Vulnerability) > 0) {
      candidates.push({
        id: 'Target:Vulnerability',
        type: 'Target',
        name: 'Vulnerability',
        label: 'Vulnerability'
      });
    }

    for (const name of new Set((app.build.weaponSigils || []).flat())) {
      if (!name) continue;
      candidates.push({
        id: `Sigil:${name}`,
        type: 'Sigil',
        name,
        label: `Sigil of ${name}`
      });
    }

    if (app.build.relic) {
      candidates.push({
        id: `Relic:${app.build.relic}`,
        type: 'Relic',
        name: app.build.relic,
        label: `Relic of ${app.build.relic}`
      });
    }

    if (FOOD_DATA[app.build.food]?.proc) {
      candidates.push({
        id: `Food:${app.build.food}`,
        type: 'Food',
        name: app.build.food,
        label: `Food: ${FOOD_DATA[app.build.food].proc.name}`
      });
    }

    for (const trait of app.attributeData?.activeTraits || []) {
      candidates.push({
        id: `Trait:${trait.name}`,
        type: 'Trait',
        name: trait.name,
        label: trait.name
      });
    }

    return candidates;
  }

  function modifierContributionRequest(app: ProfessionAppState): ModifierContributionRequest {
    const deterministicConfig = (config: Gw2Config): Gw2Config =>
      config.randomness?.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        ? {
            ...config,
            randomness: {
              ...config.randomness,
              mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC
            }
          }
        : config;
    let baseConfig = deterministicConfig(simulationConfig(app));
    if (app.build.relic !== 'Eagle') {
      baseConfig = {
        ...baseConfig,
        target: { ...baseConfig.target, health: 0 }
      };
    }

    const comparisons = modifierCandidates(app).map((modifier) => {
      let config = deterministicConfig(simulationConfig(app, modifier));
      if (app.build.relic !== 'Eagle') {
        config = {
          ...config,
          target: { ...config.target, health: 0 }
        };
      }

      return { modifier, config };
    });
    return {
      gameId: 'gw2',
      contentId: profession.id,
      rotation: app.build.rotation,
      baseConfig,
      comparisons
    };
  }

  function calculateModifierContributions({ rotation, baseConfig, comparisons }: ModifierContributionRequest) {
    return calculateContributionComparisons({ rotation, baseConfig, comparisons }, simulateBuild);
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
    const config = simulationConfig(app);
    // Detailed tables and timelines need one stable run. When distribution
    // mode is selected, keep that baseline deterministic and calculate RNG
    // percentiles separately.
    return config.randomness?.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
      ? {
          ...config,
          randomness: {
            ...config.randomness,
            mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC
          }
        }
      : config;
  }

  function rotationEndStateAt(app: ProfessionAppState, insertionIndex: number): Gw2SimulationResult['endState'] {
    const rotation = app.build.rotation;
    const index = Math.max(0, Math.min(Math.floor(Number(insertionIndex) || 0), rotation.length));
    if (index === rotation.length && app.results?.endState) {
      return app.results.endState;
    }

    return simulateBuild(rotation.slice(0, index), baselineSimulationConfig(app)).endState;
  }

  /** Captures a clone-safe baseline job before later edits can mutate the rotation. */
  function baselineSimulationRequest(app: ProfessionAppState): BaselineSimulationRequest {
    return {
      gameId: 'gw2',
      contentId: profession.id,
      rotation: cloneRotation(app.build.rotation),
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
    const { rotation, referenceRotation, baseConfig, selectedPatchId, previewPatchId } = request;
    if (!previewPatchId) {
      return {
        result: simulateBuild(rotation, baseConfig),
        patchComparison: null,
        ...(referenceRotation ? { referenceResult: simulateBuild(referenceRotation, baseConfig) } : null)
      };
    }

    const configForPatch = (patchId: string): Gw2Config => ({
      ...baseConfig,
      patchId,
      patchValues: profession.patchValuesFor?.(patchId) || Object.freeze({})
    });
    const current = simulateBuild(rotation, configForPatch('current'));
    const preview = simulateBuild(rotation, configForPatch(previewPatchId));
    return {
      result: selectedPatchId === previewPatchId ? preview : current,
      patchComparison: { patchId: previewPatchId, current, preview },
      // Reference uses only the selected patch; patch comparison remains a Current-only analysis.
      ...(referenceRotation
        ? { referenceResult: simulateBuild(referenceRotation, configForPatch(selectedPatchId)) }
        : null)
    };
  }

  function runSimulation(app: ProfessionAppState): Gw2SimulationResult {
    const output = calculateBaselineSimulation(baselineSimulationRequest(app));
    app.patchComparison = output.patchComparison;
    app.results = output.result;
    return app.results;
  }

  const api: ProfessionRuntimeApi = {
    simulateBuild,
    eliteSpecialization,
    recalculate,
    simulationConfig,
    modifierContributionRequest,
    calculateModifierContributions,
    randomDistributionRequest,
    relicComparisonRequest,
    calculateRandomDistribution,
    rotationEndStateAt,
    baselineSimulationRequest,
    calculateBaselineSimulation,
    runSimulation
  };
  return api;
}
