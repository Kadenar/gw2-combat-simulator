import {
  createCastLifecycle,
  activationScopedOperations,
  CORE_CAST_COMPLETE
} from '#gw2/platform/execution/cast-lifecycle.js';
import {
  scheduleDeclarativeEffects,
  interruptCommitCutoffs,
  cancelledBeforeInterruptCommit
} from '#gw2/platform/execution/effect-adapter.js';
/**
 * The shared declarative scheduler. Owns canonical rotation-command execution,
 * cast/recharge timing, cooldown and ammo bookkeeping, effect materialization
 * and event emission, and the scheduler-to-resolver handoff. Professions
 * customize behavior through the profession contract and injected scheduler
 * policy rather than forking this state machine.
 */
import { ACTION_SAFETY_LIMIT, EPSILON } from '#kernel/core/clock.js';
import { castWasInterrupted, retainsInterruptedCastLockout } from '#gw2/platform/skills/timing.js';
import { CAST_READY, denyCast, foldAvailability, retryCast } from '#gw2/platform/engine/skills/availability.js';
import { createScheduledEvents } from '#gw2/platform/execution/scheduled-events.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import {
  normalizeObservationPolicy,
  observationEndTime,
  type ObservationPolicy
} from '#kernel/execution/observation.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { compareQueuedEvents } from '#kernel/events/queue.js';
import { canonicalTime, isTimeInWindow, timeKey } from '#kernel/core/clock.js';
import { createTaskQueue } from '#gw2/platform/execution/tasks.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { resolveSkillHandlerMode, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import type {
  AmmoState,
  AvailabilityResult,
  CastCommand,
  CastContext,
  CooldownController,
  ScheduledTask,
  RegisteredTaskHandler,
  ScheduledTaskHandler,
  ScheduledTaskInput,
  Scheduler,
  RechargeQueryDetails,
  SchedulerConfig,
  SchedulerState,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRunResult,
  SchedulerStep,
  SchedulerTaskAccess,
  TaskQueue
} from '#gw2/platform/execution/types.js';
import type { CanonicalCatalog, SkillMechanicTrigger, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionSource } from '#gw2/platform/engine/profession/types.js';

/** Payload of a declarative skill mechanic trigger scheduled at cast completion. */
interface SkillMechanicTaskPayload {
  readonly skillId: SkillId;
  readonly trigger: SkillMechanicTrigger;
  readonly castStart: number;
  readonly castEnd: number;
  readonly activationId?: string;
}

interface CreateSchedulerOptions<TProfessionState extends object> {
  readonly profession?: ProfessionSource<TProfessionState>;
  readonly config?: SchedulerConfig;
  readonly catalog?: CanonicalCatalog;
  readonly startingTime?: number;
  readonly schedulerPolicy?: SchedulerPolicy<TProfessionState>;
  readonly observationPolicy?: ObservationPolicy;
}

// Shared declarative scheduler. It owns canonical command execution, cooldown
// and ammo bookkeeping, event emission, and the scheduler-to-resolver handoff.
// Professions customize behavior through the profession contract and injected
// scheduler policy rather than forking this state machine.

/**
 * Reads a skill's base cast duration from canonical metadata.
 */
function baseDurationSeconds(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0)) / 1000;
}

function unavailable(reason: string, code = 'platform.unavailable', retryAt: number | null = null): AvailabilityResult {
  return retryAt == null ? denyCast(code, reason) : retryCast(retryAt, code, reason);
}

/**
 * Creates the profession-neutral chronological scheduler.
 */
export function createScheduler<TProfessionState extends object = object>({
  profession,
  config = {},
  catalog,
  startingTime = 0,
  schedulerPolicy = {},
  observationPolicy
}: CreateSchedulerOptions<TProfessionState> = {}): Scheduler<TProfessionState> {
  if (!profession?.id) throw new TypeError('Scheduler requires a profession.');
  const activeProfession = resolveProfessionRuntime(profession, config);
  const activeCatalog = catalog ?? activeProfession.catalog;
  const normalizedObservationPolicy = normalizeObservationPolicy(observationPolicy);
  const initialWeaponSet =
    schedulerPolicy.initialWeaponSet?.({
      profession: activeProfession,
      config
    }) ?? 1;
  const state = createSchedulerState({
    profession: activeProfession,
    config,
    startingTime,
    activeWeaponSet: initialWeaponSet
  });
  const steps: SchedulerStep[] = [];
  const warnings: string[] = [];
  // Reservations separate "a cast has started" from "its completion has
  // committed cooldown/ammo state". inFlight provides a skill-keyed lookup;
  // reservations retains the lifecycle data used by the completion task.
  const inFlight = new Map<SkillId, Set<string>>();
  // Off-target activations still schedule self/setup mechanics; tagging every descendant lets resolution skip only
  // hostile packets, including delayed pulses that land after Combat Start.
  const offTargetActivationIds = new Set<string>();
  let activationOrder = 0;
  let previousCastStart = state.time;
  // serialReadyAt and latestBlockingEnd control the player's cast lane.
  // latestInstantReadyAt stops instant skills at the actual interruption point
  // without making them wait through aftercast retained only for cast-time
  // skills. Independent skills use their own serial lane while latestReservedEnd
  // keeps waits and the final simulation horizon behind every outstanding cast.
  let serialReadyAt = state.time;
  let latestInstantReadyAt = state.time;
  let independentReadyAt = state.time;
  let latestBlockingEnd = state.time;
  let latestReservedEnd = state.time;
  // A self-stunning skill (e.g. Head Butt) blocks the serial cast lane until
  // this time. Non-stunbreak serial casts wait for it; a stunbreak ignores and
  // clears it. Stability at cast end prevents the stun from being set at all.
  let selfStunUntil = state.time;
  let hasPreviousCast = false;
  let combatStartTime: number | null = null;
  let taskQueue: TaskQueue<SchedulerContext<TProfessionState>, object>;

  const skillFor = (requestedId: SkillId): Skill | undefined => {
    // Resolve build-selected variants before looking up the skill so aliases spend the same resource pool.
    const skillId = activeProfession.modifySkillId(context, requestedId);
    return activeCatalog?.skillsById?.get(skillId) || activeCatalog?.skills?.find((skill) => skill.id === skillId);
  };

  const scheduledEvents = createScheduledEvents({
    prepareEvent(event) {
      const activationId = typeof event.activationId === 'string' ? event.activationId : null;
      const offTarget = event.offTarget === true || (activationId != null && offTargetActivationIds.has(activationId));
      const targetedEvent = offTarget ? { ...event, offTarget: true } : event;
      const professionPrepared = activeProfession.prepareEvent(context, targetedEvent);
      const prepared = schedulerPolicy.prepareEvent?.(context, professionPrepared) ?? professionPrepared;
      return { ...prepared, ...(offTarget ? { offTarget: true } : {}) };
    },
    observeEvent(event) {
      schedulerPolicy.onEventScheduled?.(context, event);
      activeProfession.onEventScheduled(context, event);
    },
    onEventReplaced(event, replacement) {
      schedulerPolicy.onEventReplaced?.(context, event, replacement);
    }
  });
  const { events } = scheduledEvents;

  const context: SchedulerContext<TProfessionState> = {
    profession: activeProfession,
    config,
    catalog: activeCatalog,
    state,
    events,
    warnings,
    schedulerPolicy,
    observationPolicy: normalizedObservationPolicy,
    observationEndTime:
      normalizedObservationPolicy.kind === 'absolute' ? normalizedObservationPolicy.endTimeMs / 1000 : null,
    inFlight,
    hasExplicitCombatStart: false,
    combatStartTime: null,
    tasks: null as unknown as SchedulerTaskAccess,
    cooldownController: null as unknown as CooldownController,
    castDurationFor,
    rechargeDurationFor,
    maximumAmmoFor,
    advanceTo,
    createActivationId(kind = 'effect') {
      const prefix = String(kind || 'effect');
      return `${prefix}:${++activationOrder}`;
    },
    eventsOfType: scheduledEvents.eventsOfType,
    eventByOrder: scheduledEvents.eventByOrder,
    emit: scheduledEvents.emit,
    emitDerived: scheduledEvents.emitDerived,
    replaceEvent: scheduledEvents.replaceEvent,
    buffStacks(/** @type {string} */ kind, at = state.time) {
      const normalized = String(kind || '').toLowerCase();
      const permanent = config.boons?.[normalized];
      const base = permanent === true ? 1 : Number(permanent || 0);
      // Scheduled buff events are already known even if the scheduler clock has
      // not reached them, so both their start and half-open expiry are checked.
      // Only this kind's indexed buffs are scanned, not the entire event log.
      const bucket = scheduledEvents.buffEvents(normalized);
      let stacks = base;
      for (const event of bucket || []) {
        if (isTimeInWindow(at, event.at, event.at + Number(event.duration || 0))) {
          stacks += Number(event.stacks || 1);
        }
      }

      return Math.max(
        0,
        Number(schedulerPolicy.buffStacks?.(context, normalized, at, base, bucket || [], stacks) ?? stacks)
      );
    },
    hasBuff(/** @type {string} */ kind, at = state.time) {
      return context.buffStacks(kind, at) > 0;
    }
  };

  function castDurationFor(castContext: CastContext<TProfessionState>, skill: Skill): number {
    const baseDuration = baseDurationSeconds(skill);
    // Shared game rules run before profession-specific modifiers. The same
    // ordering is used for recharge and maximum-ammo calculations below.
    const sharedDuration = schedulerPolicy.castDuration?.(castContext, skill, baseDuration) ?? baseDuration;
    return Math.max(0, Number(activeProfession.modifyCastDuration(castContext, sharedDuration) || 0));
  }

  function rechargeDurationFor<TDetails extends RechargeQueryDetails>(
    skill: Skill,
    at = state.time,
    details: TDetails = {} as TDetails
  ): number {
    const rechargeContext = {
      ...context,
      ...details,
      skill,
      // Existing profession rules use start; non-cast queries use their explicit query time.
      start: Number(details.start ?? at),
      at
    };
    const ammoRecharge = Number(skill.ammoRecharge || 0);
    // Ammo skills have two independent timings: per-charge recharge and an
    // optional post-cast lockout. `recharge` remains a fallback for catalogs
    // that have not migrated to the explicit ammo field yet.
    const baseDuration = Math.max(
      0,
      Number(
        details.ammoCastLockout
          ? Number(skill.ammo || 0) > 0
            ? (skill.ammoCastLockout ?? skill.recharge ?? 0)
            : 0
          : Number(skill.ammo || 0) > 0 && ammoRecharge > 0
            ? ammoRecharge
            : (skill.cooldown ?? skill.recharge ?? 0)
      )
    );
    const sharedDuration = schedulerPolicy.rechargeDuration?.(rechargeContext, skill, baseDuration) ?? baseDuration;
    return Math.max(0, Number(activeProfession.modifyRechargeDuration(rechargeContext, sharedDuration) || 0));
  }

  function maximumAmmoFor(skill: Skill): number {
    const baseMaximum = Math.max(0, Number(skill.ammo || 0));
    const sharedMaximum = schedulerPolicy.maximumAmmo?.({ ...context, skill }, skill, baseMaximum) ?? baseMaximum;
    return Math.max(0, Number(activeProfession.modifyMaximumAmmo({ ...context, skill }, sharedMaximum) || 0));
  }

  const cooldownController = createCooldownController({
    state,
    rechargeDuration: rechargeDurationFor,
    rechargeReduction: (skill, reduction, at) =>
      schedulerPolicy.rechargeReduction?.({ ...context, skill, at }, skill, reduction) ?? reduction,
    maximumAmmo: maximumAmmoFor
  });
  context.cooldownController = cooldownController;
  const lifecycle = createCastLifecycle(context);

  /** Dispatches one due trigger through the active profession's composed handler registry. */
  const handleSkillMechanicTrigger: ScheduledTaskHandler<
    SchedulerContext<TProfessionState>,
    SkillMechanicTaskPayload
  > = (taskContext, task) => {
    const trigger = task.payload?.trigger as SkillMechanicTrigger | undefined;
    const skillId = task.payload?.skillId as SkillId | undefined;
    if (!trigger || skillId == null) return;
    const skill = taskContext.catalog.skillsById.get(skillId);
    const handler = activeProfession.skillMechanicHandlers[trigger.type];
    if (!skill || !handler) return;
    handler({
      context: taskContext,
      skill,
      trigger,
      at: task.at,
      castStart: Number(task.payload?.castStart || 0),
      castEnd: Number(task.payload?.castEnd || 0),
      activationId: String(task.payload?.activationId || task.ownerId || '')
    });
  };

  const taskHandlers: Record<string, RegisteredTaskHandler<SchedulerContext<TProfessionState>>> = {
    [CORE_CAST_COMPLETE]: lifecycle.completeReservation
  };
  // Every task type has one owner; an extension must never replace cast completion or another category.
  for (const handlers of [
    schedulerPolicy.taskHandlers || {},
    activeProfession.taskHandlers,
    Object.fromEntries(
      Object.keys(activeProfession.skillMechanicHandlers).map((type) => [type, handleSkillMechanicTrigger])
    )
  ]) {
    for (const [type, handler] of Object.entries(handlers)) {
      if (Object.hasOwn(taskHandlers, type)) throw new TypeError(`Duplicate scheduled task handler: ${type}`);
      taskHandlers[type] = handler;
    }
  }

  const activationAwareTaskHandlers: Record<
    string,
    ScheduledTaskHandler<SchedulerContext<TProfessionState>, object>
  > = Object.fromEntries(
    Object.entries(taskHandlers).map(([type, handler]) => [
      type,
      (taskContext: SchedulerContext<TProfessionState>, task: ScheduledTask<object>) => {
        const payload = task.payload;
        const inheritedActivationId =
          payload && 'activationId' in payload && typeof payload.activationId === 'string'
            ? payload.activationId
            : payload && 'reservationId' in payload && typeof payload.reservationId === 'string'
              ? payload.reservationId
              : null;
        const taskActivationId = inheritedActivationId || taskContext.createActivationId('effect');
        // Independent recurring tasks must not pass their newly generated effect ID to the next execution.
        return handler(
          {
            ...taskContext,
            ...activationScopedOperations(taskContext, taskActivationId, inheritedActivationId)
          },
          // Tasks are dispatched by type, so the queued payload is the one this type's owner scheduled.
          task as ScheduledTask<never>
        );
      }
    ])
  );
  taskQueue = createTaskQueue({
    handlers: activationAwareTaskHandlers,
    safetyLimit: ACTION_SAFETY_LIMIT
  });
  context.tasks = Object.freeze({
    schedule(task: ScheduledTaskInput<object>) {
      if (canonicalTime(Number(task?.at)) < canonicalTime(state.time)) {
        throw new RangeError('Scheduled tasks cannot be placed before the clock.');
      }

      return taskQueue.schedule(task);
    },
    cancel: taskQueue.cancel,
    cancelOwner: taskQueue.cancelOwner,
    nextAt: taskQueue.nextAt
  });

  function refreshSharedState(at: number): void {
    for (const skillId of state.ammo.keys()) {
      const skill = skillFor(skillId);
      if (skill) cooldownController.refreshAmmo(skill, at);
    }
  }

  function advanceTo(time: number): void {
    const target = canonicalTime(Math.max(state.time, Number(time)));
    if (!Number.isFinite(target)) {
      throw new TypeError('Scheduler time must be finite.');
    }

    while (taskQueue.nextAt() <= target) {
      const next = Math.max(state.time, taskQueue.nextAt());
      // Advance continuous state before executing discrete work at that same
      // timestamp. Tasks created by a handler are drained before moving on.
      refreshSharedState(next);
      schedulerPolicy.advance?.(context, next);
      activeProfession.advance(context, next);
      state.time = next;
      taskQueue.drainThrough(next, context);
    }

    refreshSharedState(target);
    schedulerPolicy.advance?.(context, target);
    activeProfession.advance(context, target);
    state.time = target;
    // Expiration hooks can enqueue already-due work on this final advance; finish it before checking cast readiness.
    taskQueue.drainThrough(target, context);
  }

  function engineAvailability(skill: Skill, at: number): { ammo: AmmoState | null; result: AvailabilityResult } {
    const ammo = cooldownController.refreshAmmo(skill, at);
    const readyAt = state.cooldowns.get(skill.id) || 0;
    const active = inFlight.get(skill.id);
    const activeReservations = active?.size
      ? [...active].map((id) => lifecycle.reservation(id)).filter((reservation) => reservation != null)
      : [];
    const reservedUntil = activeReservations.length
      ? Math.max(
          ...activeReservations.map((reservation) => reservation.rechargeReadyAt ?? reservation.effectiveEnd ?? at)
        )
      : 0;
    // rechargeReadyAt is preferred to effectiveEnd because a concurrent cast
    // cannot reuse the same skill while its reservation still owns recharge.
    const result: AvailabilityResult[] = [];
    if ((readyAt > at + EPSILON && skill.usableWhileRecharging !== true) || (ammo && ammo.charges <= 0)) {
      result.push(
        unavailable(`${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`, 'platform.cooldown', readyAt)
      );
    }

    if (reservedUntil > at + EPSILON && skill.independentCastCanOverlap !== true) {
      result.push(
        unavailable(
          `${skill.name} is already being cast until ${reservedUntil.toFixed(3)}.`,
          'platform.in-flight',
          reservedUntil
        )
      );
    }

    for (const lockout of skill.lockouts || []) {
      const lockoutReadyAt = Number(state.lockouts.get(lockout.group) || 0);
      if (lockoutReadyAt > at + EPSILON) {
        result.push(
          unavailable(
            `${skill.name} is locked by ${lockout.group} until ` + `${lockoutReadyAt.toFixed(3)}.`,
            'platform.skill-group-lockout',
            lockoutReadyAt
          )
        );
      }
    }

    return { ammo, result: foldAvailability(result) };
  }

  function castAvailability(
    skill: Skill,
    command: CastCommand,
    commandIndex: number,
    start: number
  ): {
    result: AvailabilityResult;
    castContext: CastContext<TProfessionState>;
  } {
    // Input recovery is checked before profession rules, which may change while scheduled events advance.
    const inputReadyAt = schedulerPolicy.inputReadyAt?.(context, start) ?? start;
    const preliminaryContext: CastContext<TProfessionState> = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
      ammo: state.ammo.get(skill.id) || null
    };
    if (inputReadyAt > start + EPSILON) {
      return {
        result: retryCast(inputReadyAt, 'platform.input-lockout', 'Transition delay'),
        castContext: preliminaryContext
      };
    }

    const professionAvailability = activeProfession.availability(preliminaryContext, skill);
    // A command-scoped profession denial cannot become valid after shared state
    // is refreshed, so return it before running shared and policy availability.
    if (professionAvailability?.ready === false && professionAvailability.retryAt == null) {
      return {
        result: professionAvailability,
        castContext: preliminaryContext
      };
    }

    const shared = engineAvailability(skill, start);
    const castContext: CastContext<TProfessionState> = {
      ...preliminaryContext,
      ammo: shared.ammo
    };
    const policyAvailability = schedulerPolicy.availability?.(castContext, skill) ?? CAST_READY;
    // Apply the shared denial and retry rules across every availability source.
    const result = foldAvailability([shared.result, policyAvailability, professionAvailability]);
    return { result, castContext };
  }

  function recordInvalid(commandIndex: number, skill: Skill, start: number, reason: string): void {
    warnings.push(reason);
    steps.push({
      ri: commandIndex,
      skill: skill.name,
      skillId: skill.id,
      start: Math.round(start * 1000),
      end: Math.round(start * 1000),
      invalid: true,
      invalidReason: reason
    });
  }

  function cast(command: CastCommand, commandIndex = steps.length): boolean {
    const skill = skillFor(command.skillId);
    if (!skill) {
      const reason = `Unknown skill id ${command.skillId}.`;
      warnings.push(reason);
      steps.push({
        ri: commandIndex,
        skill: String(command.skillId),
        skillId: command.skillId,
        start: Math.round(state.time * 1000),
        end: Math.round(state.time * 1000),
        invalid: true,
        invalidReason: reason
      });
      return false;
    }

    const concurrent = command.concurrentOffsetMs != null;
    if (concurrent && skill.canCastConcurrently === false) {
      recordInvalid(commandIndex, skill, state.time, `${skill.name} cannot be cast concurrently.`);
      return false;
    }

    const independent = skill.independentCast === true;
    const overlappingIndependent = independent && skill.independentCastCanOverlap === true;
    const stunbreak = skill.stunbreak === true;
    const instant = Number(skill.castTimeMs) === 0;
    // Instant-cast skills (Berserk, signets, most profession keys) are not held
    // by a self-stun; only skills that occupy the cast bar are. A stunbreak also
    // bypasses (and clears) the stun. Everything else waits it out.
    const bypassesSelfStun = stunbreak || instant;
    // Concurrent offsets are relative to the previous cast's start, not the
    // current clock. This models instant/concurrent actions embedded in a cast.
    let start = concurrent
      ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
      : independent
        ? overlappingIndependent
          ? state.time
          : Math.max(state.time, independentReadyAt)
        : instant
          ? Math.max(state.time, latestInstantReadyAt)
          : bypassesSelfStun
            ? Math.max(state.time, serialReadyAt, latestBlockingEnd)
            : Math.max(state.time, serialReadyAt, latestBlockingEnd, selfStunUntil);
    // A marker or explicit wait can move the clock past an instant skill's
    // requested overlap. Queue that instant at the earliest reachable time so
    // command ordering is preserved and stunbreaks still execute.
    if (concurrent && (instant || independent) && start < state.time - EPSILON) {
      start = state.time;
    }

    // Explicit overlaps still queue behind the companion's own animation.
    if (independent && !overlappingIndependent) start = Math.max(start, independentReadyAt);

    // Queue authored overlaps through input recovery without moving the transition past retained aftercast.
    start = Math.max(start, schedulerPolicy.inputReadyAt?.(context, state.time) ?? start);

    if (start < state.time - EPSILON) {
      recordInvalid(commandIndex, skill, start, `${skill.name} cannot start before the current simulation clock.`);
      return false;
    }

    advanceTo(start);
    start = state.time;

    let checked = castAvailability(skill, command, commandIndex, start);
    let guard = 0;
    // Retryable availability automatically advances through whichever happens
    // first: the declared retry time or a state-changing scheduled task.
    while (checked.result.ready === false && checked.result.retryAt != null) {
      if (++guard > ACTION_SAFETY_LIMIT) {
        throw new Error('Cast availability wait safety limit exceeded.');
      }

      // Continuous resource estimates can fall between microseconds; wait until the first representable ready instant.
      const requestedRetry = Number(checked.result.retryAt);
      const retryAt = Math.max(
        (timeKey(state.time) + 1) / 1_000_000,
        Math.ceil(requestedRetry * 1_000_000) / 1_000_000
      );
      const nextTaskAt = taskQueue.nextAt();
      const next = Math.min(retryAt, nextTaskAt);
      if (!Number.isFinite(next) || next <= state.time) {
        throw new Error(`Cast availability for ${skill.name} did not make progress.`);
      }

      advanceTo(next);
      start = state.time;
      checked = castAvailability(skill, command, commandIndex, start);
    }

    if (checked.result.ready === false) {
      recordInvalid(commandIndex, skill, start, String(checked.result.reason || `${skill.name} is unavailable.`));
      return false;
    }

    const castContext = { ...checked.castContext, start };
    for (const lockout of skill.lockouts || []) {
      state.lockouts.set(
        lockout.group,
        Math.max(Number(state.lockouts.get(lockout.group) || 0), start + Number(lockout.durationMs) / 1000)
      );
    }

    const fullEnd = canonicalTime(start + castDurationFor(castContext, skill));
    const interruptAfterMs = command.interruptAfterMs ?? skill.defaultInterruptMs;
    const effectiveEnd =
      interruptAfterMs == null ? fullEnd : Math.min(fullEnd, canonicalTime(start + Number(interruptAfterMs) / 1000));
    const interrupted = castWasInterrupted({ fullEnd, effectiveEnd });
    // Some skills commit and begin recharge at their interrupt point but retain
    // the remainder of their ordinary cast as aftercast. Keep completion and
    // recharge anchored to effectiveEnd while reserving the cast lane through
    // fullEnd for those skills.
    const cancelledBeforeCommit = cancelledBeforeInterruptCommit(skill, start, fullEnd, effectiveEnd);
    const castLockoutEnd =
      interrupted && retainsInterruptedCastLockout(skill, cancelledBeforeCommit) ? fullEnd : effectiveEnd;
    // Preserve missing metadata separately from a known cutoff miss so dead-time
    // reporting can require zero damage only for the ambiguous case.
    const missingInterruptCommit =
      interrupted && skill.interruptMode !== 'per-packet' && interruptCommitCutoffs(skill).length === 0;
    const reservation = lifecycle.reserve(castContext, fullEnd, effectiveEnd, cancelledBeforeCommit);
    const reservationId = reservation.id;
    const { rechargeReadyAt } = reservation;
    if (command.offTarget === true) offTargetActivationIds.add(reservationId);
    const action = context.emit({
      type: 'action',
      activationId: reservationId,
      at: start,
      source: activeProfession.id,
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      // Preserve the slot type so shared equipment can react to completed heal and elite casts.
      skillType: skill.type,
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      rechargeReadyAt,
      interrupted,
      // Carry skill evade metadata into the action timeline for shared evade-triggered effects.
      ...(skill.evades ? { evades: true } : {}),
      ...(castLockoutEnd > effectiveEnd + EPSILON ? { castLockoutEndsAt: castLockoutEnd } : {}),
      ...(cancelledBeforeCommit ? { cancelled: true } : {})
    });
    reservation.action = action;
    const lifecycleContext = lifecycle.castContext(reservation);
    activeProfession.onCastStart(lifecycleContext, skill);
    const handler = activeProfession.skillHandlerFor?.(skill);
    const handlerMode = resolveSkillHandlerMode(handler, lifecycleContext, skill);
    const handlerState = handler?.beforeEffects?.(lifecycleContext, skill);
    // Replacing handlers own emission; all other casts retain their declarative effects.
    if (handlerMode !== SKILL_HANDLER_MODES.REPLACE) {
      scheduleDeclarativeEffects(
        context,
        skill,
        reservationId,
        start,
        fullEnd,
        effectiveEnd,
        (event, effect, effectIndex) =>
          handler?.afterEffect?.(lifecycleContext, skill, event, handlerState, {
            effect,
            effectIndex
          })
      );
    }

    handler?.afterEffects?.(lifecycleContext, skill, handlerState);
    state.skillUses.set(skill.id, (state.skillUses.get(skill.id) || 0) + 1);
    activeProfession.afterCast(lifecycleContext, skill);
    context.tasks.schedule({
      id: `${reservationId}:complete`,
      type: CORE_CAST_COMPLETE,
      at: effectiveEnd,
      priority: -100,
      ownerId: reservationId,
      payload: { reservationId }
    });
    // Completion runs early among same-time tasks so following state work sees
    // committed cooldown/ammo and the profession's completed-cast state.
    steps.push({
      ri: commandIndex,
      skill: skill.name,
      skillId: skill.id,
      start: Math.round(start * 1000),
      end: Math.round(effectiveEnd * 1000),
      activationId: reservationId,
      actualStart: Math.round(start * 1000),
      fullCastMs: Math.round((fullEnd - start) * 1000),
      interrupted,
      // Expose retained aftercast separately so UI accounting can treat the
      // forced lockout as busy time without extending the interrupted cast.
      ...(castLockoutEnd > effectiveEnd + EPSILON ? { castLockoutEnd: Math.round(castLockoutEnd * 1000) } : {}),
      ...(cancelledBeforeCommit ? { cancelledBeforeCommit: true } : {}),
      ...(missingInterruptCommit ? { missingInterruptCommit: true } : {})
    });
    latestReservedEnd = Math.max(latestReservedEnd, castLockoutEnd);
    if (independent) {
      if (!overlappingIndependent) {
        independentReadyAt = Math.max(independentReadyAt, castLockoutEnd);
      }
    } else {
      previousCastStart = start;
      hasPreviousCast = true;
      latestInstantReadyAt = Math.max(latestInstantReadyAt, effectiveEnd);
      latestBlockingEnd = Math.max(latestBlockingEnd, castLockoutEnd);
      if (!concurrent) serialReadyAt = castLockoutEnd;
      // A stunbreak clears any pending self-stun; a self-stunning skill sets a
      // fresh one, unless stability is up when the cast ends.
      if (stunbreak) selfStunUntil = state.time;
      const selfStunMs = Number(skill.selfStunMs || 0);
      if (selfStunMs > 0 && !context.hasBuff('stability', effectiveEnd)) {
        selfStunUntil = Math.max(selfStunUntil, effectiveEnd + selfStunMs / 1000);
      }
    }

    return true;
  }

  schedulerPolicy.initialize?.(context);
  activeProfession.initialize(context);

  function run(rotation: readonly unknown[]): SchedulerRunResult<TProfessionState> {
    const commands = normalizeRotation(rotation, activeCatalog, {
      strict: true
    });
    context.hasExplicitCombatStart = commands.some((command) => command.type === 'combat-start');
    context.combatStartTime = null;
    if (commands.length > ACTION_SAFETY_LIMIT) {
      throw new Error('Rotation action safety limit exceeded.');
    }

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      if (command.type === 'wait') {
        // Wait is serial: it starts only after all outstanding casts finish.
        const start = Math.max(state.time, serialReadyAt, latestReservedEnd);
        advanceTo(start);
        const end = start + command.durationMs / 1000;
        serialReadyAt = end;
        advanceTo(end);
        steps.push({
          ri: index,
          skill: 'Wait',
          start: Math.round(start * 1000),
          end: Math.round(end * 1000)
        });
      } else if (command.type === 'cooldown-reset') {
        // Benchmark logs can include a pre-cast followed by the training-area
        // cooldown reset. The field remains active while skill recharges reset.
        // Platform control markers belong to the environment, not a player skill.
        const at = Math.max(state.time, serialReadyAt, latestReservedEnd);
        advanceTo(at);
        state.cooldowns.clear();
        state.ammo.clear();
        state.lockouts.clear();
        activeProfession.onCooldownReset(context);
        context.emit({
          type: 'marker',
          at,
          source: 'platform',
          sourceId: 'cooldown-reset',
          actorType: 'environment',
          action: 'cooldown-reset',
          name: 'Cooldown Reset'
        });
        steps.push({
          ri: index,
          skill: 'Cooldown Reset',
          start: Math.round(at * 1000),
          end: Math.round(at * 1000)
        });
      } else if (command.type === 'combat-start') {
        if (combatStartTime != null) {
          const reason = 'Combat Start is already set.';
          warnings.push(reason);
          steps.push({
            ri: index,
            skill: 'Combat Start',
            start: Math.round(state.time * 1000),
            end: Math.round(state.time * 1000),
            invalid: true,
            invalidReason: reason
          });
          continue;
        }

        const concurrent = command.concurrentOffsetMs != null && hasPreviousCast;
        // Match event timestamps before publishing the boundary so decimal residue cannot exclude opening hits.
        combatStartTime = canonicalTime(
          concurrent
            ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
            : Math.max(state.time, serialReadyAt, latestReservedEnd)
        );
        // Like a concurrent cast, an explicitly offset combat marker is
        // anchored to the previous cast start.
        // Publish the boundary before draining tasks so opening hits can trigger
        // combat procs while hits strictly before the marker remain excluded.
        context.combatStartTime = combatStartTime;
        advanceTo(combatStartTime);
        context.emit({
          type: 'combat_start',
          at: combatStartTime,
          source: 'platform',
          sourceId: 'combat-start',
          // The encounter boundary is an environment marker, independent of player actions.
          actorType: 'environment',
          action: 'combat-start'
        });
        steps.push({
          ri: index,
          skill: 'Combat Start',
          start: Math.round(combatStartTime * 1000),
          end: Math.round(combatStartTime * 1000)
        });
      } else {
        cast(command, index);
      }
    }

    let rotationEnd = Math.max(state.time, serialReadyAt, latestReservedEnd);
    // Recovery belongs to the last entered action too; tails never recursively extend their observation boundary.
    if (schedulerPolicy.inputReadyAt) {
      let guard = 0;
      while (true) {
        if (++guard > ACTION_SAFETY_LIMIT) throw new Error('Input recovery safety limit exceeded.');
        advanceTo(rotationEnd);
        const readyAt = schedulerPolicy.inputReadyAt(context, rotationEnd);
        if (readyAt <= rotationEnd + EPSILON) break;
        rotationEnd = readyAt;
      }
    }

    const normalizedRotationEnd = canonicalTime(Math.max(rotationEnd, 0));
    const resolutionEnd = observationEndTime(normalizedObservationPolicy, normalizedRotationEnd);
    context.observationEndTime = resolutionEnd;
    // Profession tasks are materialized only through the finite caller-owned
    // observation boundary. Actor handlers remain responsible for their own
    // lifetime or stop conditions.
    advanceTo(resolutionEnd);
    steps.sort((left, right) => left.ri - right.ri);
    // Emit the scheduler's completed history in the same order used by resolver queues.
    events.sort(compareQueuedEvents);
    const snapshot = activeProfession.snapshot(context) ?? structuredClone(state.profession);
    return {
      context,
      state,
      events,
      steps,
      warnings,
      snapshot,
      stream: buildScheduledEventStream({
        events,
        rotationEndTime: normalizedRotationEnd,
        resolutionEndTime: resolutionEnd,
        resolverHandoff: {
          hasExplicitCombatStart: combatStartTime != null,
          combatStartTime
        }
      })
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}

interface SchedulerStateOptions<TProfessionState extends object> {
  readonly profession?: {
    createProfessionState(config: Readonly<SchedulerConfig>): TProfessionState;
  };
  readonly config?: Readonly<SchedulerConfig>;
  readonly startingTime?: number;
  readonly activeWeaponSet?: number;
}

/**
 * Creates the profession-neutral mutable state owned by the scheduler.
 * Profession-specific resources are nested under `state.profession`.
 *
 */
function createSchedulerState<TProfessionState extends object = object>({
  profession,
  config = {},
  startingTime = 0,
  activeWeaponSet = 1
}: SchedulerStateOptions<TProfessionState> = {}): SchedulerState<TProfessionState> {
  if (!profession || typeof profession.createProfessionState !== 'function') {
    throw new TypeError('Scheduler state requires a profession contract.');
  }

  return {
    time: Number(startingTime || 0),
    cooldowns: new Map(),
    ammo: new Map(),
    lockouts: new Map(),
    activeWeaponSet: Math.max(1, Number(activeWeaponSet || 1)),
    skillUses: new Map(),
    profession: profession.createProfessionState(config)
  };
}
