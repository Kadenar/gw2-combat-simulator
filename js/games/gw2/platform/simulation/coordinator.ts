import type { PacketIdentity } from '#gw2/platform/events/identity.js';
import type { RuntimeDriverContext } from '#gw2/platform/execution/driver-contract.js';
import { gw2ResolverPhase } from '#gw2/platform/resolver/event-phase.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { RuntimeWork } from '#gw2/platform/simulation/work-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { DEFAULT_EXECUTION_ITERATION_LIMIT } from '#kernel/execution/limits.js';
import type { ObservationPolicy } from '#kernel/execution/observation.js';
import { observationEndTime } from '#kernel/execution/observation.js';

/** Condition pulses are scheduled for every active stack at once, so they deliberately carry no causal identity. */
const SHARED_PULSE_TYPES = new Set(['condition_tick', 'condition_buffer']);

/** The coordinator is the sole clock authority and retains causal scope on the same stable event heap. */
export function createExecutionCoordinator<T extends object>(getRuntime: () => Gw2Runtime<T>) {
  // Resolver code may enqueue directly; those packets receive the same identity and cause as emitted ones.
  const queue = new StableEventQueue<Gw2ResolverEvent>([], {
    phaseFor: gw2ResolverPhase,
    prepare: (event) => identify(event)
  });
  let eventOrder = 0;
  // The event whose handlers or reactions are running; packets created meanwhile are its reactions.
  let currentCause: Gw2ResolverEvent | null = null;
  // Set while scheduled work runs: summon attack loops reschedule themselves and must not inherit the first cause.
  let causeIsScheduled = false;
  // Each accepted cast's action, so work done for the cast outside event handling still knows its cause.
  const castActions = new Map<string, Gw2ResolverEvent>();
  // The cause active when each piece of internal work was scheduled.
  const workCauses = new WeakMap<object, Gw2ResolverEvent>();

  /**
   * Names the event that caused a packet created while another event is being handled. Shared condition pulses have
   * no single cause; a packet of another cast (a trap released at Combat Start, mines detonated by a different hit) or
   * of the cast being handled already has its owner; and follow-up packets of the same skill are its own impacts
   * rather than reactions. None of those record a parent.
   */
  function reactionParent(event: PacketIdentity): number | undefined {
    const cause = currentCause;
    const causeOrder = cause?.eventOrder;
    if (!cause || causeOrder == null || SHARED_PULSE_TYPES.has(event.type)) return undefined;
    // Summons own their scheduled attack loops; only direct reactions (a pet hit's bleed) record a cause.
    if (causeIsScheduled && event.actorType === 'summon') return undefined;
    const activationId = typeof event.activationId === 'string' ? event.activationId : undefined;
    if (activationId != null && activationId !== cause.activationId && castActions.has(activationId)) return undefined;
    if (cause.type === 'action') return activationId === cause.activationId ? undefined : causeOrder;
    // Only a shared activation makes a same-skill packet a continuation; unattributed procs remain reactions.
    const continuesCause =
      activationId != null &&
      activationId === cause.activationId &&
      event.actorType === cause.actorType &&
      (event.skillId ?? event.sourceId) === (cause.skillId ?? cause.sourceId);
    return continuesCause ? undefined : causeOrder;
  }

  /**
   * Gives engine-owned pulse output an identity and parent consistent with service-submitted effects.
   */
  function identify<E extends PacketIdentity>(event: E): E {
    if (event.kind === 'internal' || event.eventOrder != null || SHARED_PULSE_TYPES.has(event.type)) return event;
    const order = ++eventOrder;
    const parent = event.parentEventOrder ?? reactionParent(event);
    return {
      ...event,
      eventOrder: order,
      causalOrder: event.causalOrder ?? queue.currentCausalOrder ?? order,
      ...(parent == null ? {} : { parentEventOrder: parent })
    };
  }

  /** Runs an event's handlers, reactions, or scheduled work with it as the cause of anything they create. */
  function withCause<R>(cause: Gw2ResolverEvent | null, run: () => R, scheduled = false): R {
    const previous = currentCause;
    const previousScheduled = causeIsScheduled;
    currentCause = cause;
    causeIsScheduled = scheduled;
    try {
      return run();
    } finally {
      currentCause = previous;
      causeIsScheduled = previousScheduled;
    }
  }

  /** Internal packets share queue ordering but cannot become public history or report rows. */
  function enqueueWork(work: RuntimeWork): void {
    if (work.at < getRuntime().time) throw new RangeError('Internal work cannot backdate the live clock.');
    const queued = queue.enqueue({ ...work, source: 'Runtime', sourceId: work.type, actorType: 'effect' });
    // Delayed work acts for whatever scheduled it, so its unattributed effects stay that event's reactions.
    if (currentCause) workCauses.set(queued, currentCause);
  }

  /** Project pending deadlines with their actual cause, excluding already identified physical summon loops. */
  function pendingEffects(
    executed: readonly Gw2ResolverEvent[],
    backgroundTasks: readonly string[] = []
  ): { at: number; cause: Gw2ResolverEvent }[] {
    const summonOwners = new Set(executed.flatMap((event) => (event.summonOwner == null ? [] : [event.summonOwner])));
    return queue.pending().flatMap((event) => {
      if (event.actorType === 'summon' || event.summonOwner != null || SHARED_PULSE_TYPES.has(event.type)) return [];
      if (event.kind !== 'internal') return [{ at: event.at, cause: event }];
      const work = event as unknown as RuntimeWork;
      if (
        work.type === 'runtime.flip-expiry' ||
        (work.owner && summonOwners.has(work.owner.id)) ||
        (work.type === 'runtime.task' && backgroundTasks.includes(work.payload.name))
      )
        return [];
      const cause = work.type === 'runtime.cast-task' ? castActions.get(work.payload.cast.id) : workCauses.get(event);
      return cause ? [{ at: event.at, cause }] : [];
    });
  }

  function run(
    runtime: Gw2Runtime<T>,
    execution: RuntimeExecution<T>,
    policy: ObservationPolicy,
    driverContext: RuntimeDriverContext<T>,
    dispatch: (event: Gw2ResolverEvent) => void,
    completion?: () => number
  ): void {
    const cursor = execution.driver.cursor;
    // Each iteration either dispatches work, consumes one command, or advances to an actual boundary.
    let finished = false;
    for (let iteration = 0; iteration < DEFAULT_EXECUTION_ITERATION_LIMIT; iteration++) {
      // The next authored marker fixes a boundary, not a gameplay transition: opening packets at that instant remain eligible.
      if (runtime.combatStartPending && cursor.command?.type === 'combat-start') {
        runtime.combatStartTime = cursor.requestAt(runtime.time);
        runtime.combatStartPending = false;
      }

      const due = queue.peek();
      if (due && due.at <= runtime.time) {
        try {
          dispatch(queue.dequeue()!);
        } finally {
          queue.currentCausalOrder = null;
        }

        continue;
      }

      const commandBoundary = execution.driver.advance(driverContext);
      if (commandBoundary === 'handled') continue;
      let nextCommandAt = commandBoundary;
      if (!cursor.command && runtime.rotationEndTime == null) {
        nextCommandAt = Math.max(cursor.endTime(), runtime.inputReadyAt);
        if (nextCommandAt <= runtime.time) {
          runtime.rotationEndTime = runtime.time;
          // A fixed safety horizon keeps condition scheduling live while an occurrence finishes early below.
          runtime.horizon = canonicalTime(completion ? runtime.time + 120 : observationEndTime(policy, runtime.time));
          nextCommandAt = Infinity;
        }
      }

      const completionAt = completion && runtime.rotationEndTime != null ? completion() : Infinity;
      if (runtime.rotationEndTime != null && runtime.time >= completionAt) {
        runtime.horizon = runtime.time;
        finished = true;
        break;
      }

      if (runtime.horizon != null && runtime.time >= runtime.horizon) {
        if (runtime.rotationEndTime == null)
          throw new RangeError('Absolute observation endTimeMs cannot precede rotation end.');
        finished = true;
        break;
      }

      const next = Math.min(nextCommandAt, queue.peek()?.at ?? Infinity, runtime.horizon ?? Infinity, completionAt);
      if (!Number.isFinite(next) || next <= runtime.time) throw new Error('Live runtime has no advancing boundary.');
      runtime.time = canonicalTime(next);
      runtime.resourceController.advance();
      runtime.endurance.advance();
      runtime.cooldownController.refresh(runtime.time);
    }

    if (!finished || runtime.rotationEndTime == null) throw new Error('Live runtime exceeded its action safety limit.');
  }

  return {
    queue,
    identify,
    reactionParent,
    withCause,
    enqueueWork,
    pendingEffects,
    run,
    eventOrder: () => eventOrder,
    nextEventOrder: () => ++eventOrder,
    recordAction: (id: string, event: Gw2ResolverEvent) => castActions.set(id, event),
    castAction: (id: string) => castActions.get(id),
    workCause: (event: Gw2ResolverEvent) => workCauses.get(event)
  };
}
