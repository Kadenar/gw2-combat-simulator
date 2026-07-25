import { createEvent } from "./events.js";
import { createCooldownController } from "./cooldown-controller.js";
import { normalizeRotation } from "./rotation-commands.js";
import { createSchedulerState } from "./scheduler-state.js";
import { buildScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";

// Shared declarative scheduler. It owns canonical command execution, cooldown
// and ammo bookkeeping, event emission, and the scheduler-to-resolver handoff.
// Professions customize behavior through the profession contract and injected
// scheduler policy rather than forking this state machine.

/**
 * Reads a skill's base cast duration from canonical metadata.
 */
function baseDurationSeconds(skill) {
  if (skill.castTimeMs != null) return Math.max(0, Number(skill.castTimeMs)) / 1000;
  return Math.max(0, Number(skill.activation ?? skill.castTime ?? 0));
}

/**
 * Resolves the first timestamp at which an effect should fire.
 */
function effectAt(start, fullEnd, effect) {
  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return start + Number(effect.ticks[0].atMs) / 1000;
  }
  if (Array.isArray(effect.atMsList) && effect.atMsList.length) {
    return start + Number(effect.atMsList[0]) / 1000;
  }
  if (effect.atCastEndOffsetMs != null) {
    return fullEnd + Number(effect.atCastEndOffsetMs) / 1000;
  }
  if (effect.atMs != null) return start + Number(effect.atMs) / 1000;
  if (effect.at != null) return start + Number(effect.at);
  return fullEnd;
}

/**
 * Expands declarative skill effects into canonical scheduled events. This is
 * only used when a profession hook does not fully handle the cast itself.
 */
function scheduleDeclarativeEffects(context, skill, start, fullEnd, effectiveEnd) {
  const interrupted = effectiveEnd < fullEnd - context.epsilon;
  for (let index = 0; index < (skill.effects || []).length; index += 1) {
    const effect = skill.effects[index];
    const timing =
      context.schedulerPolicy.effectTiming?.(
        {
          ...context,
          skill,
          start,
          fullEnd,
          effectiveEnd,
        },
        skill,
        effect,
      )
      ?? effect;
    const firstAt = effectAt(start, fullEnd, timing);
    if (interrupted && firstAt > effectiveEnd + context.epsilon) continue;
    const base = {
      source: effect.source || context.profession.id,
      sourceId: effect.sourceId ?? skill.id,
      actorType: effect.actorType || "player",
      skillId: skill.id,
      skillName: skill.name,
    };
    if (effect.type === "strike") {
      const ticks = Array.isArray(timing.ticks)
        ? timing.ticks
        : null;
      const atMsList = Array.isArray(timing.atMsList)
        ? timing.atMsList.map(Number)
        : null;
      const hits = ticks?.length
        || atMsList?.length
        || Math.max(1, Math.trunc(Number(effect.hits || 1)));
      const equalCoefficient = Number(effect.coefficient || 0) / hits;
      const interval =
        Math.max(0, Number(timing.intervalMs || 0)) / 1000;
      for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
        const tick = ticks?.[hitIndex - 1];
        const at = tick
          ? start + Number(tick.atMs) / 1000
          : atMsList
            ? start + atMsList[hitIndex - 1] / 1000
            : firstAt + (hitIndex - 1) * interval;
        if (interrupted && at > effectiveEnd + context.epsilon) break;
        context.emit({
          ...base,
          type: "damage",
          at,
          name: effect.name || skill.name,
          coefficient: tick
            ? Number(tick.coefficient)
            : equalCoefficient,
          hits: 1,
          hitIndex,
          totalHits: hits,
          skillWeapon: effect.weapon || skill.weapon || "",
          canCrit: effect.canCrit !== false,
          ...(effect.metadata || {}),
        });
      }
    } else if (effect.type === "condition") {
      if (Array.isArray(timing.ticks)) {
        for (
          let applicationIndex = 1;
          applicationIndex <= timing.ticks.length;
          applicationIndex += 1
        ) {
          const tick = timing.ticks[applicationIndex - 1];
          const at = start + Number(tick.atMs) / 1000;
          if (interrupted && at > effectiveEnd + context.epsilon) break;
          context.emit({
            ...base,
            at,
            type: "condition",
            name: effect.name || `${skill.name} — ${tick.condition}`,
            condition: tick.condition,
            stacks: Number(tick.stacks),
            duration: Number(tick.duration),
            applicationIndex,
            totalApplications: timing.ticks.length,
            ...(effect.metadata || {}),
          });
        }
        continue;
      }
      context.emit({
        ...base,
        at: firstAt,
        type: "condition",
        name: `${skill.name} — ${effect.condition}`,
        condition: effect.condition,
        stacks: Number(effect.stacks),
        duration: Number(effect.duration),
        ...(effect.metadata || {}),
      });
    } else if (effect.type === "control" || effect.type === "blind") {
      context.emit({
        ...base,
        at: firstAt,
        type: effect.type,
        ...(effect.metadata || {}),
      });
    } else if (effect.type === "boon" || effect.type === "buff") {
      const baseDuration = Math.max(0, Number(effect.duration || 0));
      const duration =
        context.schedulerPolicy.effectDuration?.(
          context,
          skill,
          effect,
          baseDuration,
        )
        ?? baseDuration;
      context.emit({
        ...base,
        at: firstAt,
        type: "buff",
        kind: String(effect.boon || effect.kind || effect.name || "").toLowerCase(),
        stacks: Math.max(1, Number(effect.stacks || 1)),
        duration: Math.max(0, Number(duration || 0)),
      });
    } else if (effect.type === "custom") {
      context.emit({
        ...base,
        at: firstAt,
        ...effect.event,
        type: effect.eventType,
      });
    }
  }
}

/**
 * Creates a scheduler instance for one profession/configuration pair.
 */
export function createScheduler({
  profession,
  config = {},
  catalog = profession?.catalog,
  startingTime = 0,
  epsilon = 0.0001,
  schedulerPolicy = {},
} = {}) {
  if (!profession?.id) throw new TypeError("Scheduler requires a profession.");
  const initialWeaponSet = schedulerPolicy.initialWeaponSet?.({
    profession,
    config,
  }) ?? 1;
  const state = createSchedulerState({
    profession,
    config,
    startingTime,
    activeWeaponSet: initialWeaponSet,
  });
  const events = [];
  const steps = [];
  const warnings = [];
  let order = 0;
  let previousCastStart = state.time;
  let hasPreviousCast = false;
  let combatStartTime = null;

  const context = {
    profession,
    config,
    catalog,
    state,
    events,
    warnings,
    epsilon,
    schedulerPolicy,
    emit(event) {
      const normalized = createEvent({ ...event, __order: order++ });
      events.push(normalized);
      state.pendingEvents.push(normalized);
      return normalized;
    },
    buffStacks(kind, at = state.time) {
      const normalized = String(kind || "").toLowerCase();
      const permanent = config.boons?.[normalized];
      const base = permanent === true ? 1 : Number(permanent || 0);
      return events
        .filter(event =>
          event.type === "buff"
          && String(event.kind || "").toLowerCase() === normalized
          && event.at <= at + epsilon
          && event.at + Number(event.duration || 0) > at + epsilon)
        .reduce((sum, event) => sum + Number(event.stacks || 1), base);
    },
    hasBuff(kind, at = state.time) {
      return context.buffStacks(kind, at) > 0;
    },
  };

  /**
   * Computes cast duration after shared policy and profession modifiers.
   */
  function castDurationFor(castContext, skill) {
    const baseDuration = baseDurationSeconds(skill);
    const sharedDuration = schedulerPolicy.castDuration?.(
      castContext,
      skill,
      baseDuration,
    ) ?? baseDuration;
    return Math.max(
      0,
      Number(profession.modifyCastDuration(castContext, sharedDuration) || 0),
    );
  }

  /**
   * Computes recharge duration after shared policy and profession modifiers.
   */
  function rechargeDurationFor(skill, at = state.time, details = {}) {
    const rechargeContext = {
      ...context,
      ...details,
      skill,
      at,
    };
    const baseDuration = Math.max(
      0,
      Number(skill.cooldown ?? skill.recharge ?? 0),
    );
    const sharedDuration = schedulerPolicy.rechargeDuration?.(
      rechargeContext,
      skill,
      baseDuration,
    ) ?? baseDuration;
    return Math.max(
      0,
      Number(
        profession.modifyRechargeDuration(
          rechargeContext,
          sharedDuration,
        ) || 0,
      ),
    );
  }

  /**
   * Computes the maximum ammo a skill should expose in the current context.
   */
  function maximumAmmoFor(skill) {
    const baseMaximum = Math.max(0, Number(skill.ammo || 0));
    const sharedMaximum = schedulerPolicy.maximumAmmo?.(
      { ...context, skill },
      skill,
      baseMaximum,
    ) ?? baseMaximum;
    return Math.max(
      0,
      Number(
        profession.modifyMaximumAmmo(
          { ...context, skill },
          sharedMaximum,
        ) || 0,
      ),
    );
  }

  const cooldownController = createCooldownController({
    state,
    epsilon,
    rechargeDuration: rechargeDurationFor,
    maximumAmmo: maximumAmmoFor,
  });
  context.cooldownController = cooldownController;
  profession.initialize(context);

  const skillFor = skillId =>
    catalog?.skillsById?.get(skillId)
    || catalog?.skills?.find(skill => skill.id === skillId);

  /**
   * Advances scheduler time, refreshing rechargeable state and giving the
   * profession hook a chance to progress its own timers.
   */
  function advanceTo(time) {
    const target = Math.max(state.time, Number(time));
    for (const skillId of state.ammo.keys()) {
      const skill = skillFor(skillId);
      if (skill) cooldownController.refreshAmmo(skill, target);
    }
    profession.advance(context, target);
    state.time = target;
    state.pendingEvents = state.pendingEvents
      .filter(event => event.at > target + epsilon);
  }

  /**
   * Executes one cast command, including cooldown waits, validation, event
   * emission, profession hooks, and step reporting.
   */
  function cast(command, commandIndex) {
    const skill = skillFor(command.skillId);
    if (!skill) {
      const reason = `Unknown skill id ${command.skillId}.`;
      warnings.push(reason);
      steps.push({
        ri: commandIndex,
        skill: String(command.skillId),
        start: Math.round(state.time * 1000),
        end: Math.round(state.time * 1000),
        invalid: true,
        invalidReason: reason,
      });
      return;
    }
    const concurrent = command.concurrentOffsetMs != null;
    let start = concurrent
      ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
      : state.time;
    let ammo = cooldownController.refreshAmmo(skill, start);
    let readyAt = ammo?.charges <= 0
      ? ammo.nextRechargeAt
      : state.cooldowns.get(skill.id) || 0;

    if (
      !concurrent
      && readyAt > start + epsilon
      && Number.isFinite(readyAt)
    ) {
      advanceTo(readyAt);
      start = state.time;
      ammo = cooldownController.refreshAmmo(skill, start);
      readyAt = ammo?.charges <= 0
        ? ammo.nextRechargeAt
        : state.cooldowns.get(skill.id) || 0;
    }

    if (
      (ammo && ammo.charges <= 0)
      || (!ammo && readyAt > start + epsilon)
    ) {
      const reason =
        `${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`;
      warnings.push(reason);
      steps.push({
        ri: commandIndex,
        skill: skill.name,
        start: Math.round(start * 1000),
        end: Math.round(start * 1000),
        invalid: true,
        invalidReason: reason,
      });
      return;
    }
    const castContext = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
      ammo,
    };
    if (
      schedulerPolicy.validateCast?.(castContext, skill) === false
      || !profession.validateCast(castContext, skill)
    ) {
      const reason = `${skill.name} is unavailable.`;
      warnings.push(reason);
      steps.push({
        ri: commandIndex,
        skill: skill.name,
        start: Math.round(start * 1000),
        end: Math.round(start * 1000),
        invalid: true,
        invalidReason: reason,
      });
      return;
    }

    const fullEnd = start + castDurationFor(castContext, skill);
    const effectiveEnd = command.interruptAfterMs == null
      ? fullEnd
      : Math.min(fullEnd, start + Number(command.interruptAfterMs) / 1000);
    const rechargeDuration = rechargeDurationFor(skill, effectiveEnd, {
      ...castContext,
      fullEnd,
      effectiveEnd,
    });
    const rechargeReadyAt = ammo
      ? (
          ammo.charges <= 1
            ? ammo.nextRechargeAt ?? effectiveEnd + rechargeDuration
            : null
        )
      : (
          rechargeDuration > 0
            ? effectiveEnd + rechargeDuration
            : null
        );
    const action = context.emit({
      type: "action",
      at: start,
      source: profession.id,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      rechargeReadyAt,
      interrupted: effectiveEnd < fullEnd - epsilon,
    });
    const handled = profession.scheduleSkill({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      rechargeReadyAt,
    }, skill);
    if (handled !== true) {
      scheduleDeclarativeEffects(context, skill, start, fullEnd, effectiveEnd);
    }

    if (ammo) {
      cooldownController.spendAmmo(skill, effectiveEnd);
    } else if (rechargeDuration) {
      state.cooldowns.set(skill.id, effectiveEnd + rechargeDuration);
    }
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);
    profession.afterCast({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      rechargeReadyAt,
    }, skill);
    steps.push({
      ri: commandIndex,
      skill: skill.name,
      start: Math.round(start * 1000),
      end: Math.round(effectiveEnd * 1000),
      actualStart: Math.round(start * 1000),
      fullCastMs: Math.round((fullEnd - start) * 1000),
      interrupted: effectiveEnd < fullEnd - epsilon,
    });
    previousCastStart = start;
    hasPreviousCast = true;
    state.time = concurrent
      ? Math.max(state.time, effectiveEnd)
      : effectiveEnd;
    advanceTo(state.time);
  }

  /**
   * Executes a normalized rotation and returns both the mutable scheduler state
   * and an immutable scheduled event stream for resolution.
   */
  function run(rotation) {
    const commands = normalizeRotation(rotation, catalog, { strict: true });
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (command.type === "wait") {
        const start = state.time;
        advanceTo(state.time + command.durationMs / 1000);
        steps.push({
          ri: index,
          skill: "Wait",
          start: Math.round(start * 1000),
          end: Math.round(state.time * 1000),
        });
      } else if (command.type === "combat-start") {
        if (combatStartTime != null) {
          const reason = "Combat Start is already set.";
          warnings.push(reason);
          steps.push({
            ri: index,
            skill: "Combat Start",
            start: Math.round(state.time * 1000),
            end: Math.round(state.time * 1000),
            invalid: true,
            invalidReason: reason,
          });
          continue;
        }
        const concurrent = (
          command.concurrentOffsetMs != null
          && hasPreviousCast
        );
        combatStartTime = concurrent
          ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
          : state.time;
        context.emit({
          type: "combat_start",
          at: combatStartTime,
          source: "platform",
          sourceId: "combat-start",
          action: "combat-start",
        });
        steps.push({
          ri: index,
          skill: "Combat Start",
          start: Math.round(combatStartTime * 1000),
          end: Math.round(combatStartTime * 1000),
        });
      } else {
        cast(command, index);
      }
    }
    sortQueuedEvents(events);
    return {
      state,
      events,
      steps,
      warnings,
      snapshot: profession.snapshot(context) ?? structuredClone(state.profession),
      stream: buildScheduledEventStream({
        events,
        rotationEndTime: Math.max(state.time, 0.001),
        resolverHandoff: {
          profession: profession.id,
          professionState: profession.snapshot(context)
            ?? structuredClone(state.profession),
          hasExplicitCombatStart: combatStartTime != null,
          combatStartTime,
        },
      }),
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}
