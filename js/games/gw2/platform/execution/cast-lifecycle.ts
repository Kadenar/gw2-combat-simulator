import { EPSILON } from '#kernel/core/clock.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type {
  AmmoState,
  CastContext,
  CastLifecycleContext,
  SchedulerContext,
  ScheduledTaskHandler
} from '#gw2/platform/execution/types.js';

export const CORE_CAST_COMPLETE = 'platform.cast-complete';

/** Payload of the core task that commits a reserved cast when its lane completes. */
interface CastCompletionTaskPayload {
  readonly reservationId: string;
}

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

/** Defaults event lineage and optionally child-task lineage, preserving explicit overrides. */
export function activationScopedOperations<TProfessionState extends object>(
  baseContext: SchedulerContext<TProfessionState>,
  eventActivationId: string,
  inheritedTaskActivationId: string | null
): Pick<SchedulerContext<TProfessionState>, 'emit' | 'tasks'> {
  return {
    emit(event) {
      return baseContext.emit({ activationId: eventActivationId, ...event });
    },
    tasks: inheritedTaskActivationId
      ? {
          ...baseContext.tasks,
          schedule(task) {
            return baseContext.tasks.schedule({
              ...task,
              payload: { activationId: inheritedTaskActivationId, ...(task.payload || {}) }
            });
          }
        }
      : baseContext.tasks
  };
}

/** Reserves each accepted cast once and commits its cooldowns before completion hooks run. */
export function createCastLifecycle<TProfessionState extends object>(context: SchedulerContext<TProfessionState>) {
  const { state, profession: activeProfession, cooldownController, inFlight } = context;
  const reservations = new Map<string, CastReservation<TProfessionState>>();
  let reservationOrder = 0;

  function reserve(
    castContext: CastContext<TProfessionState>,
    fullEnd: number,
    effectiveEnd: number,
    cancelledBeforeCommit: boolean
  ): CastReservation<TProfessionState> {
    const skill = castContext.skill;
    const rechargeContext = { ...castContext, fullEnd, effectiveEnd };
    const persistentRechargeDuration = context.rechargeDurationFor(skill, effectiveEnd, rechargeContext);
    // Reserve next-cast benefits synchronously, once, so queries, cancelled attempts,
    // ammo lockouts, and overlapping casts cannot spend the same entitlement.
    const rechargeDuration = cancelledBeforeCommit
      ? persistentRechargeDuration
      : Math.max(
          0,
          Number(context.profession.commitRechargeDuration(rechargeContext, persistentRechargeDuration) || 0)
        );
    const ammoLockoutDuration =
      castContext.ammo && Number(skill.ammo || 0) > 0
        ? context.rechargeDurationFor(skill, effectiveEnd, {
            ...castContext,
            fullEnd,
            effectiveEnd,
            ammoCastLockout: true
          })
        : 0;
    const rechargeAnchor = skill.rechargeAnchor === 'castStart' ? castContext.start : effectiveEnd;
    const canonicalRechargeStart = rechargeAnchor + Number(skill.rechargeOffsetMs || 0) / 1000;
    const rechargeStart = Math.max(
      castContext.start,
      Number(
        context.profession.modifyRechargeStart(
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

    return reservation;
  }

  /** Keeps cast-hook emissions and tasks attached to the cast's activation lineage. */
  function createCastLifecycleContext(
    reservation: CastReservation<TProfessionState>
  ): CastLifecycleContext<TProfessionState> {
    const {
      id: reservationId,
      castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt
    } = reservation;
    if (!action) throw new Error(`Cast reservation ${reservationId} has no action.`);

    return {
      ...castContext,
      action,
      fullEnd,
      effectiveEnd,
      rechargeDuration,
      ammoLockoutDuration,
      rechargeStart,
      rechargeReadyAt,
      reservationId,
      ...activationScopedOperations(context, reservationId, reservationId)
    };
  }

  const completeReservation: ScheduledTaskHandler<SchedulerContext<TProfessionState>, CastCompletionTaskPayload> = (
    _taskContext,
    task
  ) => {
    const reservationId = task.payload?.reservationId;
    if (typeof reservationId !== 'string') return;
    const reservation = reservations.get(reservationId);
    if (!reservation) return;
    const { skill, castContext, fullEnd, effectiveEnd, rechargeDuration, ammoLockoutDuration, rechargeStart } =
      reservation;
    const active = inFlight.get(skill.id);
    active?.delete(reservation.id);
    if (active?.size === 0) inFlight.delete(skill.id);
    if (reservation.ammo) {
      cooldownController.spendAmmo(skill, rechargeStart, rechargeDuration);
      if (ammoLockoutDuration > 0) {
        cooldownController.setAmmoLockout(skill, rechargeStart + ammoLockoutDuration, rechargeStart);
      }
    } else if (rechargeDuration) {
      state.cooldowns.set(skill.id, rechargeStart + rechargeDuration);
    }

    // Cooldown/ammo commitment precedes the profession completion hook so the
    // hook observes the state players would have immediately after the cast.
    const completionContext = createCastLifecycleContext(reservation);
    activeProfession.onCastComplete(completionContext, skill);

    // Skill metadata owns trigger timing; the task executes profession state
    // changes only when that timestamp is actually reached.
    // Completion triggers describe committed effects; cancelled attempts still run lifecycle cleanup above.
    for (const trigger of reservation.action?.cancelled === true ? [] : skill.mechanicTriggers || []) {
      const authoredCastMs = Math.max(0, Number(skill.castTimeMs || 0));
      const actualCastMs = Math.max(0, fullEnd - castContext.start) * 1000;
      const authoredOffsetMs = Number(trigger.atMs || 0);
      const offsetMs =
        trigger.timingScale === 'cast' && authoredCastMs > 0
          ? authoredOffsetMs * (actualCastMs / authoredCastMs)
          : authoredOffsetMs;
      const anchor = trigger.timingAnchor === 'castStart' ? castContext.start : fullEnd;
      const triggerAt = anchor + offsetMs / 1000;
      if (triggerAt < effectiveEnd - EPSILON) {
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

  return {
    reserve,
    castContext: createCastLifecycleContext,
    completeReservation,
    reservation: (id: string) => reservations.get(id)
  };
}
