import { createEvent } from "./events.js";
import { createCooldownController } from "./cooldown-controller.js";
import { normalizeRotation } from "./rotation-commands.js";
import { createSchedulerState } from "./scheduler-state.js";
import { buildScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";
import { createTaskQueue } from "./task-queue.js";
import {
  resolveSkillHandlerMode,
  SKILL_HANDLER_MODES,
} from "./skill-handlers.js";

// Shared declarative scheduler. It owns canonical command execution, cooldown
// and ammo bookkeeping, event emission, and the scheduler-to-resolver handoff.
// Professions customize behavior through the profession contract and injected
// scheduler policy rather than forking this state machine.

/**
 * Reads a skill's base cast duration from canonical metadata.
 */
function baseDurationSeconds(skill) {
  return Math.max(0, Number(skill.castTimeMs || 0)) / 1000;
}

/**
 * Resolves the first timestamp at which an effect should fire.
 */
function effectAt(start, fullEnd, effect) {
  const origin = effect.timingAnchor === "castEnd" ? fullEnd : start;
  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return origin + Number(effect.ticks[0].atMs) / 1000;
  }
  if (effect.atMs != null) return origin + Number(effect.atMs) / 1000;
  return fullEnd;
}

/**
 * Expands declarative skill effects into canonical scheduled events. This is
 * only used when a profession hook does not fully handle the cast itself.
 */
function scheduleDeclarativeEffects(
  context,
  skill,
  start,
  fullEnd,
  effectiveEnd,
  observeEffect = () => {},
) {
  const interrupted = effectiveEnd < fullEnd - context.epsilon;
  const slotSkill = (
    skill.type === "Heal"
    || skill.type === "Utility"
    || skill.type === "Elite"
  );
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
    const cancelPendingEffects =
      interrupted && effect.persistsAfterInterrupt !== true;
    // An interrupt only suppresses effects that have not fired yet. Earlier
    // ticks remain in the stream even when the full cast never completes.
    // A committed channel can explicitly keep its remaining packets.
    if (
      cancelPendingEffects
      && firstAt > effectiveEnd + context.epsilon
    ) continue;
    const base = {
      source: effect.source || context.profession.id,
      sourceId: effect.sourceId ?? skill.id,
      actorType: effect.actorType || "player",
      skillId: skill.id,
      skillName: skill.name,
      ...(effect.persistsAfterInterrupt === true
        ? { persistsAfterInterrupt: true }
        : {}),
    };
    if (effect.type === "strike") {
      const ticks = Array.isArray(timing.ticks)
        ? timing.ticks
        : null;
      const hits = ticks?.length
        || Math.max(1, Math.trunc(Number(effect.hits || 1)));
      // A strike effect stores its total coefficient. Unless per-tick
      // coefficients are supplied, divide it evenly across emitted hits.
      const equalCoefficient = Number(effect.coefficient || 0) / hits;
      const interval =
        Math.max(0, Number(timing.intervalMs || 0)) / 1000;
      for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
        const tick = ticks?.[hitIndex - 1];
        const origin = timing.timingAnchor === "castEnd" ? fullEnd : start;
        const at = tick
          ? origin + Number(tick.atMs) / 1000
          : firstAt + (hitIndex - 1) * interval;
        if (
          cancelPendingEffects
          && at > effectiveEnd + context.epsilon
        ) break;
        const emitted = context.emit({
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
          skillWeapon:
            effect.weapon
            || skill.weapon
            || skill.skillWeapon
            || (slotSkill ? "Unequipped" : ""),
          canCrit: effect.canCrit !== false,
          ...(effect.coefficientModifiers
            ? { coefficientModifiers: effect.coefficientModifiers }
            : {}),
          ...(effect.metadata || {}),
        });
        observeEffect(emitted, effect, index);
      }
    } else if (effect.type === "condition") {
      if (Array.isArray(timing.ticks)) {
        const origin = timing.timingAnchor === "castEnd" ? fullEnd : start;
        for (
          let applicationIndex = 1;
          applicationIndex <= timing.ticks.length;
          applicationIndex += 1
        ) {
          const tick = timing.ticks[applicationIndex - 1];
          const at = origin + Number(tick.atMs) / 1000;
          if (
            cancelPendingEffects
            && at > effectiveEnd + context.epsilon
          ) break;
          const emitted = context.emit({
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
          observeEffect(emitted, effect, index);
        }
        continue;
      }
      const applications = Math.max(
        1,
        Math.trunc(Number(effect.applications || 1)),
      );
      const interval =
        Math.max(0, Number(timing.intervalMs || 0)) / 1000;
      for (
        let applicationIndex = 1;
        applicationIndex <= applications;
        applicationIndex += 1
      ) {
        const at = firstAt + (applicationIndex - 1) * interval;
        if (
          cancelPendingEffects
          && at > effectiveEnd + context.epsilon
        ) break;
        const emitted = context.emit({
          ...base,
          at,
          type: "condition",
          name: `${skill.name} — ${effect.condition}`,
          condition: effect.condition,
          stacks: Number(effect.stacks),
          duration: Number(effect.duration),
          applicationIndex,
          totalApplications: applications,
          ...(effect.metadata || {}),
        });
        observeEffect(emitted, effect, index);
      }
    } else if (effect.type === "control" || effect.type === "blind") {
      const applications = Math.max(
        1,
        Math.trunc(Number(effect.applications || 1)),
      );
      const interval =
        Math.max(0, Number(timing.intervalMs || 0)) / 1000;
      for (
        let applicationIndex = 1;
        applicationIndex <= applications;
        applicationIndex += 1
      ) {
        const at = firstAt + (applicationIndex - 1) * interval;
        if (
          cancelPendingEffects
          && at > effectiveEnd + context.epsilon
        ) break;
        const emitted = context.emit({
          ...base,
          at,
          type: effect.type,
          applicationIndex,
          totalApplications: applications,
          ...(effect.metadata || {}),
        });
        observeEffect(emitted, effect, index);
      }
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
      const emitted = context.emit({
        ...base,
        at: firstAt,
        type: "buff",
        kind: String(effect.boon || effect.kind || effect.name || "").toLowerCase(),
        stacks: Math.max(1, Number(effect.stacks || 1)),
        duration: Math.max(0, Number(duration || 0)),
      });
      observeEffect(emitted, effect, index);
    } else if (effect.type === "custom") {
      const emitted = context.emit({
        ...base,
        at: firstAt,
        ...effect.event,
        type: effect.eventType,
      });
      observeEffect(emitted, effect, index);
    }
  }
}

const CORE_CAST_COMPLETE = "platform.cast-complete";
const ACTION_SAFETY_LIMIT = 100_000;

function unavailable(reason, code = "platform.unavailable", retryAt = null) {
  return { ready: false, retryAt, reason, code };
}

function combineAvailability(results) {
  // A non-retryable denial is final. Otherwise all constraints must be ready,
  // so the scheduler waits for the latest retry timestamp.
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
  // Reservations separate "a cast has started" from "its completion has
  // committed cooldown/ammo state". inFlight provides a skill-keyed lookup;
  // reservations retains the lifecycle data used by the completion task.
  const inFlight = new Map();
  const reservations = new Map();
  // Scheduling hooks may emit more events. A FIFO observation queue flattens
  // that recursion so every event is observed exactly once in causal order.
  const observationQueue = [];
  let observingEvents = false;
  let observationCount = 0;
  let eventOrder = 0;
  // Derived events share their cause's integer order and use fractional
  // suffixes, keeping them adjacent to the cause at equal timestamps.
  const derivedEventCounts = new Map();
  let reservationOrder = 0;
  let previousCastStart = state.time;
  // serialReadyAt controls ordinary rotation sequencing. latestReservedEnd
  // prevents waits and later serial casts from passing concurrent reservations.
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
    hasExplicitCombatStart: false,
    combatStartTime: null,
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
            const observed = observationQueue.shift();
            schedulerPolicy.onEventScheduled?.(context, observed);
            profession.onEventScheduled(context, observed);
          }
        } finally {
          observingEvents = false;
        }
      }
      return normalized;
    },
    replaceEvent(event, updates) {
      const replacement = createEvent({ ...event, ...updates });
      const replaceReference = collection => {
        const index = collection.indexOf(event);
        if (index >= 0) collection[index] = replacement;
      };
      replaceReference(events);
      replaceReference(state.pendingEvents);
      replaceReference(observationQueue);
      return replacement;
    },
    emitDerived(cause, event) {
      const rootOrder = Math.floor(
        Number(cause?.causalOrder ?? cause?.__order),
      );
      if (!Number.isFinite(rootOrder)) {
        throw new TypeError("Derived events require a scheduled cause.");
      }
      const count = (derivedEventCounts.get(rootOrder) || 0) + 1;
      derivedEventCounts.set(rootOrder, count);
      return context.emit({
        ...event,
        causalOrder: rootOrder + count / 1_000_000,
        triggeredBy:
          event.triggeredBy
          ?? cause.skillName
          ?? cause.name
          ?? "",
      });
    },
    buffStacks(kind, at = state.time) {
      const normalized = String(kind || "").toLowerCase();
      const permanent = config.boons?.[normalized];
      const base = permanent === true ? 1 : Number(permanent || 0);
      // Scheduled buff events are already known even if the scheduler clock has
      // not reached them, so both their start and half-open expiry are checked.
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
    // Shared game rules run before profession-specific modifiers. The same
    // ordering is used for recharge and maximum-ammo calculations below.
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
    // Ammo skills have two independent timings: per-charge recharge and an
    // optional post-cast lockout based on the skill's normal recharge field.
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
    // Cooldown/ammo commitment precedes the profession completion hook so the
    // hook observes the state players would have immediately after the cast.
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
    ...(schedulerPolicy.taskHandlers || {}),
    ...profession.taskHandlers,
  };
  // Later spreads intentionally win, allowing a profession to specialize a
  // policy task type while the core completion task remains the default.
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
      // Advance continuous state before executing discrete work at that same
      // timestamp. Tasks created by a handler are drained before moving on.
      refreshSharedState(next);
      schedulerPolicy.advance?.(context, next);
      profession.advance(context, next);
      state.time = next;
      taskQueue.drainThrough(next, context);
    }
    refreshSharedState(target);
    schedulerPolicy.advance?.(context, target);
    profession.advance(context, target);
    state.time = target;
    // pendingEvents is only a scheduler-side view of future work; the complete
    // canonical event list remains in events for the resolver handoff.
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
    // rechargeReadyAt is preferred to effectiveEnd because a concurrent cast
    // cannot reuse the same skill while its reservation still owns recharge.
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
    for (const lockout of skill.lockouts || []) {
      const lockoutReadyAt = Number(state.lockouts.get(lockout.group) || 0);
      if (lockoutReadyAt > at + epsilon) {
        result.push(unavailable(
          `${skill.name} is locked by ${lockout.group} until `
            + `${lockoutReadyAt.toFixed(3)}.`,
          "platform.skill-group-lockout",
          lockoutReadyAt,
        ));
      }
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
    // A permanent profession denial cannot become valid after shared state is
    // refreshed, so return it before running policy/legacy validation.
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
    // Concurrent offsets are relative to the previous cast's start, not the
    // current clock. This models instant/concurrent actions embedded in a cast.
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
    // Retryable availability automatically advances through whichever happens
    // first: the declared retry time or a state-changing scheduled task.
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
    for (const lockout of skill.lockouts || []) {
      state.lockouts.set(
        lockout.group,
        Math.max(
          Number(state.lockouts.get(lockout.group) || 0),
          start + Number(lockout.durationMs) / 1000,
        ),
      );
    }
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
    const canonicalRechargeStart =
      skill.rechargeAnchor === "castStart" ? start : effectiveEnd;
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
          canonicalRechargeStart,
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
    // Register the reservation before lifecycle hooks emit anything. Re-entrant
    // availability checks therefore see this cast as already in flight.
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
    const handler = profession.skillHandlerFor?.(skill);
    const handlerMode = resolveSkillHandlerMode(
      handler,
      lifecycleContext,
      skill,
    );
    const handlerState = handler?.beforeEffects?.(lifecycleContext, skill);
    // The profession-level hook remains for schedulers that still own their
    // complete event materialization; catalog handlers use explicit strategies.
    const professionHandled =
      profession.scheduleSkill(lifecycleContext, skill) === true;
    if (
      handlerMode !== SKILL_HANDLER_MODES.REPLACE
      && !professionHandled
    ) {
      scheduleDeclarativeEffects(
        context,
        skill,
        start,
        fullEnd,
        effectiveEnd,
        (event, effect, effectIndex) => handler?.afterEffect?.(
          lifecycleContext,
          skill,
          event,
          handlerState,
          { effect, effectIndex },
        ),
      );
    }
    handler?.afterEffects?.(lifecycleContext, skill, handlerState);
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
    // Completion runs early among same-time tasks so following state work sees
    // committed cooldown/ammo and the profession's completed-cast state.
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

  schedulerPolicy.initialize?.(context);
  profession.initialize(context);

  function run(rotation) {
    const commands = normalizeRotation(rotation, catalog, { strict: true });
    context.hasExplicitCombatStart = commands.some(
      command => command.type === "combat-start",
    );
    context.combatStartTime = null;
    if (commands.length > ACTION_SAFETY_LIMIT) {
      throw new Error("Rotation action safety limit exceeded.");
    }
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (command.type === "wait") {
        // Wait is serial: it starts only after all outstanding casts finish.
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
      } else if (command.type === "cooldown-reset") {
        // Benchmark logs can include a pre-cast followed by the training-area
        // cooldown reset. The field remains active while skill recharges reset.
        const at = Math.max(state.time, serialReadyAt, latestReservedEnd);
        advanceTo(at);
        state.cooldowns.clear();
        state.ammo.clear();
        state.lockouts.clear();
        profession.onCooldownReset(context);
        context.emit({
          type: "marker",
          at,
          source: "platform",
          sourceId: "cooldown-reset",
          action: "cooldown-reset",
          name: "Cooldown Reset",
        });
        steps.push({
          ri: index,
          skill: "Cooldown Reset",
          start: Math.round(at * 1000),
          end: Math.round(at * 1000),
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
        // Like a concurrent cast, an explicitly offset combat marker is
        // anchored to the previous cast start.
        advanceTo(combatStartTime);
        context.combatStartTime = combatStartTime;
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
    const persistentEffectEnd = events
      .filter(event =>
        event.persistsAfterInterrupt === true
        || event.extendsResolutionHorizon === true)
      .reduce((latest, event) => Math.max(latest, Number(event.at)), rotationEnd);
    return {
      context,
      state,
      events,
      steps,
      warnings,
      snapshot,
      stream: buildScheduledEventStream({
        events,
        rotationEndTime: Math.max(state.time, persistentEffectEnd, 0.001),
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
