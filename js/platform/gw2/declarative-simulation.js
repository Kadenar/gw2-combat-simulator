import { createScheduler } from "../engine/scheduler.js";
import { createGw2ConditionResolution } from "./resolver/condition-resolution.js";
import { createGw2ResolverEventHandlers } from "./resolver/event-handlers.js";
import { createGw2HitResolution } from "./resolver/hit-resolution.js";
import { resolveGw2Timeline } from "./resolver/resolve-timeline.js";
import { createGw2ResolverRuntimeState } from "./resolver/runtime-state.js";
import { WEAPON_DATA } from "./gear-data.js";
import { createGw2CombatQuery, selectedGw2TraitValues } from "./query.js";
import { gw2WeaponStrength } from "./runtime-rules.js";
import { createGw2SchedulerPolicy } from "./scheduler/policy.js";

// Flatten gear data once so resolver events can select a weapon strength without
// depending on the UI-facing gear schema.
const WEAPON_STRENGTHS = Object.freeze(
  Object.fromEntries(
    Object.entries(WEAPON_DATA).map(([name, data]) => [
      name,
      Number(data.weaponStrength || 0),
    ]),
  ),
);

function conditionName(value) {
  const name = String(value || "");
  const normalized = name.toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function reactionContext(ctx) {
  // Profession reactions historically read ctx.state. The shared resolver keeps
  // those fields at the root, so expose a compatibility view without copying maps.
  return {
    ...ctx,
    state: ctx.state || {
      profession: ctx.profession,
      totals: ctx.totals,
      conditions: ctx.conditions,
      warnings: ctx.warnings,
    },
  };
}

function endState(profession, scheduled, resolved) {
  // Scheduler state owns clocks/cooldowns/ammo; resolver state owns profession
  // effects. The public end state deliberately joins both halves.
  const endTime = scheduled.state.time;
  const skillName = (id) =>
    profession.catalog?.skillsById?.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...scheduled.state.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(readyAt * 1000),
        remaining: Math.max(0, Math.round((readyAt - endTime) * 1000)),
      },
    ]),
  );
  const ammo = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [
      skillName(id),
      structuredClone(value),
    ]),
  );
  const projected = profession.projectEndState(
    scheduled.context,
    resolved.profession,
  );
  return {
    time: Math.round(endTime * 1000),
    cooldowns,
    ammo,
    activeWeaponSet: scheduled.state.activeWeaponSet,
    // Projection lets a profession hide resolver-only bookkeeping.
    profession: structuredClone(projected ?? resolved.profession),
  };
}

/**
 * Runs the two-phase declarative pipeline: schedule canonical events first,
 * then resolve their timestamp-dependent numeric effects.
 */
export function simulateDeclarativeGw2({
  profession,
  rotation,
  config = {},
} = {}) {
  // Resolve traits once and share the exact selection between both phases.
  const traits = selectedGw2TraitValues(config, profession.catalog);
  const scheduled = createScheduler({
    profession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config, { traits }),
  }).run(rotation);
  const query = createGw2CombatQuery({
    profession,
    config,
    events: scheduled.stream.events,
    traits,
  });
  const hitResolution = createGw2HitResolution();
  const conditionResolution = createGw2ConditionResolution({
    onConditionApplied(ctx, application) {
      // Application reactions run after state insertion, allowing traits to
      // query the newly applied stack count.
      profession.eventReactions.condition?.(reactionContext(ctx), application, {
        application,
      });
    },
  });
  const commonHandlers = createGw2ResolverEventHandlers({
    hitResolution: {
      buildContext: hitResolution.buildHitResolutionContext,
      apply: hitResolution.applyResolvedHit,
    },
    conditions: {
      activeStackCount: conditionResolution.activeConditionStackCount,
      apply: conditionResolution.applyCondition,
      tick: conditionResolution.handleConditionTick,
    },
    eventReactions: Object.fromEntries(
      // Adapt profession callbacks to the legacy-compatible context view while
      // leaving common resolver handlers on the native runtime state.
      Object.entries(profession.eventReactions).map(([type, handler]) => [
        type,
        (ctx, event, details) => handler(reactionContext(ctx), event, details),
      ]),
    ),
  });
  const resolved = resolveGw2Timeline({
    stream: scheduled.stream,
    config,
    traits,
    query,
    helpers: {
      conditionName,
      skillsById: profession.catalog?.skillsById || new Map(),
      skillsByName: profession.catalog?.skillsByName || new Map(),
      weaponStrength: (event, currentConfig) =>
        gw2WeaponStrength(event, currentConfig, {
          strengths: WEAPON_STRENGTHS,
        }),
    },
    createRuntimeState(options) {
      const runtime = createGw2ResolverRuntimeState(options);
      // The alias keeps older profession handlers working during migration to
      // direct resolver fields.
      runtime.state = {
        profession: runtime.profession,
        totals: runtime.totals,
        conditions: runtime.conditions,
        warnings: runtime.warnings,
      };
      return runtime;
    },
    commonHandlers,
    professionHandlers: profession.eventHandlers,
    professionState:
      // A resolver-specific factory can rebuild ephemeral state. Otherwise use
      // the scheduler snapshot, falling back only for older professions.
      typeof profession.createResolverState === "function"
        ? profession.createResolverState(config, scheduled)
        : (scheduled.stream.resolverHandoff?.professionState ??
          profession.createProfessionState(config)),
  });
  return {
    ...resolved,
    steps: scheduled.steps,
    endState: endState(profession, scheduled, resolved),
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    // Preserve phase order so scheduling diagnostics appear before resolution
    // diagnostics in the UI.
    warnings: [...scheduled.warnings, ...resolved.warnings],
  };
}
