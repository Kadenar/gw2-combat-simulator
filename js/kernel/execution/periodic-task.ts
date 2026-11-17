import { canonicalTime } from '#kernel/core/clock.js';
import type { WorkScheduler } from '#kernel/execution/scheduling.js';

/** One owned occurrence is pending per loop; the next deadline is also available to resource readiness queries. */
export interface PeriodicTaskState {
  nextAt: number;
  generation: number;
}

export function createPeriodicTaskState(): PeriodicTaskState {
  return { nextAt: Infinity, generation: 0 };
}

/** Delivery observes the canonical scheduled time exactly; callers must not round or delay it. */
export interface PeriodicTaskContext extends WorkScheduler {
  readonly time: number;
}

/** Share queue ownership and stale-work rejection while each passive declares its cadence and actual reward. */
export interface PeriodicTaskDefinition<TContext extends PeriodicTaskContext> {
  readonly name: string;
  readonly priority: number;
  readonly state: (context: TContext) => PeriodicTaskState;
  readonly nextAt: (context: TContext) => number;
  readonly run: (context: TContext) => void;
  /** Some resource rewards must expose their successor to synchronous readiness queries. */
  readonly rearmBeforeRun?: boolean;
}

/** Own one pending occurrence per state; the scheduler supplies delivery and exact-generation cancellation. */
export function createPeriodicTask<TContext extends PeriodicTaskContext>(definition: PeriodicTaskDefinition<TContext>) {
  function restart(context: TContext, deadline: number): void {
    const at = deadline === Infinity ? Infinity : canonicalTime(deadline);

    if (at < context.time) throw new RangeError(`Periodic task ${definition.name} cannot restart in the past.`);

    const state = definition.state(context);

    // Claimed or stopped generations have no queued occurrence, so ordinary rearming needs no cancellation scan.
    if (state.nextAt !== Infinity) context.cancelOwner({ id: definition.name, generation: state.generation });

    state.generation++;
    state.nextAt = at;

    if (Number.isFinite(at))
      context.schedule(
        definition.name,
        at,
        state.generation,
        { id: definition.name, generation: state.generation },
        definition.priority
      );
  }

  /** Accept only the unchanged generation token at its exact canonical deadline; stale or duplicate delivery is inert. */
  function deliver(context: TContext, data: unknown): void {
    const state = definition.state(context);

    if (state.generation !== data || state.nextAt !== context.time) return;

    // Claim before running the reward: duplicate delivery cannot grant twice, and a reward can stop or restart itself.
    state.nextAt = Infinity;

    if (definition.rearmBeforeRun) restart(context, definition.nextAt(context));

    definition.run(context);

    if (state.generation === data) restart(context, definition.nextAt(context));
  }

  return {
    restart,
    stop: (context: TContext) => restart(context, Infinity),
    deliver
  };
}
