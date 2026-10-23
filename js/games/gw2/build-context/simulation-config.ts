import { BOON, CONDITION } from '#gw2/platform/constants.js';
import type { Gw2AttributeSeed } from '#gw2/platform/attributes/types.js';
import type { BuildContextInput, ProfessionModifier } from '#gw2/build-context/types.js';
import type { ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';

interface SimulationConfigOptions extends Omit<BuildContextInput, 'patch'> {
  readonly patchId: string;
  readonly attributeSeeds: readonly [Gw2AttributeSeed, Gw2AttributeSeed];
  readonly specialization: string;
  readonly disabled?: ProfessionModifier;
  readonly selectedSkillIds: readonly SkillId[];
  readonly selectedTraitIds: readonly SkillId[];
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
}
import { assumptionControlsForSpecialization } from '#gw2/platform/builds/assumptions.js';
import { normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import { simulationRandomnessFromAssumptions } from '#gw2/platform/builds/randomness-assumptions.js';
import type { ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import { normalizeCriticalDamageMode } from '#gw2/platform/combat/critical-damage-mode.js';
import { aggregateSigilSet, weaponSigilsForSet } from '#gw2/platform/equipment/sigils/loadout.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { boundedInteger, boundedNumber } from '#kernel/core/numeric.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';

/** Keep baseline and modifier comparisons stable while preserving all other simulation settings. */
export function deterministicSimulationConfig(config: Gw2Config): Gw2Config {
  return config.randomness?.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
    ? {
        ...config,
        randomness: { ...config.randomness, mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC }
      }
    : config;
}

/** Copy the numeric seed graph without serializing newly assembled config branches on every candidate. */
function snapshotSeed(seed: Gw2AttributeSeed): Gw2AttributeSeed {
  const totals = seed.commonTotals;
  return {
    commonTotals: {
      ...totals,
      ...(totals.boonDurationBonuses ? { boonDurationBonuses: { ...totals.boonDurationBonuses } } : {}),
      ...(totals.conditionDurationBonuses ? { conditionDurationBonuses: { ...totals.conditionDurationBonuses } } : {})
    },
    conversionPool: { ...seed.conversionPool },
    conversions: seed.conversions.map((conversion) => ({ ...conversion })),
    sources: Object.fromEntries(Object.entries(seed.sources).map(([name, source]) => [name, { ...source }]))
  };
}

/**
 * Assembles common equipment, boon, target, weapon, and stat simulation input.
 * Profession adapters supply specialization, traits, and resource semantics.
 */
export function createGw2SimulationConfig({
  build,
  patchId,
  transitionDelays,
  selectedSkillIds,
  assumptionControls,
  attributeSeeds,
  specialization,
  disabled,
  selectedTraitIds
}: SimulationConfigOptions): Gw2Config {
  const assumptions = build.assumptions as ProfessionBuildAssumptions;
  const targetSkillActivationsPerSecond = Math.max(0, Number(assumptions.targetSkillActivationsPerSecond) || 0);
  const alliedPlayerCount = boundedInteger(assumptions.alliedPlayerCount || 0, 0, 0, 4);
  const targetConditions = { ...(assumptions.targetConditions || {}) };

  if (disabled?.type === 'Target' && disabled.name === CONDITION.VULNERABILITY) {
    delete targetConditions.Vulnerability;
  }

  const sigilSets = [1, 2]
    .map((setNumber) => weaponSigilsForSet(build, setNumber))
    .map((names) => (disabled?.type === 'Sigil' ? names.filter((name) => name !== disabled.name) : names))
    .map(aggregateSigilSet);
  // Only common equipment seeds cross the worker boundary; profession bonuses are evaluated by the selected runtime.
  const attributeInputs = {
    weaponSets: [snapshotSeed(attributeSeeds[0]), snapshotSeed(attributeSeeds[1])] as const
  };
  const professionAssumptionControls = assumptionControlsForSpecialization(assumptionControls, specialization);

  return {
    patchId,
    // Carry build-local rates into workers and every comparison/optimization request.
    procRateOverrides: normalizeProcRateOverrides(assumptions.procRateOverrides),
    // Snapshot explicit timing preferences for workers, comparisons, and optimizer candidates.
    transitionDelays: normalizeTransitionDelays(transitionDelays),
    specialization,
    selectedTraitIds: [...selectedTraitIds],
    // Removing a skill for contribution analysis also removes its intrinsic passives from every actor.
    selectedSkillIds: [...selectedSkillIds],
    primaryWeapon: build.weapons[0],
    secondaryWeapon: build.weapons[1],
    weaponSet2Primary: build.alternateWeapons[0],
    weaponSet2Secondary: build.alternateWeapons[1],
    startingWeaponSet: build.startingWeaponSet === 2 ? 2 : 1,
    initialResource: 0,
    randomness: { ...simulationRandomnessFromAssumptions(assumptions) },
    criticalDamageMode: normalizeCriticalDamageMode(assumptions.criticalDamageMode),
    professionAssumptions: structuredClone(
      Object.fromEntries(
        professionAssumptionControls.map((control) => [control.key, assumptions[control.key] ?? control.defaultValue])
      )
    ),
    attributeInputs,
    sigilSets,
    relic: disabled?.type === 'Relic' ? '' : build.relic,
    // Temporary relic selections travel with every simulation of this build, including optimizer candidates.
    precastRelics: [...(build.precastRelics || [])],
    food: disabled?.type === 'Food' ? '' : build.food,
    // Preserve damage-only utilities and allow contribution comparisons to remove their effect.
    utility: disabled?.type === 'Utility' ? '' : build.utility,
    timeOfDay: assumptions.timeOfDay === 'night' ? 'night' : 'day',
    boons: {
      might: disabled?.type === 'Boon' && disabled.name === BOON.MIGHT ? 0 : Number(assumptions.might || 0),
      fury: disabled?.type === 'Boon' && disabled.name === BOON.FURY ? false : Boolean(assumptions.fury),
      // Console timing boons are permanent, even when a build bypasses application loading.
      quickness: true,
      alacrity: true,
      protection: Boolean(assumptions.protection),
      resolution:
        disabled?.type === 'Boon' && disabled.name === BOON.RESOLUTION ? false : Boolean(assumptions.resolution),
      regeneration: Boolean(assumptions.regeneration),
      swiftness: Boolean(assumptions.swiftness),
      vigor: Boolean(assumptions.vigor),
      aegis: Boolean(assumptions.aegis)
    },
    sharePlayerBoonsWithSummons: assumptions.sharePlayerBoonsWithSummons !== false,
    allies: {
      count: alliedPlayerCount,
      // Model each ally attacking every 520 ms so shared effects use the agreed attack cadence.
      strikesPerSecond: 1000 / 520
    },
    target: {
      armor: build.targetArmor,
      health: Math.max(0, Number(build.targetHealth) || 0),
      // Starting health is a fraction of maximum health so low-health gates and death share one source of truth.
      startingHealthFraction: boundedNumber(Number(build.targetStartingHealthPercent ?? 100) / 100, 1, 0, 1),
      // Existing professions retain the historical defiant-golem default.
      // Defiant doubles as the positional proxy: a defiant golem never rotates,
      // so flanking/behind bonuses always apply and need no separate control.
      defiant: Boolean(assumptions.targetDefiant ?? true),
      conditions: targetConditions,
      moving: Boolean(assumptions.targetMoving),
      activatingSkills: targetSkillActivationsPerSecond > 0,
      confusionActivationsPerSecond: targetSkillActivationsPerSecond
    }
  };
}
