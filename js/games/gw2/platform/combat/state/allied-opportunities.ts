import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';

interface AlliedStream<T> {
  readonly owner?: WorkOwner;
  readonly anchor: number;
  readonly interval: number;
  readonly data: T;
}

interface AlliedCursor<T> extends AlliedStream<T> {
  readonly index: number;
  readonly at: number;
}

interface AlliedOpportunityDefinition<State extends object, TSkill extends Skill, TData> {
  readonly name: string;
  readonly priority: number;
  // Absolute strike grids and repeatedly rounded passive deadlines have distinct timing contracts.
  readonly cadence: 'anchored' | 'stepped';
  eligibleAt(runtime: MechanicContext<State, TSkill>, stream: AlliedStream<TData>, at: number): boolean;
  attempt(runtime: MechanicContext<State, TSkill>, stream: AlliedStream<TData>): void;
}

/** Shares one-next-wake transport; professions retain grant identity, combat gates, consumption, and payloads. */
export function defineAlliedOpportunityTask<State extends object, TSkill extends Skill, TData>(
  definition: AlliedOpportunityDefinition<State, TSkill, TData>
) {
  type Runtime = MechanicContext<State, TSkill>;
  type Cursor = AlliedCursor<TData>;

  function scheduleNext(runtime: Runtime, cursor: Cursor): void {
    if (runtime.deathTime != null) return;
    if (cursor.at <= runtime.time) throw new RangeError('Allied opportunities must advance the clock.');
    if (!definition.eligibleAt(runtime, cursor, cursor.at)) return;
    runtime.schedule(definition.name, cursor.at, cursor, cursor.owner, definition.priority);
  }

  const tasks: NonNullable<RuntimeHooks<State, TSkill>['tasks']> = {
    [definition.name](runtime, data) {
      const cursor = data as Cursor;
      if (runtime.deathTime != null || !definition.eligibleAt(runtime, cursor, runtime.time)) return;
      definition.attempt(runtime, cursor);
      // A blocked proc still advances its strike cursor; only the canonical owner can end the stream.
      const index = cursor.index + 1;
      const at = canonicalTime(
        definition.cadence === 'anchored' ? cursor.anchor + index * cursor.interval : runtime.time + cursor.interval
      );
      scheduleNext(runtime, { ...cursor, index, at });
    }
  };

  return {
    tasks,
    /** The granting owner starts each recipient stream once and cancels replacements through cancelOwner. */
    start(runtime: Runtime, stream: AlliedStream<TData>): void {
      if (!Number.isFinite(stream.interval) || stream.interval <= 0)
        throw new RangeError('Allied strike intervals must be positive and finite.');
      scheduleNext(runtime, { ...stream, index: 1, at: canonicalTime(stream.anchor + stream.interval) });
    }
  };
}
