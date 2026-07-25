import { createEvent } from "./events.js";
import { createCooldownController } from "./cooldown-controller.js";
import { normalizeRotation } from "./rotation-commands.js";
import { createSchedulerState } from "./scheduler-state.js";
import { buildScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";
import { createTaskQueue } from "./task-queue.js";

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

const CORE_CAST_COMPLETE = "platform.cast-complete";
const ACTION_SAFETY_LIMIT = 100_000;

function unavailable(reason, code = "platform.unavailable", retryAt = null) {
  return { ready: false, retryAt, reason, code };
}

function combineAvailability(results) {
  let combined = { ready: true };
  for (const result of results) {
    if (result == null || result === true || result.ready !== false) continue;
    if (result === false || result.retryAt == null) {
      return result === false
        ? unavailable("The skill is unavailable.")
        : result;
    }
    const retryAt = Number(result.retryAt);
    if (!Number.isFinite(retryAt)) {
      throw new TypeError("Cast availability retryAt must be finite or null.");
    }
    if (combined.ready || retryAt > combined.retryAt) {
      combined = { ...result, retryAt };
    }
  }
  return combined;
}

/**
 * Creates the profession-neutral chronological scheduler.
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
  const inFlight = new Map();
  const reservations = new Map();
  const observationQueue = [];
  let observingEvents = false;
  let observationCount = 0;
  let eventOrder = 0;
  let reservationOrder = 0;
  let previousCastStart = state.time;
  let serialReadyAt = state.time;
  let latestReservedEnd = state.time;
  let hasPreviousCast = false;
  let combatStartTime = null;
  let taskQueue;

  const skillFor = skillId =>
    catalog?.skillsById?.get(skillId)
    || catalog?.skills?.find(skill => skill.id === skillId);

  const context = {
    profession,
    config,
    catalog,
    state,
    events,
    warnings,
    epsilon,
    schedulerPolicy,
    inFlight,
    tasks: null,
    emit(event) {
      const normalized = createEvent({ ...event, __order: eventOrder++ });
      events.push(normalized);
      state.pendingEvents.push(normalized);
      observationQueue.push(normalized);
      if (!observingEvents) {
        observingEvents = true;
        try {
          while (observationQueue.length) {
            if (++observationCount > ACTION_SAFETY_LIMIT) {
              throw new Error("Scheduled-event observation safety limit exceeded.");
            }
            profession.onEventScheduled(context, observationQueue.shift());
          }
        } finally {
          observingEvents = false;
        }
      }
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

  function rechargeDurationFor(skill, at = state.time, details = {}) {
    const rechargeContext = {
      ...context,
      ...details,
      skill,
      at,
    };
    const ammoRecharge = Number(skill.ammoRecharge || 0);
    const baseDuration = Math.max(
      0,
      Number(
        details.ammoCastLockout
          ? Number(skill.ammo || 0) > 0
            ? skill.recharge ?? 0
            : 0
          : Number(skill.ammo || 0) > 0 && ammoRecharge > 0
          ? ammoRecharge
          : skill.cooldown ?? skill.recharge ?? 0,
      ),
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
  context.castDurationFor = castDurationFor;
  context.rechargeDurationFor = rechargeDurationFor;
  context.maximumAmmoFor = maximumAmmoFor;

  const completeReservation = (_taskContext, task) => {
    const reservation = reservations.get(task.payload.reservationId);
    if (!reservation) return;
    const {
      skill,
      castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
    } = reservation;
    const active = inFlight.get(skill.id);
    active?.delete(reservation.id);
    if (active?.size === 0) inFlight.delete(skill.id);
    if (reservation.ammo) {
      cooldownController.spendAmmo(skill, rechargeStart);
      if (ammoLockoutDuration > 0) {
        cooldownController.setAmmoLockout(
          skill,
          rechargeStart + ammoLockoutDuration,
          rechargeStart,
        );
      }
    } else if (rechargeDuration) {
      state.cooldowns.set(skill.id, rechargeStart + rechargeDuration);
    }
    profession.onCastComplete({
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      reservationId: reservation.id,
    }, skill);
    reservations.delete(reservation.id);
  };
  const taskHandlers = {
    [CORE_CAST_COMPLETE]: completeReservation,
    ...profession.taskHandlers,
  };
  taskQueue = createTaskQueue({
    handlers: taskHandlers,
    epsilon,
    safetyLimit: ACTION_SAFETY_LIMIT,
  });
  context.tasks = Object.freeze({
    schedule(task) {
      if (Number(task?.at) < state.time - epsilon) {
        throw new RangeError("Scheduled tasks cannot be placed before the clock.");
      }
      return taskQueue.schedule(task);
    },
    cancel: taskQueue.cancel,
    cancelOwner: taskQueue.cancelOwner,
    nextAt: taskQueue.nextAt,
  });

  function refreshSharedState(at) {
    for (const skillId of state.ammo.keys()) {
      const skill = skillFor(skillId);
      if (skill) cooldownController.refreshAmmo(skill, at);
    }
  }

  function advanceTo(time) {
    const target = Math.max(state.time, Number(time));
    if (!Number.isFinite(target)) {
      throw new TypeError("Scheduler time must be finite.");
    }
    while (taskQueue.nextAt() <= target + epsilon) {
      const next = Math.max(state.time, taskQueue.nextAt());
      refreshSharedState(next);
      profession.advance(context, next);
      state.time = next;
      taskQueue.drainThrough(next, context);
    }
    refreshSharedState(target);
    profession.advance(context, target);
    state.time = target;
    state.pendingEvents = state.pendingEvents
      .filter(event => event.at > target + epsilon);
  }
  context.advanceTo = advanceTo;

  function engineAvailability(skill, at) {
    const ammo = cooldownController.refreshAmmo(skill, at);
    const readyAt = state.cooldowns.get(skill.id) || 0;
    const active = inFlight.get(skill.id);
    const activeReservations = active?.size
      ? [...active]
          .map(id => reservations.get(id))
          .filter(Boolean)
      : [];
    const reservedUntil = activeReservations.length
      ? Math.max(...activeReservations.map(reservation =>
          reservation.rechargeReadyAt
          ?? reservation.effectiveEnd
          ?? at))
      : 0;
    const result = [];
    if (
      readyAt > at + epsilon
      || (ammo && ammo.charges <= 0)
    ) {
      result.push(unavailable(
        `${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`,
        "platform.cooldown",
        readyAt,
      ));
    }
    if (reservedUntil > at + epsilon) {
      result.push(unavailable(
        `${skill.name} is already being cast until ${reservedUntil.toFixed(3)}.`,
        "platform.in-flight",
        reservedUntil,
      ));
    }
    return { ammo, result: combineAvailability(result) };
  }

  function castAvailability(skill, command, commandIndex, start) {
    const preliminaryContext = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
      ammo: state.ammo.get(skill.id) || null,
    };
    const professionAvailability =
      profession.availability(preliminaryContext, skill);
    if (professionAvailability?.ready === false
      && professionAvailability.retryAt == null) {
      return {
        result: professionAvailability,
        castContext: preliminaryContext,
      };
    }
    const shared = engineAvailability(skill, start);
    const castContext = { ...preliminaryContext, ammo: shared.ammo };
    const policyAvailability =
      schedulerPolicy.availability?.(castContext, skill);
    const legacyReady =
      schedulerPolicy.validateCast?.(castContext, skill) !== false
      && profession.validateCast(castContext, skill);
    const result = combineAvailability([
      shared.result,
      policyAvailability,
      professionAvailability,
      legacyReady
        ? null
        : unavailable(
            `${skill.name} is unavailable.`,
            "platform.legacy-validation",
          ),
    ]);
    return { result, castContext };
  }

  function recordInvalid(commandIndex, skill, start, reason) {
    warnings.push(reason);
    steps.push({
      ri: commandIndex,
      skill: skill.name,
      start: Math.round(start * 1000),
      end: Math.round(start * 1000),
      invalid: true,
      invalidReason: reason,
    });
  }

  function cast(command, commandIndex = steps.length) {
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
      return false;
    }
    const concurrent = command.concurrentOffsetMs != null;
    let start = concurrent
      ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
      : Math.max(state.time, serialReadyAt, latestReservedEnd);
    if (start < state.time - epsilon) {
      recordInvalid(
        commandIndex,
        skill,
        start,
        `${skill.name} cannot start before the current simulation clock.`,
      );
      return false;
    }
    advanceTo(start);

    let checked = castAvailability(skill, command, commandIndex, start);
    let guard = 0;
    while (
      checked.result.ready === false
      && checked.result.retryAt != null
    ) {
      if (++guard > ACTION_SAFETY_LIMIT) {
        throw new Error("Cast availability wait safety limit exceeded.");
      }
      const retryAt = Math.max(state.time, Number(checked.result.retryAt));
      const nextTaskAt = taskQueue.nextAt();
      const next = Math.min(retryAt, nextTaskAt);
      if (
        !Number.isFinite(next)
        || next <= state.time
      ) {
        throw new Error(
          `Cast availability for ${skill.name} did not make progress.`,
        );
      }
      advanceTo(next);
      start = state.time;
      checked = castAvailability(skill, command, commandIndex, start);
    }
    if (checked.result.ready === false) {
      recordInvalid(
        commandIndex,
        skill,
        start,
        String(checked.result.reason || `${skill.name} is unavailable.`),
      );
      return false;
    }

    const castContext = { ...checked.castContext, start };
    const fullEnd = start + castDurationFor(castContext, skill);
    const interruptAfterMs =
      command.interruptAfterMs ?? skill.defaultInterruptMs;
    const effectiveEnd = interruptAfterMs == null
      ? fullEnd
      : Math.min(fullEnd, start + Number(interruptAfterMs) / 1000);
    const rechargeDuration = rechargeDurationFor(skill, effectiveEnd, {
      ...castContext,
      fullEnd,
      effectiveEnd,
    });
    const ammoLockoutDuration =
      castContext.ammo && Number(skill.ammo || 0) > 0
      ? rechargeDurationFor(skill, effectiveEnd, {
          ...castContext,
          fullEnd,
          effectiveEnd,
          ammoCastLockout: true,
        })
      : 0;
    const rechargeStart = Math.max(
      start,
      Number(
        profession.modifyRechargeStart(
          {
            ...castContext,
            fullEnd,
            effectiveEnd,
            rechargeDuration,
          },
          effectiveEnd,
        ),
      ),
    );
    const ammoChargeReadyAt =
      castContext.ammo && castContext.ammo.charges <= 1
        ? castContext.ammo.nextRechargeAt
          ?? rechargeStart + rechargeDuration
        : 0;
    const ammoLockoutReadyAt = castContext.ammo && ammoLockoutDuration > 0
      ? rechargeStart + ammoLockoutDuration
      : 0;
    const rechargeReadyAt = castContext.ammo
      ? Math.max(ammoChargeReadyAt, ammoLockoutReadyAt) || null
      : rechargeDuration > 0
        ? rechargeStart + rechargeDuration
        : null;
    const reservationId = `cast:${++reservationOrder}`;
    const reservation = {
      id: reservationId,
      skill,
      ammo: castContext.ammo,
      castContext,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      action: null,
    };
    reservations.set(reservationId, reservation);
    if (!inFlight.has(skill.id)) inFlight.set(skill.id, new Set());
    inFlight.get(skill.id).add(reservationId);

    const action = context.emit({
      type: "action",
      at: start,
      source: profession.id,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      rechargeReadyAt,
      interrupted: effectiveEnd < fullEnd - epsilon,
    });
    reservation.action = action;
    const lifecycleContext = {
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      reservationId,
    };
    profession.onCastStart(lifecycleContext, skill);
    const handled = profession.scheduleSkill(lifecycleContext, skill);
    if (handled !== true) {
      scheduleDeclarativeEffects(context, skill, start, fullEnd, effectiveEnd);
    }
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);
    profession.afterCast(lifecycleContext, skill);
    context.tasks.schedule({
      id: `${reservationId}:complete`,
      type: CORE_CAST_COMPLETE,
      at: effectiveEnd,
      priority: -100,
      ownerId: reservationId,
      payload: { reservationId },
    });
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
    latestReservedEnd = Math.max(latestReservedEnd, effectiveEnd);
    if (!concurrent) serialReadyAt = effectiveEnd;
    return true;
  }

  profession.initialize(context);

  function run(rotation) {
    const commands = normalizeRotation(rotation, catalog, { strict: true });
    if (commands.length > ACTION_SAFETY_LIMIT) {
      throw new Error("Rotation action safety limit exceeded.");
    }
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (command.type === "wait") {
        const start = Math.max(state.time, serialReadyAt, latestReservedEnd);
        advanceTo(start);
        const end = start + command.durationMs / 1000;
        serialReadyAt = end;
        advanceTo(end);
        steps.push({
          ri: index,
          skill: "Wait",
          start: Math.round(start * 1000),
          end: Math.round(end * 1000),
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
          : Math.max(state.time, serialReadyAt, latestReservedEnd);
        advanceTo(combatStartTime);
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
    const rotationEnd = Math.max(state.time, serialReadyAt, latestReservedEnd);
    advanceTo(rotationEnd);
    // Settle profession state work deliberately queued one epsilon after the
    // final cast without following recurring actor tasks indefinitely.
    if (taskQueue.nextAt() <= rotationEnd + epsilon) {
      advanceTo(taskQueue.nextAt());
    }
    steps.sort((left, right) => left.ri - right.ri);
    sortQueuedEvents(events);
    const snapshot =
      profession.snapshot(context) ?? structuredClone(state.profession);
    return {
      context,
      state,
      events,
      steps,
      warnings,
      snapshot,
      stream: buildScheduledEventStream({
        events,
        rotationEndTime: Math.max(state.time, 0.001),
        resolverHandoff: {
          profession: profession.id,
          professionState: snapshot,
          hasExplicitCombatStart: combatStartTime != null,
          combatStartTime,
        },
      }),
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}
