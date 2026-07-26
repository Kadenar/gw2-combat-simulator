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
  criticalChance,
  criticalDamageMultiplier,
} from "./damage.js";
import { WEAPON_DATA } from "./gear-data.js";
import { relicConditionDurationBonus } from "./relic-rules.js";
import {
  gw2ConditionDurationMultiplier,
  gw2SigilSet,
  gw2StaticAttributes,
  gw2WeaponStrength,
} from "./runtime-rules.js";
import { createGw2TimelineIndex } from "./timeline-index.js";
import { createGw2SchedulerPolicy } from "./scheduler/policy.js";
import { gw2EventActorType } from "./event-ownership.js";
import { permanentTargetConditionStacks } from "./target-state.js";

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

// Builds a trait set that carries both the numeric id and the name for every
// selected trait, regardless of whether the config supplied ids, names, or
// both. Hooks can then query by TRAIT_ID constants or by name interchangeably.
function selectedTraitValues(config, catalog) {
  const values = new Set([
    ...(Array.isArray(config.traitIds) ? config.traitIds : []),
    ...(Array.isArray(config.selectedTraitIds) ? config.selectedTraitIds : []),
    ...(Array.isArray(config.selectedTraits) ? config.selectedTraits : []),
  ]);
  const byId = new Map();
  const byName = new Map();
  for (const trait of catalog?.traits || []) {
    byId.set(Number(trait.id), trait);
    byName.set(trait.name, trait);
  }
  for (const value of [...values]) {
    const trait = byName.get(value) || byId.get(Number(value));
    if (trait) {
      values.add(Number(trait.id));
      values.add(trait.name);
    }
  }
  return values;
}

function createQuery(profession, config, events, traits) {
  const timeline = createGw2TimelineIndex({ config, events });
  const configWithBaselineStats = {
    ...config,
    stats: {
      ...config.stats,
      power:
        config.stats?.power ?? config.attributes?.power ?? 1000,
      precision:
        config.stats?.precision ?? config.attributes?.precision ?? 1000,
      toughness:
        config.stats?.toughness ?? config.attributes?.toughness ?? 1000,
      vitality:
        config.stats?.vitality ?? config.attributes?.vitality ?? 1000,
      ferocity:
        config.stats?.ferocity ?? config.attributes?.ferocity ?? 0,
      conditionDamage:
        config.stats?.conditionDamage
        ?? config.attributes?.conditionDamage
        ?? 0,
      expertise:
        config.stats?.expertise ?? config.attributes?.expertise ?? 0,
      concentration:
        config.stats?.concentration ?? config.attributes?.concentration ?? 0,
      healingPower:
        config.stats?.healingPower ?? config.attributes?.healingPower ?? 0,
    },
  };
  let query;
  const runtimeBuffStacks = (runtime, kind, time, maximum) => {
    if (!runtime) return null;
    return Math.max(
      0,
      Math.min(
        maximum,
        (runtime.boons?.get(kind) || [])
          .filter(application =>
            application.at <= time
            && application.expiresAt > time)
          .reduce(
            (sum, application) =>
              sum + Number(application.stacks || 1),
            0,
          ),
      ),
    );
  };
  const mightStacksAt = (time, runtime) => {
    const dynamic = runtimeBuffStacks(runtime, "might", time, 25);
    if (dynamic == null) return timeline.mightStacksAt(time);
    return Math.min(25, Number(config.boons?.might || 0) + dynamic);
  };
  const furyActiveAt = (time, runtime) => {
    if (config.boons?.fury) return true;
    const dynamic = runtimeBuffStacks(runtime, "fury", time, 1);
    return dynamic == null
      ? timeline.furyActiveAt(time)
      : dynamic > 0;
  };
  const vulnerabilityStacksAt = (time, runtime) => {
    const dynamic = runtimeBuffStacks(
      runtime,
      "target-vulnerability",
      time,
      25,
    );
    if (dynamic == null) return timeline.vulnerabilityStacksAt(time);
    const permanent = permanentTargetConditionStacks(
      config,
      "Vulnerability",
    );
    return Math.min(25, permanent + dynamic);
  };
  const hookContext = (
    time,
    {
      event = null,
      condition = null,
      runtime = null,
    } = {},
  ) => ({
    profession,
    config,
    time,
    event,
    skillId: event?.skillId ?? null,
    sourceId: event?.sourceId ?? null,
    actorType: event ? gw2EventActorType(event) : null,
    condition,
    traits,
    query,
    timeline,
    events,
    runtime,
    state: runtime?.state ?? null,
  });
  const statsAt = (time, event = null, runtime = null) =>
    profession.modifyAttributes(
      hookContext(time, { event, runtime }),
      gw2StaticAttributes(
        configWithBaselineStats,
        mightStacksAt(time, runtime),
      ),
    );

  query = {
    statsAt,
    critical(event, time, runtime = null) {
      const stats = statsAt(time, event, runtime);
      let chance = criticalChance(stats.precision);
      chance += Number(config.stats?.criticalChanceBonus || 0) / 100;
      chance +=
        Number(timeline.activeSigilSetAt(time).criticalChanceBonus || 0) / 100;
      if (furyActiveAt(time, runtime)) chance += 0.25;
      chance = profession.modifyCriticalChance(
        hookContext(time, { event, runtime }),
        chance,
      );
      if (event.canCrit === false || event.noCrit) chance = 0;
      let damage = criticalDamageMultiplier(stats.ferocity);
      damage = profession.modifyCriticalDamage(
        hookContext(time, { event, runtime }),
        damage,
      );
      return {
        chance: Math.max(0, Math.min(1, chance)),
        damage: Math.max(1, Number(damage || 1)),
      };
    },
    strikeMultiplier(event, time, runtime = null) {
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100)
        * Number(timeline.activeSigilSetAt(time).strike || 1)
        * Number(config.modifiers?.strike || 1);
      return profession.modifyStrikeDamage(
        hookContext(time, { event, runtime }),
        base,
      );
    },
    conditionMultiplier(name, time, event = null, runtime = null) {
      const base =
        (1 + vulnerabilityStacksAt(time, runtime) / 100)
        * Number(timeline.activeSigilSetAt(time).condition || 1)
        * Number(config.modifiers?.condition || 1);
      return profession.modifyConditionDamage(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
    },
    conditionDurationMultiplier(
      name,
      time,
      stats = statsAt(time),
      event = null,
      runtime = null,
    ) {
      const sigils = timeline.activeSigilSetAt(time);
      const sigilBonus = (
        Number(sigils.conditionDurationBonus || 0)
        + Number(sigils.conditionDurationBonuses?.[name] || 0)
      ) / 100;
      const relicBonus =
        relicConditionDurationBonus(runtime, time)
        + (
          config.relic === "Aristocracy"
            ? timeline.aristocracyStacksAt(time) * 0.03
            : 0
        );
      const base = gw2ConditionDurationMultiplier(
        name,
        stats,
        sigilBonus + relicBonus,
      );
      const modified = profession.modifyConditionDuration(
        hookContext(time, {
          event,
          condition: name,
          runtime,
        }),
        base,
      );
      return Math.max(1, Math.min(2, Number(modified || 1)));
    },
    activeWeaponSetAt: timeline.activeWeaponSetAt,
    activeSigilSetAt: timeline.activeSigilSetAt,
    timedStacks: timeline.timedStacks,
  };
  return query;
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
  const traits = selectedTraitValues(config, profession.catalog);
  const scheduled = createScheduler({
    profession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config),
  }).run(rotation);
  const query = createQuery(
    profession,
    config,
    scheduled.stream.events,
    traits,
  );
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
