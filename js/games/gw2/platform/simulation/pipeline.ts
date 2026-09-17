import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { normalizeProcRateOverrides } from '#gw2/platform/builds/proc-rates.js';
import { rotationApm } from '#gw2/platform/simulation/rotation-apm.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import type { SchedulerRunResult } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { resolveGw2Timeline } from '#gw2/platform/resolver/resolve-timeline.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';
import { isSchedulerComboPrediction } from '#gw2/platform/combos/events.js';
import { isSchedulerSigilPrediction } from '#gw2/platform/equipment/sigils/proc-events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type {
  Gw2DeclarativeSimulationOptions,
  Gw2ProfessionContract,
  Gw2SimulationEndState,
  Gw2SimulationResult
} from '#gw2/platform/simulation/types.js';
import type { Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import type { Gw2ResolverResult } from '#gw2/platform/resolver/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';

export const MAX_SCHEDULER_REFINEMENT_PASSES = 5;

function endState(
  profession: Gw2ProfessionContract,
  config: Gw2Config,
  scheduled: SchedulerRunResult,
  resolved: Gw2ResolverResult
): Gw2SimulationEndState {
  // Scheduler state owns clocks/cooldowns/ammo; resolver state owns profession
  // effects. Use the final scheduler clock so tail-recovered resources and
  // remaining cooldowns describe the same observation instant.
  const endTime = scheduled.state.time;
  const skillName = (id: SkillId): string => profession.catalog?.skillsById?.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...scheduled.state.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(readyAt * 1000),
        remaining: Math.max(0, Math.round((readyAt - endTime) * 1000))
      }
    ])
  );
  const ammo = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [skillName(id), structuredClone(value)])
  );
  // Preserve exact skill identities for UI consumers because API variants can share names.
  const ammoBySkillId = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [String(id), structuredClone(value)])
  );
  // Project profession effects once; cooldowns and ammo remain owned by the scheduler.
  const projected = profession.projectEndState({
    config,
    schedulerContext: scheduled.context,
    schedulerState: scheduled.state,
    resolverState: resolved.profession
  });
  return {
    time: Math.round(endTime * 1000),
    cooldowns,
    ammo,
    ammoBySkillId,
    activeWeaponSet: scheduled.state.activeWeaponSet,
    // Projection lets a profession hide resolver-only bookkeeping.
    profession: structuredClone(projected ?? resolved.profession)
  };
}

/**
 * Runs the two-phase declarative pipeline: schedule canonical events first,
 * then resolve their timestamp-dependent numeric effects.
 */
function simulateDeclarativeGw2Pass(options: Gw2DeclarativeSimulationOptions & { output: 'score' }): Gw2SimulationScore;
function simulateDeclarativeGw2Pass(options: Gw2DeclarativeSimulationOptions): Gw2SimulationResult;
function simulateDeclarativeGw2Pass({
  onPhase,
  damageDiagnostics = false,
  output = 'detailed',
  profession,
  rotation,
  config = {},
  observationPolicy
}: Gw2DeclarativeSimulationOptions & { output?: 'detailed' | 'score' }): Gw2SimulationResult | Gw2SimulationScore {
  const started = onPhase ? performance.now() : 0;
  // Validate the headless entry path too, before any scheduler or resolver consumes custom probabilities.
  if (config.procRateOverrides !== undefined) {
    config = { ...config, procRateOverrides: normalizeProcRateOverrides(config.procRateOverrides) };
  }

  // All professions share immutable membership facts within this pass, including scheduler refinement passes.
  if (config.selectedSkills != null) {
    config = { ...config, selectedSkills: prepareSelectedSkillLoadout(config.selectedSkills) };
  }

  const runtimeProfession = resolveProfessionRuntime(profession, config);
  // Resolve traits once and share the exact selection between both phases.
  const traits = selectedGw2TraitValues(config, runtimeProfession.catalog);
  const scheduled = createScheduler({
    profession: runtimeProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config, {
      traits,
      catalog: runtimeProfession.catalog,
      weaponSkillMatchesSet: runtimeProfession.ui.weaponSkillMatchesSet as Gw2WeaponSkillMatcher | undefined
    }),
    observationPolicy
  }).run(rotation);
  onPhase?.('scheduling', performance.now() - started);
  // Critical sigil predictions remain scheduler-visible for profession state
  // and rotation legality, but resolver-time reactions own their actual output.
  const resolverStream = {
    ...scheduled.stream,
    events: scheduled.stream.events.filter(
      (event) => !isSchedulerSigilPrediction(event) && !isSchedulerComboPrediction(event)
    )
  };
  const resolved = resolveGw2Timeline({
    onPhase,
    damageDiagnostics,
    output,
    stream: resolverStream,
    profession: runtimeProfession,
    config,
    traits
  });
  // Both outputs preserve phase order, with scheduling diagnostics before resolution diagnostics.
  const warnings = [...new Set([...scheduled.warnings, ...resolved.warnings])];
  // Score output skips end-state and profession projections; scheduler and resolver state remain fresh per pass.
  if (output === 'score')
    return {
      ...(resolved as Gw2SimulationScore),
      warnings
    };
  const reportingStarted = onPhase ? performance.now() : 0;
  const detailed = resolved as Gw2ResolverResult;
  const result = {
    ...detailed,
    profession: structuredClone(flattenProfessionState(detailed.profession)),
    steps: scheduled.steps,
    rotationEndTime: scheduled.stream.rotationEndTime,
    // Detailed results preserve the full rotation's input rate even when damage reporting uses another window.
    rotationApm: rotationApm(scheduled, rotation, runtimeProfession.catalog),
    endState: endState(runtimeProfession, config, scheduled, detailed),
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    warnings
  };
  onPhase?.('reporting', performance.now() - reportingStarted);
  return result;
}

/** Audited professions use compact reporting; feedback and new professions default to the ordinary pipeline. */
export function simulateDeclarativeGw2Score(options: Gw2DeclarativeSimulationOptions): Gw2SimulationScore {
  const audited = ['elementalist', 'engineer', 'guardian', 'mesmer', 'ranger', 'revenant', 'thief', 'warrior'];
  if (audited.includes(options.profession.id) && !options.profession.simulation?.refineSchedulerConfig) {
    return simulateDeclarativeGw2Pass({ ...options, output: 'score' });
  }

  // Do not forward the caller's score flag into the detailed feedback passes.
  const result = simulateDeclarativeGw2({
    onPhase: options.onPhase,
    profession: options.profession,
    rotation: options.rotation,
    config: options.config,
    observationPolicy: options.observationPolicy
  });
  const {
    duration,
    combatStartTime,
    hasExplicitCombatStart,
    dpsStartTime,
    dpsWindow,
    firstHitTime,
    lastHitTime,
    deathTime,
    totalDamage,
    dps,
    strikeDamage,
    conditionDamage,
    environmentDamage,
    environmentDps,
    warnings
  } = result;
  return {
    output: 'score',
    duration,
    combatStartTime,
    hasExplicitCombatStart,
    dpsStartTime,
    dpsWindow,
    firstHitTime,
    lastHitTime,
    deathTime,
    totalDamage,
    dps,
    strikeDamage,
    conditionDamage,
    environmentDamage,
    environmentDps,
    warnings
  };
}

/**
 * Runs optional profession feedback passes when a scheduler decision depends
 * on damage-resolved state such as the target's current health.
 */
export function simulateDeclarativeGw2(options: Gw2DeclarativeSimulationOptions): Gw2SimulationResult {
  let config = options.config || {};
  const refineConfig = options.profession?.simulation?.refineSchedulerConfig;
  if (typeof refineConfig !== 'function') return simulateDeclarativeGw2Pass({ ...options, config });
  // Feedback discovers its final configuration after resolution. Capture only by replaying that configuration and seed.
  let result = simulateDeclarativeGw2Pass({ ...options, config, damageDiagnostics: false });

  for (let pass = 0; pass < MAX_SCHEDULER_REFINEMENT_PASSES; pass += 1) {
    const started = options.onPhase ? performance.now() : 0;
    const refined = refineConfig(config, result);
    options.onPhase?.('refinement', performance.now() - started);
    if (!refined) break;
    config = refined;
    result = simulateDeclarativeGw2Pass({ ...options, config, damageDiagnostics: false });
  }

  return options.damageDiagnostics ? simulateDeclarativeGw2Pass({ ...options, config }) : result;
}
