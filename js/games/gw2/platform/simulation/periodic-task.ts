import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** One owned occurrence is pending per loop; the next deadline is also available to resource readiness queries. */
export interface PeriodicTaskState {
  nextAt: number;
  generation: number;
}

export function createPeriodicTaskState(): PeriodicTaskState {
  return { nextAt: Infinity, generation: 0 };
}

type PeriodicContext = Pick<MechanicContext, 'time' | 'schedule' | 'cancelOwner'>;

/** Share queue ownership and stale-work rejection while each passive declares its cadence and actual reward. */
export function definePeriodicTask<TContext extends PeriodicContext>(definition: {
  readonly name: string;
  readonly priority: number;
  /** Background loops never extend isolated previews; other loops retain their causal completion ownership. */
  readonly background: boolean;
  readonly state: (context: TContext) => PeriodicTaskState;
  readonly nextAt: (context: TContext) => number;
  readonly run: (context: TContext) => void;
  /** Some resource rewards must expose their successor to synchronous readiness queries. */
  readonly rearmBeforeRun?: boolean;
}) {
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

  function pulse(context: TContext, data: unknown): void {
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
    // Recurrence alone does not determine whether pending work belongs to the previewed skill.
    hooks: { backgroundTasks: definition.background ? [definition.name] : [], tasks: { [definition.name]: pulse } }
  };
}
