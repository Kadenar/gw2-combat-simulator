import { createGw2SimulationConfig } from '../simulation/config.js';
import { calculateContributionComparisons } from '../simulation/modifier-contributions.js';
import {
  DEFAULT_RANDOM_DISTRIBUTION_TRIALS,
  calculateRandomDistribution as calculateDistribution
} from '../simulation/random-distribution.js';
import { RELIC_COMPARISON_TARGET, relicComparisonAvailable } from '../simulation/relic-comparison.js';
import { FOOD_DATA } from '../../platform/gw2/gear-data.js';
import { SIMULATION_RANDOMNESS_MODES } from '../../platform/engine/core/simulation-random.js';
import { simulateGw2 } from '../../platform/gw2/simulate.js';
import type { ObservationPolicy, RotationCommand, Skill } from '../../platform/engine/types.js';
import type { Gw2Config, Gw2ProfessionContract, Gw2SimulationResult } from '../../platform/gw2/types.js';
import type {
  ModifierContributionRequest,
  ProfessionApplicationBuild,
  ProfessionAppState,
  ProfessionAttributeData,
  ProfessionBuildAssumptions,
  ProfessionModifier,
  ProfessionRuntimeApi,
  ProfessionRuntimeOptions,
  ProfessionSlotLoadout,
  RandomDistributionJobRequest,
  RandomDistributionOptions,
  RandomDistributionRequest,
  RandomDistributionSummary,
  RelicComparisonJobRequest
} from './types.js';

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
 * @param {ProfessionRuntimeOptions} options
 * @returns {ProfessionRuntimeApi} Runtime functions shared by the
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
      profession: profession as unknown as Gw2ProfessionContract,
      rotation,
      config,
      observationPolicy
    });

  const eliteNames = new Set(
    profession.catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name)
  );

  function eliteSpecialization(build: ProfessionApplicationBuild): string {
    return build.specializations.find((specialization) => eliteNames.has(specialization.name))?.name || 'Core';
  }

  /**
   * @param {ProfessionAppState} app
   * @returns {Skill[]}
   */
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

  /**
   * @param {ProfessionAppState} app
   * @param {ProfessionModifier | null} disabled
   * @returns {ProfessionAttributeData}
   */
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
    if (
      targetWeaponSet === displayedWeaponSet &&
      (!disabled || (disabled.type !== 'Trait' && disabled.type !== 'Boon'))
    ) {
      return app.attributeData;
    }

    let build: ProfessionApplicationBuild = app.build;
    if (disabled?.type === 'Boon') {
      const key = disabled.name.toLowerCase();
      build = {
        ...app.build,
        assumptions: {
          ...app.build.assumptions,
          [key]: key === 'might' ? 0 : false
        }
      };
    }

    return calculateAttributes(
      build,
      selectedSkills(app),
      targetWeaponSet,
      disabled?.type === 'Trait' ? disabled.name : null
    ) as ProfessionAttributeData;
  }

  /**
   * @param {ProfessionAppState} app
   * @param {ProfessionModifier | null} [disabled]
   * @returns {Gw2Config}
   */
  function simulationConfig(app: ProfessionAppState, disabled: ProfessionModifier | null = null): Gw2Config {
    const attributeData = attributesWithModifierDisabled(app, disabled);
    const attributeDataByWeaponSet = [1, 2].map((weaponSet) =>
      attributesWithModifierDisabled(app, disabled, weaponSet)
    );
    const specialization = eliteSpecialization(app.build);
    const activeTraits = attributeData.activeTraits || [];
    const config = createGw2SimulationConfig({
      app,
      attributeData,
      attributeDataByWeaponSet,
      specialization,
      disabled,
      selectedTraits: activeTraits.map((trait) => trait.name),
      selectedTraitIds: activeTraits.map((trait) => trait.id).filter((id) => id != null),
      ...(buildConfigInputs
        ? buildConfigInputs(app, {
            attributeData,
            specialization,
            activeTraits
          })
        : null)
    });
    return buildConfigExtras ? { ...config, ...buildConfigExtras(app) } : config;
  }

  /**
   * @param {ProfessionAppState} app
   * @returns {ProfessionModifier[]}
   */
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

  /**
   * @param {ProfessionAppState} app
   * @returns {ModifierContributionRequest}
   */
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
      professionId: profession.id,
      rotation: app.build.rotation,
      baseConfig,
      comparisons
    };
  }

  function calculateModifierContributions({ rotation, baseConfig, comparisons }: ModifierContributionRequest) {
    return calculateContributionComparisons({ rotation, baseConfig, comparisons }, simulateBuild);
  }

  function computeModifierContributions(app: ProfessionAppState) {
    return calculateModifierContributions(modifierContributionRequest(app));
  }

  /**
   * @param {ProfessionAppState} app
   * @returns {RandomDistributionJobRequest | null}
   */
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
      professionId: profession.id,
      rotation: app.build.rotation,
      baseConfig,
      trials: DEFAULT_RANDOM_DISTRIBUTION_TRIALS
    };
  }

  /**
   * Describes the opt-in Relic of Thorns break-even comparison for the equipped
   * relic, or null when the equipped relic is not an allowlisted opponent. The
   * base config is the same deterministic baseline used for the on-screen result
   * so the opponent curve matches `app.results` exactly.
   *
   * @param {ProfessionAppState} app
   * @returns {RelicComparisonJobRequest | null}
   */
  function relicComparisonRequest(app: ProfessionAppState): RelicComparisonJobRequest | null {
    const opponentRelic = String(app.build.relic || '');
    if (!relicComparisonAvailable(opponentRelic)) return null;
    return {
      professionId: profession.id,
      rotation: app.build.rotation,
      baseConfig: baselineSimulationConfig(app),
      opponentRelic,
      comparisonRelic: RELIC_COMPARISON_TARGET
    };
  }

  /**
   * @param {RandomDistributionRequest} request
   * @param {RandomDistributionOptions} [options]
   */
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

  function runSimulation(app: ProfessionAppState): Gw2SimulationResult {
    const baselineConfig = baselineSimulationConfig(app);
    const previewId = profession.preview?.id;
    if (!previewId) {
      app.patchComparison = null;
      app.results = simulateBuild(app.build.rotation, baselineConfig);
      return app.results;
    }

    const configForPatch = (patchId: string): Gw2Config => ({
      ...baselineConfig,
      patchId,
      patchValues: profession.patchValuesFor?.(patchId) || Object.freeze({})
    });
    const current = simulateBuild(app.build.rotation, configForPatch('current'));
    const preview = simulateBuild(app.build.rotation, configForPatch(previewId));
    app.patchComparison = { patchId: previewId, current, preview };
    app.results = app.patchId === previewId ? preview : current;
    return app.results;
  }

  const api: ProfessionRuntimeApi = {
    simulateBuild,
    eliteSpecialization,
    recalculate,
    simulationConfig,
    modifierCandidates,
    modifierContributionRequest,
    calculateModifierContributions,
    computeModifierContributions,
    randomDistributionRequest,
    relicComparisonRequest,
    calculateRandomDistribution,
    rotationEndStateAt,
    runSimulation
  };
  return api;
}
