/**
 * The shared declarative scheduler. Owns canonical rotation-command execution,
 * cast/recharge timing, cooldown and ammo bookkeeping, effect materialization
 * and event emission, and the scheduler-to-resolver handoff. Professions
 * customize behavior through the profession contract and injected scheduler
 * policy rather than forking this state machine.
 */
import { ACTION_SAFETY_LIMIT, EPSILON } from './clock.js';
import { foldAvailability } from './availability.js';
import { createEvent } from './events.js';
import { effectFirstAt, materializeSkillEffectApplications } from './effect-materializer.js';
import { createCooldownController } from './cooldown-controller.js';
import { normalizeObservationPolicy, observationEndTime } from './observation-policy.js';
import { normalizeRotation } from './rotation-commands.js';
import { createSchedulerState } from './scheduler-state.js';
import { buildScheduledEventStream } from './scheduled-event-stream.js';
import { sortQueuedEvents } from './event-queue.js';
import { createTaskQueue } from './task-queue.js';
import { cloneProfessionState, resolveProfessionRuntime } from './profession.js';
import { resolveSkillHandlerMode, SKILL_HANDLER_MODES } from './skill-handlers.js';
import type {
  AmmoState,
  AvailabilityResult,
  CanonicalCatalog,
  CastCommand,
  CastContext,
  CastLifecycleContext,
  CooldownController,
  ObservationPolicy,
  ProfessionSource,
  ScheduledTask,
  ScheduledTaskHandler,
  ScheduledTaskInput,
  Scheduler,
  SchedulerConfig,
  SchedulerContext,
  SchedulerPolicy,
  SchedulerRecord,
  SchedulerRunResult,
  SchedulerStep,
  SchedulerTaskAccess,
  SkillEffect,
  SkillMechanicTrigger,
  SimulationEvent,
  SimulationEventInput,
  Skill,
  SkillId,
  TaskQueue
} from './types.js';

interface CastReservation<TProfessionState extends object> {
  id: string;
  skill: Skill;
  ammo: AmmoState | null;
  castContext: CastContext<TProfessionState>;
  fullEnd: number;
  effectiveEnd: number;
  rechargeDuration: number;
  ammoLockoutDuration: number;
  rechargeStart: number;
  rechargeReadyAt: number | null;
  action: SimulationEvent | null;
}

interface CreateSchedulerOptions<TProfessionState extends object> {
  readonly profession?: ProfessionSource<TProfessionState>;
  readonly config?: SchedulerConfig;
  readonly catalog?: CanonicalCatalog;
  readonly startingTime?: number;
  readonly epsilon?: number;
  readonly schedulerPolicy?: SchedulerPolicy<TProfessionState>;
  readonly observationPolicy?: ObservationPolicy;
}

// Shared declarative scheduler. It owns canonical command execution, cooldown
// and ammo bookkeeping, event emission, and the scheduler-to-resolver handoff.
// Professions customize behavior through the profession contract and injected
// scheduler policy rather than forking this state machine.

/**
 * Reads a skill's base cast duration from canonical metadata.
 *
 * @param {Skill} skill
 */
function baseDurationSeconds(skill: Skill): number {
  return Math.max(0, Number(skill.castTimeMs || 0)) / 1000;
}

/**
 * @template {object} TProfessionState
 */
function cancelledBeforeInterruptCommit<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (skill.interruptMode === 'per-packet' || effectiveEnd >= fullEnd - context.epsilon) return false;
  const elapsedMs = (effectiveEnd - start) * 1000;
  const cutoffs = [skill.interruptCommitMs, ...(skill.effects || []).map((effect) => effect.interruptCommitMs)].filter(
    (cutoff): cutoff is number => cutoff != null && Number.isFinite(Number(cutoff))
  );
  return cutoffs.length === 0 || cutoffs.every((cutoff) => elapsedMs + context.epsilon * 1000 < Number(cutoff));
}

/** Returns whether an interrupted cast ended before this persistent effect launched. */
function cancelledBeforeEffectCommit<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  effect: SkillEffect,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (effectiveEnd >= fullEnd - context.epsilon) return false;
  const cutoff = effect.interruptCommitMs ?? skill.interruptCommitMs;
  if (cutoff == null) return true;
  const elapsedMs = (effectiveEnd - start) * 1000;
  return elapsedMs + context.epsilon * 1000 < Number(cutoff);
}

/**
 * Expands declarative skill effects into canonical scheduled events. This is
 * only used when a profession hook does not fully handle the cast itself.
 *
 * @template {object} TProfessionState
 */
function scheduleDeclarativeEffects<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  activationId: string,
  start: number,
  fullEnd: number,
  effectiveEnd: number,
  observeEffect: (event: SimulationEvent, effect: SkillEffect, effectIndex: number) => void = () => {}
): void {
  const interrupted = effectiveEnd < fullEnd - context.epsilon;
  const slotSkill = skill.type === 'Heal' || skill.type === 'Utility' || skill.type === 'Elite';
  const effects = skill.effects || [];
  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index];
    const timing =
      context.schedulerPolicy.effectTiming?.(
        {
          ...context,
          skill,
          start,
          fullEnd,
          effectiveEnd
        },
        skill,
        effect
      ) ?? effect;
    const firstAt = effectFirstAt(start, fullEnd, timing);
    const perPacket = skill.interruptMode === 'per-packet';
    const cancelledCommitEffect =
      interrupted && !perPacket && cancelledBeforeEffectCommit(context, skill, effect, start, fullEnd, effectiveEnd);
    if (cancelledCommitEffect) continue;
    const cancelPendingEffects = interrupted && (perPacket || effect.persistsAfterInterrupt !== true);
    // Per-packet channels keep only applications that occurred by the interrupt;
    // committed effects may retain future packets only through explicit persistence.
    if (cancelPendingEffects && firstAt > effectiveEnd + context.epsilon) continue;
    const base = {
      activationId,
      source: effect.source || context.profession.id,
      sourceId: effect.sourceId ?? skill.id,
      actorType: effect.actorType || 'player',
      ...(effect.ownerActorType ? { ownerActorType: effect.ownerActorType } : {}),
      skillId: skill.id,
      skillName: skill.name,
      ...(effect.persistsAfterInterrupt === true ? { persistsAfterInterrupt: true } : {})
    };
    const baseDuration =
      effect.type === 'boon' || effect.type === 'buff' ? Math.max(0, Number(effect.duration || 0)) : undefined;
    const duration =
      baseDuration == null
        ? undefined
        : (context.schedulerPolicy.effectDuration?.(context, skill, effect, baseDuration) ?? baseDuration);
    const applications = materializeSkillEffectApplications({
      skill,
      effect: timing,
      start,
      fullEnd,
      baseEvent: base,
      skillWeaponFallback: slotSkill ? 'Unequipped' : '',
      statusDuration: duration
    });

    // Materialize first so a per-packet channel can retain its exact landed prefix.
    for (const application of applications) {
      if (cancelPendingEffects && application.at > effectiveEnd + context.epsilon) break;
      observeEffect(context.emit(application.event), effect, index);
    }
  }
}

const CORE_CAST_COMPLETE = 'platform.cast-complete';

/**
 * @param {string} reason
 * @param {string} [code]
 * @param {number | null} [retryAt]
 * @returns {AvailabilityResult}
 */
function unavailable(reason: string, code = 'platform.unavailable', retryAt: number | null = null): AvailabilityResult {
  return { ready: false, retryAt, reason, code };
}

/**
 * @param {readonly (AvailabilityResult | boolean | null | undefined)[]} results
 * @returns {AvailabilityResult}
 */
function combineAvailability(
  results: readonly (AvailabilityResult | boolean | null | undefined)[]
): AvailabilityResult {
  return foldAvailability(
    (function* () {
      for (const result of results) {
        if (result == null || result === true) continue;
        yield result === false ? unavailable('The skill is unavailable.') : result;
      }
    })()
  );
}

/**
 * Creates the profession-neutral chronological scheduler.
 *
 * @template {object} TProfessionState
 * @param {{
 *   profession?: ProfessionSource<TProfessionState>,
 *   config?: SchedulerConfig,
 *   catalog?: CanonicalCatalog,
 *   startingTime?: number,
 *   epsilon?: number,
 *   schedulerPolicy?: SchedulerPolicy<TProfessionState>,
 *   observationPolicy?: ObservationPolicy
 * }} [options]
 * @returns {Scheduler<TProfessionState>}
 */
export function createScheduler<TProfessionState extends object = SchedulerRecord>({
  profession,
  config = {},
  catalog,
  startingTime = 0,
  epsilon = EPSILON,
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
  const events: SimulationEvent[] = [];
  const steps: SchedulerStep[] = [];
  const warnings: string[] = [];
  // Reservations separate "a cast has started" from "its completion has
  // committed cooldown/ammo state". inFlight provides a skill-keyed lookup;
  // reservations retains the lifecycle data used by the completion task.
  const inFlight = new Map<SkillId, Set<string>>();
  const reservations = new Map<string, CastReservation<TProfessionState>>();
  // Scheduling hooks may emit more events. A FIFO observation queue flattens
  // that recursion so every event is observed exactly once in causal order.
  const observationQueue: SimulationEvent[] = [];
  let observingEvents = false;
  let eventOrder = 0;
  // Derived events share their cause's integer order and use fractional
  // suffixes, keeping them adjacent to the cause at equal timestamps.
  const derivedEventCounts = new Map<number, number>();
  // Buff events are indexed by lowercased kind so buffStacks/hasBuff scan only
  // the relevant buffs instead of the entire event log on every query.
  const buffIndex = new Map<string, SimulationEvent[]>();
  const buffKindKey = (event: SimulationEvent): string | null =>
    event.type === 'buff' && event.affectsSelf !== false ? String(event.kind || '').toLowerCase() : null;
  const indexBuffEvent = (event: SimulationEvent): void => {
    const key = buffKindKey(event);
    if (key == null) return;
    const bucket = buffIndex.get(key);
    if (bucket) bucket.push(event);
    else buffIndex.set(key, [event]);
  };

  const deindexBuffEvent = (event: SimulationEvent): void => {
    const key = buffKindKey(event);
    if (key == null) return;
    const bucket = buffIndex.get(key);
    const at = bucket?.indexOf(event) ?? -1;
    if (bucket && at >= 0) bucket.splice(at, 1);
  };

  let reservationOrder = 0;
  let activationOrder = 0;
  let previousCastStart = state.time;
  // serialReadyAt and latestBlockingEnd control the player's cast lane.
  // Independent skills use their own serial lane while latestReservedEnd keeps
  // waits and the final simulation horizon behind every outstanding cast.
  let serialReadyAt = state.time;
  let independentReadyAt = state.time;
  let latestBlockingEnd = state.time;
  let latestReservedEnd = state.time;
  // A self-stunning skill (e.g. Head Butt) blocks the serial cast lane until
  // this time. Non-stunbreak serial casts wait for it; a stunbreak ignores and
  // clears it. Stability at cast end prevents the stun from being set at all.
  let selfStunUntil = state.time;
  let hasPreviousCast = false;
  let combatStartTime: number | null = null;
  let taskQueue: TaskQueue<SchedulerContext<TProfessionState>, SchedulerRecord>;

  const skillFor = (skillId: SkillId): Skill | undefined =>
    activeCatalog?.skillsById?.get(skillId) || activeCatalog?.skills?.find((skill) => skill.id === skillId);

  const context: SchedulerContext<TProfessionState> = {
    profession: activeProfession,
    config,
    catalog: activeCatalog,
    state,
    events,
    warnings,
    epsilon,
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
    emit(/** @type {SimulationEventInput} */ event) {
      const professionPrepared = activeProfession.prepareEvent(context, event);
      const prepared = schedulerPolicy.prepareEvent?.(context, professionPrepared) ?? professionPrepared;
      const normalized = createEvent({
        ...prepared,
        __order: eventOrder++
      });
      events.push(normalized);
      indexBuffEvent(normalized);
      state.pendingEvents.push(normalized);
      observationQueue.push(normalized);
      if (!observingEvents) {
        let observationCount = 0;
        observingEvents = true;
        try {
          while (observationQueue.length) {
            if (++observationCount > ACTION_SAFETY_LIMIT) {
              throw new Error('Scheduled-event observation safety limit exceeded.');
            }

            const observed = observationQueue.shift();
            if (observed) {
              schedulerPolicy.onEventScheduled?.(context, observed);
              activeProfession.onEventScheduled(context, observed);
            }
          }
        } finally {
          observingEvents = false;
        }
      }

      return normalized;
    },
    replaceEvent(/** @type {SimulationEvent} */ event, /** @type {SchedulerRecord} */ updates) {
      const replacement = createEvent({ ...event, ...updates });
      const replaceReference = (collection: SimulationEvent[]): void => {
        const index = collection.indexOf(event);
        if (index >= 0) collection[index] = replacement;
      };

      deindexBuffEvent(event);
      replaceReference(events);
      replaceReference(state.pendingEvents);
      replaceReference(observationQueue);
      indexBuffEvent(replacement);
      return replacement;
    },
    emitDerived(/** @type {SimulationEvent} */ cause, /** @type {SimulationEventInput} */ event) {
      const rootOrder = Math.floor(Number(cause?.causalOrder ?? cause?.__order));
      if (!Number.isFinite(rootOrder)) {
        throw new TypeError('Derived events require a scheduled cause.');
      }

      const count = (derivedEventCounts.get(rootOrder) || 0) + 1;
      derivedEventCounts.set(rootOrder, count);
      return context.emit({
        ...event,
        causalOrder: rootOrder + count / 1_000_000,
        triggeredBy: event.triggeredBy ?? cause.skillName ?? cause.name ?? ''
      });
    },
    buffStacks(/** @type {string} */ kind, at = state.time) {
      const normalized = String(kind || '').toLowerCase();
      const permanent = config.boons?.[normalized];
      const base = permanent === true ? 1 : Number(permanent || 0);
      // Scheduled buff events are already known even if the scheduler clock has
      // not reached them, so both their start and half-open expiry are checked.
      // Only this kind's indexed buffs are scanned, not the entire event log.
      const bucket = buffIndex.get(normalized);
      let stacks = base;
      for (const event of bucket || []) {
        if (event.at <= at + epsilon && event.at + Number(event.duration || 0) > at + epsilon) {
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

  /**
   * @param {CastContext<TProfessionState>} castContext
   * @param {Skill} skill
   */
  function castDurationFor(castContext: CastContext<TProfessionState>, skill: Skill): number {
    const baseDuration = baseDurationSeconds(skill);
    // Shared game rules run before profession-specific modifiers. The same
    // ordering is used for recharge and maximum-ammo calculations below.
    const sharedDuration = schedulerPolicy.castDuration?.(castContext, skill, baseDuration) ?? baseDuration;
    return Math.max(0, Number(activeProfession.modifyCastDuration(castContext, sharedDuration) || 0));
  }

  /**
   * @param {Skill} skill
   * @param {number} [at]
   * @param {SchedulerRecord} [details]
   */
  function rechargeDurationFor(skill: Skill, at = state.time, details: SchedulerRecord = {}): number {
    const rechargeContext = {
      ...context,
      ...details,
      skill,
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

  /** @param {Skill} skill */
  function maximumAmmoFor(skill: Skill): number {
    const baseMaximum = Math.max(0, Number(skill.ammo || 0));
    const sharedMaximum = schedulerPolicy.maximumAmmo?.({ ...context, skill }, skill, baseMaximum) ?? baseMaximum;
    return Math.max(0, Number(activeProfession.modifyMaximumAmmo({ ...context, skill }, sharedMaximum) || 0));
  }

  const cooldownController = createCooldownController({
    state,
    epsilon,
    rechargeDuration: rechargeDurationFor,
    maximumAmmo: maximumAmmoFor
  });
  context.cooldownController = cooldownController;
  context.castDurationFor = castDurationFor;
  context.rechargeDurationFor = rechargeDurationFor;
  context.maximumAmmoFor = maximumAmmoFor;

  /**
   * @param {SchedulerContext<TProfessionState>} _taskContext
   * @param {ScheduledTask<SchedulerRecord>} task
   */
  const completeReservation: ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord> = (
    _taskContext,
    task
  ) => {
    const reservationId = task.payload?.reservationId;
    if (typeof reservationId !== 'string') return;
    const reservation = reservations.get(reservationId);
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
      rechargeReadyAt
    } = reservation;
    const active = inFlight.get(skill.id);
    active?.delete(reservation.id);
    if (active?.size === 0) inFlight.delete(skill.id);
    if (reservation.ammo) {
      cooldownController.spendAmmo(skill, rechargeStart);
      if (ammoLockoutDuration > 0) {
        cooldownController.setAmmoLockout(skill, rechargeStart + ammoLockoutDuration, rechargeStart);
      }
    } else if (rechargeDuration) {
      state.cooldowns.set(skill.id, rechargeStart + rechargeDuration);
    }

    // Cooldown/ammo commitment precedes the profession completion hook so the
    // hook observes the state players would have immediately after the cast.
    const completionContext: CastLifecycleContext<TProfessionState> = {
      ...castContext,
      action: action as SimulationEvent,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      reservationId: reservation.id,
      emit(event) {
        return context.emit({
          activationId: reservation.id,
          ...event
        });
      },
      tasks: {
        ...context.tasks,
        schedule(task) {
          return context.tasks.schedule({
            ...task,
            payload: {
              activationId: reservation.id,
              ...(task.payload || {})
            }
          });
        }
      }
    };
    activeProfession.onCastComplete(completionContext, skill);

    // Skill metadata owns trigger timing; the task executes profession state
    // changes only when that timestamp is actually reached.
    for (const trigger of skill.mechanicTriggers || []) {
      const authoredCastMs = Math.max(0, Number(skill.castTimeMs || 0));
      const actualCastMs = Math.max(0, fullEnd - castContext.start) * 1000;
      const authoredOffsetMs = Number(trigger.atMs || 0);
      const offsetMs =
        trigger.timingScale === 'cast' && authoredCastMs > 0
          ? authoredOffsetMs * (actualCastMs / authoredCastMs)
          : authoredOffsetMs;
      const anchor = trigger.timingAnchor === 'castStart' ? castContext.start : fullEnd;
      const triggerAt = anchor + offsetMs / 1000;
      if (triggerAt < effectiveEnd - epsilon) {
        throw new RangeError(
          `${skill.name} mechanic trigger ${trigger.type} resolves before the cast-completion dispatch phase.`
        );
      }

      completionContext.tasks.schedule({
        type: trigger.type,
        at: triggerAt,
        ownerId: reservation.id,
        payload: {
          skillId: skill.id,
          trigger,
          castStart: castContext.start,
          castEnd: fullEnd
        }
      });
    }

    reservations.delete(reservation.id);
  };

  /** Dispatches one due trigger through the active profession's composed handler registry. */
  const handleSkillMechanicTrigger: ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord> = (
    taskContext,
    task
  ) => {
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

  const taskHandlers: Record<string, ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>> = {
    [CORE_CAST_COMPLETE]: completeReservation,
    ...(schedulerPolicy.taskHandlers || {}),
    ...activeProfession.taskHandlers,
    ...Object.fromEntries(
      Object.keys(activeProfession.skillMechanicHandlers).map((type) => [type, handleSkillMechanicTrigger])
    )
  };
  const activationAwareTaskHandlers: Record<
    string,
    ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>
  > = Object.fromEntries(
    Object.entries(taskHandlers).map(([type, handler]) => [
      type,
      (taskContext: SchedulerContext<TProfessionState>, task: ScheduledTask<SchedulerRecord>) => {
        const inheritedActivationId =
          typeof task.payload?.activationId === 'string'
            ? task.payload.activationId
            : typeof task.payload?.reservationId === 'string'
              ? task.payload.reservationId
              : null;
        const taskActivationId = inheritedActivationId || taskContext.createActivationId('effect');
        const scopedTasks = inheritedActivationId
          ? {
              ...taskContext.tasks,
              schedule(input: ScheduledTaskInput<SchedulerRecord>) {
                return taskContext.tasks.schedule({
                  ...input,
                  payload: {
                    activationId: inheritedActivationId,
                    ...(input.payload || {})
                  }
                });
              }
            }
          : taskContext.tasks;
        return handler(
          {
            ...taskContext,
            tasks: scopedTasks,
            emit(event: SimulationEventInput) {
              return taskContext.emit({
                activationId: taskActivationId,
                ...event
              });
            }
          },
          task
        );
      }
    ])
  );
  // Later spreads intentionally win, allowing a profession to specialize a
  // policy task type while the core completion task remains the default.
  taskQueue = createTaskQueue({
    handlers: activationAwareTaskHandlers,
    epsilon,
    safetyLimit: ACTION_SAFETY_LIMIT
  });
  context.tasks = Object.freeze({
    schedule(task: ScheduledTaskInput<SchedulerRecord>) {
      if (Number(task?.at) < state.time - epsilon) {
        throw new RangeError('Scheduled tasks cannot be placed before the clock.');
      }

      return taskQueue.schedule(task);
    },
    cancel: taskQueue.cancel,
    cancelOwner: taskQueue.cancelOwner,
    nextAt: taskQueue.nextAt
  });

  /** @param {number} at */
  function refreshSharedState(at: number): void {
    for (const skillId of state.ammo.keys()) {
      const skill = skillFor(skillId);
      if (skill) cooldownController.refreshAmmo(skill, at);
    }
  }

  /** @param {number} time */
  function advanceTo(time: number): void {
    const target = Math.max(state.time, Number(time));
    if (!Number.isFinite(target)) {
      throw new TypeError('Scheduler time must be finite.');
    }

    while (taskQueue.nextAt() <= target + epsilon) {
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
    // pendingEvents is only a scheduler-side view of future work; the complete
    // canonical event list remains in events for the resolver handoff.
    state.pendingEvents = state.pendingEvents.filter((event) => event.at > target + epsilon);
  }

  context.advanceTo = advanceTo;

  /**
   * @param {Skill} skill
   * @param {number} at
   */
  function engineAvailability(skill: Skill, at: number): { ammo: AmmoState | null; result: AvailabilityResult } {
    const ammo = cooldownController.refreshAmmo(skill, at);
    const readyAt = state.cooldowns.get(skill.id) || 0;
    const active = inFlight.get(skill.id);
    const activeReservations = active?.size
      ? [...active]
          .map((id) => reservations.get(id))
          .filter((/** @type {CastReservation<TProfessionState> | undefined} */ reservation) => reservation != null)
      : [];
    const reservedUntil = activeReservations.length
      ? Math.max(
          ...activeReservations.map((reservation) => reservation.rechargeReadyAt ?? reservation.effectiveEnd ?? at)
        )
      : 0;
    // rechargeReadyAt is preferred to effectiveEnd because a concurrent cast
    // cannot reuse the same skill while its reservation still owns recharge.
    const result: AvailabilityResult[] = [];
    if ((readyAt > at + epsilon && skill.usableWhileRecharging !== true) || (ammo && ammo.charges <= 0)) {
      result.push(
        unavailable(`${skill.name} is on cooldown until ${readyAt.toFixed(3)}.`, 'platform.cooldown', readyAt)
      );
    }

    if (reservedUntil > at + epsilon && skill.independentCastCanOverlap !== true) {
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
      if (lockoutReadyAt > at + epsilon) {
        result.push(
          unavailable(
            `${skill.name} is locked by ${lockout.group} until ` + `${lockoutReadyAt.toFixed(3)}.`,
            'platform.skill-group-lockout',
            lockoutReadyAt
          )
        );
      }
    }

    return { ammo, result: combineAvailability(result) };
  }

  /**
   * @param {Skill} skill
   * @param {CastCommand} command
   * @param {number} commandIndex
   * @param {number} start
   */
  function castAvailability(
    skill: Skill,
    command: CastCommand,
    commandIndex: number,
    start: number
  ): {
    result: AvailabilityResult;
    castContext: CastContext<TProfessionState>;
  } {
    const preliminaryContext: CastContext<TProfessionState> = {
      ...context,
      command,
      commandIndex,
      skill,
      start,
      ammo: state.ammo.get(skill.id) || null
    };
    const professionAvailability = activeProfession.availability(preliminaryContext, skill);
    // A permanent profession denial cannot become valid after shared state is
    // refreshed, so return it before running policy/legacy validation.
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
    const policyAvailability = schedulerPolicy.availability?.(castContext, skill);
    const legacyReady =
      schedulerPolicy.validateCast?.(castContext, skill) !== false && activeProfession.validateCast(castContext, skill);
    const result = combineAvailability([
      shared.result,
      policyAvailability,
      professionAvailability,
      legacyReady ? null : unavailable(`${skill.name} is unavailable.`, 'platform.legacy-validation')
    ]);
    return { result, castContext };
  }

  /**
   * @param {number} commandIndex
   * @param {Skill} skill
   * @param {number} start
   * @param {string} reason
   */
  function recordInvalid(commandIndex: number, skill: Skill, start: number, reason: string): void {
    warnings.push(reason);
    steps.push({
      ri: commandIndex,
      skill: skill.name,
      start: Math.round(start * 1000),
      end: Math.round(start * 1000),
      invalid: true,
      invalidReason: reason
    });
  }

  /**
   * @param {CastCommand} command
   * @param {number} [commandIndex]
   * @returns {boolean}
   */
  function cast(command: CastCommand, commandIndex = steps.length): boolean {
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
    // Instant-cast skills (Berserk, signets, most profession keys) are not held
    // by a self-stun; only skills that occupy the cast bar are. A stunbreak also
    // bypasses (and clears) the stun. Everything else waits it out.
    const bypassesSelfStun = stunbreak || Number(skill.castTimeMs) === 0;
    // Concurrent offsets are relative to the previous cast's start, not the
    // current clock. This models instant/concurrent actions embedded in a cast.
    let start = concurrent
      ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
      : independent
        ? overlappingIndependent
          ? state.time
          : Math.max(state.time, independentReadyAt)
        : bypassesSelfStun
          ? Math.max(state.time, serialReadyAt, latestBlockingEnd)
          : Math.max(state.time, serialReadyAt, latestBlockingEnd, selfStunUntil);
    if (start < state.time - epsilon) {
      recordInvalid(commandIndex, skill, start, `${skill.name} cannot start before the current simulation clock.`);
      return false;
    }

    advanceTo(start);

    let checked = castAvailability(skill, command, commandIndex, start);
    let guard = 0;
    // Retryable availability automatically advances through whichever happens
    // first: the declared retry time or a state-changing scheduled task.
    while (checked.result.ready === false && checked.result.retryAt != null) {
      if (++guard > ACTION_SAFETY_LIMIT) {
        throw new Error('Cast availability wait safety limit exceeded.');
      }

      const retryAt = Math.max(state.time, Number(checked.result.retryAt));
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

    const fullEnd = start + castDurationFor(castContext, skill);
    const interruptAfterMs = command.interruptAfterMs ?? skill.defaultInterruptMs;
    const effectiveEnd =
      interruptAfterMs == null ? fullEnd : Math.min(fullEnd, start + Number(interruptAfterMs) / 1000);
    const interrupted = effectiveEnd < fullEnd - epsilon;
    // Some skills commit and begin recharge at their interrupt point but retain
    // the remainder of their ordinary cast as aftercast. Keep completion and
    // recharge anchored to effectiveEnd while reserving the cast lane through
    // fullEnd for those skills.
    const castLockoutEnd = interrupted && skill.retainsCastLockoutAfterInterrupt === true ? fullEnd : effectiveEnd;
    const cancelledBeforeCommit = cancelledBeforeInterruptCommit(context, skill, start, fullEnd, effectiveEnd);
    const rechargeDuration = rechargeDurationFor(skill, effectiveEnd, {
      ...castContext,
      fullEnd,
      effectiveEnd
    });
    const ammoLockoutDuration =
      castContext.ammo && Number(skill.ammo || 0) > 0
        ? rechargeDurationFor(skill, effectiveEnd, {
            ...castContext,
            fullEnd,
            effectiveEnd,
            ammoCastLockout: true
          })
        : 0;
    const rechargeAnchor = skill.rechargeAnchor === 'castStart' ? start : effectiveEnd;
    const canonicalRechargeStart = rechargeAnchor + Number(skill.rechargeOffsetMs || 0) / 1000;
    const rechargeStart = Math.max(
      start,
      Number(
        activeProfession.modifyRechargeStart(
          {
            ...castContext,
            fullEnd,
            effectiveEnd,
            rechargeDuration
          },
          canonicalRechargeStart
        )
      )
    );
    const ammoChargeReadyAt =
      castContext.ammo && castContext.ammo.charges <= 1
        ? (castContext.ammo.nextRechargeAt ?? rechargeStart + rechargeDuration)
        : 0;
    const ammoLockoutReadyAt = castContext.ammo && ammoLockoutDuration > 0 ? rechargeStart + ammoLockoutDuration : 0;
    const rechargeReadyAt = castContext.ammo
      ? Math.max(ammoChargeReadyAt, ammoLockoutReadyAt) || null
      : rechargeDuration > 0
        ? rechargeStart + rechargeDuration
        : null;
    // Register the reservation before lifecycle hooks emit anything. Re-entrant
    // availability checks therefore see this cast as already in flight.
    const reservationId = `cast:${++reservationOrder}`;
    const reservation: CastReservation<TProfessionState> = {
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
      action: null
    };
    reservations.set(reservationId, reservation);
    if (!inFlight.has(skill.id)) inFlight.set(skill.id, new Set());
    inFlight.get(skill.id)?.add(reservationId);

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
      endsAt: effectiveEnd,
      fullEndsAt: fullEnd,
      rechargeReadyAt,
      interrupted,
      ...(castLockoutEnd > effectiveEnd + epsilon ? { castLockoutEndsAt: castLockoutEnd } : {}),
      ...(cancelledBeforeCommit ? { cancelled: true } : {})
    });
    reservation.action = action;
    const lifecycleContext: CastLifecycleContext<TProfessionState> = {
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      reservationId,
      emit(event) {
        return context.emit({
          activationId: reservationId,
          ...event
        });
      },
      tasks: {
        ...context.tasks,
        schedule(task) {
          return context.tasks.schedule({
            ...task,
            payload: {
              activationId: reservationId,
              ...(task.payload || {})
            }
          });
        }
      }
    };
    activeProfession.onCastStart(lifecycleContext, skill);
    const handler = activeProfession.skillHandlerFor?.(skill);
    const handlerMode = resolveSkillHandlerMode(handler, lifecycleContext, skill);
    const handlerState = handler?.beforeEffects?.(lifecycleContext, skill);
    // The profession-level hook remains for schedulers that still own their
    // complete event materialization; catalog handlers use explicit strategies.
    const professionHandled = activeProfession.scheduleSkill(lifecycleContext, skill) === true;
    if (handlerMode !== SKILL_HANDLER_MODES.REPLACE && !professionHandled) {
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
      start: Math.round(start * 1000),
      end: Math.round(effectiveEnd * 1000),
      actualStart: Math.round(start * 1000),
      fullCastMs: Math.round((fullEnd - start) * 1000),
      interrupted
    });
    latestReservedEnd = Math.max(latestReservedEnd, castLockoutEnd);
    if (independent) {
      if (!overlappingIndependent) {
        independentReadyAt = Math.max(independentReadyAt, castLockoutEnd);
      }
    } else {
      previousCastStart = start;
      hasPreviousCast = true;
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

  /**
   * @param {readonly unknown[]} rotation
   */
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
        combatStartTime = concurrent
          ? previousCastStart + Number(command.concurrentOffsetMs) / 1000
          : Math.max(state.time, serialReadyAt, latestReservedEnd);
        // Like a concurrent cast, an explicitly offset combat marker is
        // anchored to the previous cast start.
        advanceTo(combatStartTime);
        context.combatStartTime = combatStartTime;
        context.emit({
          type: 'combat_start',
          at: combatStartTime,
          source: 'platform',
          sourceId: 'combat-start',
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

    const rotationEnd = Math.max(state.time, serialReadyAt, latestReservedEnd);
    const normalizedRotationEnd = Math.max(rotationEnd, 0);
    const resolutionEnd = observationEndTime(normalizedObservationPolicy, normalizedRotationEnd);
    context.observationEndTime = resolutionEnd;
    // Profession tasks are materialized only through the finite caller-owned
    // observation boundary. Actor handlers remain responsible for their own
    // lifetime or stop conditions.
    advanceTo(resolutionEnd);
    steps.sort((left, right) => left.ri - right.ri);
    sortQueuedEvents(events);
    const snapshot = activeProfession.snapshot(context) ?? cloneProfessionState(state.profession);
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
          profession: activeProfession.id,
          professionState: snapshot,
          hasExplicitCombatStart: combatStartTime != null,
          combatStartTime
        }
      })
    };
  }

  return { state, events, warnings, context, cast, advanceTo, run };
}
