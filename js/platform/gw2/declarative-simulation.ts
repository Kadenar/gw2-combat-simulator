import { createScheduler } from '../engine/execution/scheduler.js';
import { cloneProfessionState, flattenProfessionState } from '../engine/profession/state.js';
import { resolveProfessionRuntime } from '../engine/profession/family.js';
import type { NormalizedProfessionContract, SchedulerRunResult, SkillId } from '../engine/types.js';
import { createGw2ConditionResolution } from './resolver/condition-resolution.js';
import { createGw2ResolverEventHandlers } from './resolver/event-handlers.js';
import { createGw2ResolverExtensions } from './resolver/extensions.js';
import { createGw2HitResolution } from './resolver/hit-resolution.js';
import { resolveGw2Timeline } from './resolver/resolve-timeline.js';
import { createGw2ResolverRuntimeState } from './resolver/runtime-state.js';
import { WEAPON_DATA } from './gear-data.js';
import { createGw2CombatQuery, selectedGw2TraitValues } from './query.js';
import { gw2WeaponStrength } from './runtime-rules.js';
import { createGw2SchedulerPolicy } from './scheduler/policy.js';
import { isSchedulerComboPrediction } from './combo-events.js';
import { isSchedulerSigilPrediction } from './sigil-proc-events.js';
import { canonicalTargetConditionName } from './target-state.js';
import type {
  Gw2Config,
  Gw2DeclarativeSimulationOptions,
  Gw2ProfessionContract,
  Gw2ResolverResult,
  Gw2SimulationEndState,
  Gw2SimulationResult,
  Gw2WeaponSkillMatcher
} from './types.js';

// Flatten gear data once so resolver events can select a weapon strength without
// depending on the UI-facing gear schema.
const WEAPON_STRENGTHS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(Object.entries(WEAPON_DATA).map(([name, data]) => [name, Number(data.weaponStrength || 0)]))
);

export const MAX_SCHEDULER_REFINEMENT_PASSES = 5;

function conditionName(value: unknown): string {
  return canonicalTargetConditionName(value);
}

function endState(
  profession: Gw2ProfessionContract,
  config: Gw2Config,
  scheduled: SchedulerRunResult,
  resolved: Gw2ResolverResult
): Gw2SimulationEndState {
  // Scheduler state owns clocks/cooldowns/ammo; resolver state owns profession
  // effects. The public end state deliberately joins both halves.
  const endTime = scheduled.stream.rotationEndTime;
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
  const projected = profession.projectEndState({
    config,
    schedulerContext: scheduled.context,
    schedulerState: scheduled.state,
    resolverState: resolved.profession
  });
  const simulationProjection =
    profession.simulation?.projectEndState?.({
      config,
      schedulerContext: scheduled.context,
      schedulerState: scheduled.state,
      resolverState: resolved.profession,
      cooldowns,
      ammo,
      profession: projected ?? resolved.profession
    }) || {};
  return {
    time: Math.round(endTime * 1000),
    cooldowns: simulationProjection.cooldowns || cooldowns,
    ammo: simulationProjection.ammo || ammo,
    ammoBySkillId,
    activeWeaponSet: scheduled.state.activeWeaponSet,
    // Projection lets a profession hide resolver-only bookkeeping.
    profession: cloneProfessionState(simulationProjection.profession ?? projected ?? resolved.profession)
  };
}

/**
 * Runs the two-phase declarative pipeline: schedule canonical events first,
 * then resolve their timestamp-dependent numeric effects.
 */
function simulateDeclarativeGw2Pass({
  profession,
  rotation,
  config = {},
  observationPolicy
}: Gw2DeclarativeSimulationOptions): Gw2SimulationResult {
  const runtimeProfession = resolveProfessionRuntime(
    profession as unknown as NormalizedProfessionContract,
    config
  ) as unknown as Gw2ProfessionContract;
  const engineProfession = runtimeProfession as unknown as NormalizedProfessionContract;
  // Resolve traits once and share the exact selection between both phases.
  const traits = selectedGw2TraitValues(config, runtimeProfession.catalog);
  const scheduled = createScheduler({
    profession: engineProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config, {
      traits,
      catalog: runtimeProfession.catalog,
      weaponSkillMatchesSet: runtimeProfession.ui.weaponSkillMatchesSet as Gw2WeaponSkillMatcher | undefined
    }),
    observationPolicy
  }).run(rotation);
  // Critical sigil predictions remain scheduler-visible for profession state
  // and rotation legality, but resolver-time reactions own their actual output.
  const resolverStream = {
    ...scheduled.stream,
    events: scheduled.stream.events.filter(
      (event) => !isSchedulerSigilPrediction(event) && !isSchedulerComboPrediction(event)
    )
  };
  const extensions = createGw2ResolverExtensions({
    config,
    events: resolverStream.events,
    professionReactions: runtimeProfession.eventReactions
  });
  const query = createGw2CombatQuery({
    profession: engineProfession,
    config,
    events: resolverStream.events,
    traits,
    conditionDurationBonus: extensions.conditionDurationBonus
  });
  const hitResolution = createGw2HitResolution({
    strikeMultiplier: extensions.strikeMultiplier
  });
  const conditionResolution = createGw2ConditionResolution({
    reactions: extensions.reactions,
    config
  });
  const commonHandlers = createGw2ResolverEventHandlers({
    hitResolution: {
      buildContext: hitResolution.buildHitResolutionContext,
      apply: hitResolution.applyResolvedHit
    },
    conditions: {
      activeStackCount: conditionResolution.activeConditionStackCount,
      apply: conditionResolution.applyCondition,
      tick: conditionResolution.handleConditionTick
    },
    reactions: extensions.reactions
  });
  const resolved = resolveGw2Timeline({
    stream: resolverStream,
    config,
    traits,
    query,
    helpers: {
      conditionName,
      skillsById: runtimeProfession.catalog?.skillsById || new Map(),
      skillsByName: runtimeProfession.catalog?.skillsByName || new Map(),
      balanceProfilesById: runtimeProfession.catalog?.balanceProfilesById || new Map(),
      weaponStrength: (event, currentConfig) =>
        gw2WeaponStrength(event, currentConfig, {
          strengths: WEAPON_STRENGTHS
        })
    },
    createRuntimeState(options) {
      return createGw2ResolverRuntimeState({
        ...options,
        createEquipmentState: extensions.createEquipmentState
      });
    },
    commonHandlers,
    reactions: extensions.reactions,
    beforeResolveTimeline: extensions.beforeResolveTimeline,
    professionHandlers: runtimeProfession.eventHandlers,
    professionState:
      // Resolver state is always time-zero state. Scheduler changes that matter
      // during numeric resolution must be represented by chronological events.
      typeof runtimeProfession.createResolverState === 'function'
        ? runtimeProfession.createResolverState(config)
        : runtimeProfession.createProfessionState(config)
  });
  return {
    ...resolved,
    profession: structuredClone(flattenProfessionState(resolved.profession)),
    steps: scheduled.steps,
    endState: endState(runtimeProfession, config, scheduled, resolved),
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    // Preserve phase order so scheduling diagnostics appear before resolution
    // diagnostics in the UI.
    warnings: [...new Set([...scheduled.warnings, ...resolved.warnings])]
  };
}

/**
 * Runs optional profession feedback passes when a scheduler decision depends
 * on damage-resolved state such as the target's current health.
 */
export function simulateDeclarativeGw2(options: Gw2DeclarativeSimulationOptions): Gw2SimulationResult {
  let config = options.config || {};
  let result = simulateDeclarativeGw2Pass({ ...options, config });
  const refineConfig = options.profession?.simulation?.refineSchedulerConfig;
  if (typeof refineConfig !== 'function') return result;

  for (let pass = 0; pass < MAX_SCHEDULER_REFINEMENT_PASSES; pass += 1) {
    const refined = refineConfig(config, result);
    if (!refined) break;
    config = refined;
    result = simulateDeclarativeGw2Pass({ ...options, config });
  }

  return result;
}
