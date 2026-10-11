import type { Gw2SimulationConfigOptions } from '#gw2/app/types.js';
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

/**
 * Assembles common equipment, boon, target, weapon, and stat simulation input.
 * Profession adapters supply specialization, traits, and resource semantics.
 */
export function createGw2SimulationConfig({
  app,
  attributeData,
  attributeDataByWeaponSet,
  specialization,
  disabled = null,
  selectedTraitIds = [],
  initialResource = 0
}: Gw2SimulationConfigOptions): Gw2Config {
  const assumptions = app.build.assumptions as ProfessionBuildAssumptions;
  const targetSkillActivationsPerSecond = Math.max(0, Number(assumptions.targetSkillActivationsPerSecond) || 0);
  const alliedPlayerCount = boundedInteger(assumptions.alliedPlayerCount || 0, 0, 0, 4);
  const targetConditions = { ...(assumptions.targetConditions || {}) };
  if (disabled?.type === 'Target' && disabled.name === 'Vulnerability') {
    delete targetConditions.Vulnerability;
  }

  const sigilSets = [1, 2]
    .map((setNumber) => weaponSigilsForSet(app.build, setNumber))
    .map((names) => (disabled?.type === 'Sigil' ? names.filter((name) => name !== disabled.name) : names))
    .map(aggregateSigilSet);
  // Only common equipment seeds cross the worker boundary; profession bonuses are evaluated by the selected runtime.
  const seeds =
    attributeDataByWeaponSet?.length === 2
      ? attributeDataByWeaponSet.map((data) => data.attributeSeed)
      : [attributeData.attributeSeed, attributeData.attributeSeed];
  const attributeInputs = { weaponSets: [seeds[0], seeds[1]] as const };
  const professionAssumptionControls = assumptionControlsForSpecialization(
    app.adapter?.assumptionControls || [],
    specialization
  );

  return {
    patchId: app.patchId || 'current',
    // Carry build-local rates into workers and every comparison/optimization request.
    procRateOverrides: normalizeProcRateOverrides(assumptions.procRateOverrides),
    // Snapshot browser-level timing preferences for workers, comparisons, and optimizer candidates.
    transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
    specialization,
    selectedTraitIds: selectedTraitIds as readonly SkillId[],
    selectedSkillIds: app.adapter?.slotLoadout
      ? app.adapter.slotLoadout.selectedSkillIds({
          build: app.build,
          specialization,
          professionState: app.results?.planningState?.profession
        })
      : Object.values(app.build.selectedSkillIds).filter((id): id is SkillId => id !== null),
    primaryWeapon: app.build.weapons[0],
    secondaryWeapon: app.build.weapons[1],
    weaponSet2Primary: app.build.alternateWeapons[0],
    weaponSet2Secondary: app.build.alternateWeapons[1],
    startingWeaponSet: app.build.startingWeaponSet === 2 ? 2 : 1,
    initialResource,
    randomness: simulationRandomnessFromAssumptions(assumptions),
    criticalDamageMode: normalizeCriticalDamageMode(assumptions.criticalDamageMode),
    professionAssumptions: Object.fromEntries(
      professionAssumptionControls.map((control) => [control.key, assumptions[control.key] ?? control.defaultValue])
    ),
    attributeInputs,
    sigilSets,
    relic: disabled?.type === 'Relic' ? '' : app.build.relic,
    // Temporary relic selections travel with every simulation of this build, including optimizer candidates.
    precastRelics: [...(app.build.precastRelics || [])],
    food: disabled?.type === 'Food' ? '' : app.build.food,
    // Preserve damage-only utilities and allow contribution comparisons to remove their effect.
    utility: disabled?.type === 'Utility' ? '' : app.build.utility,
    timeOfDay: assumptions.timeOfDay === 'night' ? 'night' : 'day',
    boons: {
      might: disabled?.type === 'Boon' && disabled.name === 'Might' ? 0 : Number(assumptions.might || 0),
      fury: disabled?.type === 'Boon' && disabled.name === 'Fury' ? false : Boolean(assumptions.fury),
      // Console timing boons are permanent, even when a build bypasses application loading.
      quickness: true,
      alacrity: true,
      protection: Boolean(assumptions.protection),
      resolution: disabled?.type === 'Boon' && disabled.name === 'Resolution' ? false : Boolean(assumptions.resolution),
      regeneration: Boolean(assumptions.regeneration),
      swiftness: Boolean(assumptions.swiftness),
      vigor: Boolean(assumptions.vigor),
      aegis: Boolean(assumptions.aegis)
    },
    sharePlayerBoonsWithSummons: assumptions.sharePlayerBoonsWithSummons !== false,
    allies: {
      count: alliedPlayerCount,
      strikesPerSecond: 1
    },
    target: {
      armor: app.build.targetArmor,
      health: Math.max(0, Number(app.build.targetHealth) || 0),
      // Starting health is a fraction of maximum health so low-health gates and death share one source of truth.
      startingHealthFraction: boundedNumber(Number(app.build.targetStartingHealthPercent ?? 100) / 100, 1, 0, 1),
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
