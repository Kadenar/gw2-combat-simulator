import { createScheduler } from "../engine/scheduler.js";
import { createGw2ConditionResolution } from "./resolver/condition-resolution.js";
import {
  createGw2ResolverEventHandlers,
} from "./resolver/event-handlers.js";
import { createGw2HitResolution } from "./resolver/hit-resolution.js";
import { resolveGw2Timeline } from "./resolver/resolve-timeline.js";
import {
  createGw2ResolverRuntimeState,
} from "./resolver/runtime-state.js";
import {
  WEAPON_DATA,
} from "./gear-data.js";
import {
  createGw2CombatQuery,
  selectedGw2TraitValues,
} from "./query.js";
import {
  gw2WeaponStrength,
} from "./runtime-rules.js";
import { createGw2SchedulerPolicy } from "./scheduler/policy.js";

const WEAPON_STRENGTHS = Object.freeze(Object.fromEntries(
  Object.entries(WEAPON_DATA)
    .map(([name, data]) => [name, Number(data.weaponStrength || 0)]),
));

function conditionName(value) {
  const name = String(value || "");
  const normalized = name.toLowerCase();
  if (normalized === "poison" || normalized === "poisoned") return "Poisoned";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function reactionContext(ctx) {
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
  const endTime = scheduled.state.time;
  const skillName = id =>
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
    profession: structuredClone(projected ?? resolved.profession),
  };
}

export function simulateDeclarativeGw2({
  profession,
  rotation,
  config = {},
} = {}) {
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
      profession.eventReactions.condition?.(
        reactionContext(ctx),
        application,
        { application },
      );
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
      Object.entries(profession.eventReactions).map(([type, handler]) => [
        type,
        (ctx, event, details) =>
          handler(reactionContext(ctx), event, details),
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
      weaponStrength: (event, currentConfig) => gw2WeaponStrength(
        event,
        currentConfig,
        { strengths: WEAPON_STRENGTHS },
      ),
    },
    createRuntimeState(options) {
      const runtime = createGw2ResolverRuntimeState(options);
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
      typeof profession.createResolverState === "function"
        ? profession.createResolverState(config, scheduled)
        : (
            scheduled.stream.resolverHandoff?.professionState
            ?? profession.createProfessionState(config)
          ),
  });
  return {
    ...resolved,
    steps: scheduled.steps,
    endState: endState(profession, scheduled, resolved),
    schedulerState: scheduled.state,
    snapshot: scheduled.snapshot,
    warnings: [...scheduled.warnings, ...resolved.warnings],
  };
}
