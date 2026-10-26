import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ConditionWork } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { StableEventQueue } from '#kernel/events/queue.js';

/** Resolver breakdown, queue, and reaction contracts; resolution consumes kernel randomness without execution dependencies. */

/** A queued packet as the resolver sees it, including private condition scheduling references. */
export type Gw2ConditionWorkEvent = Gw2ResolverEvent & Gw2ConditionWork;

export interface Gw2ConditionBreakdownEntry {
  name: string;
  damage: number;
  stackSeconds: number;
}

interface Gw2EnvironmentConditionTick {
  readonly at: number;
  readonly damage: number;
}

export interface Gw2EnvironmentConditionBreakdownEntry extends Gw2ConditionBreakdownEntry {
  readonly stacks: number;
  bufferedRate?: number;
  damageTicks: Gw2EnvironmentConditionTick[];
}

export interface Gw2ResolverHelpers {
  readonly balanceDataContext?: { readonly professionId: string; readonly patchId: string };
  conditionName(value: unknown): string;
  readonly skillsById?: ReadonlyMap<import('#gw2/platform/skills/types.js').SkillId, Skill>;
  readonly balanceProfilesById?: ReadonlyMap<
    import('#gw2/platform/skills/types.js').SkillId,
    import('#gw2/platform/skills/types.js').BalanceProfile
  >;
}

/** Resolution schedules packets but cannot inspect or dispatch the coordinator's mixed work heap. */
export type Gw2EventQueue = Pick<
  StableEventQueue<Gw2ConditionWorkEvent>,
  'enqueue' | 'cancel' | 'currentCausalOrder' | 'currentTime' | 'currentPhase'
>;

type Gw2ResolverEventHandler = (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => unknown;

export type Gw2ResolverEventHandlers = Readonly<Record<string, Gw2ResolverEventHandler>>;

export type Gw2ResolverStage =
  | 'aura.applied'
  | 'combo.resolved'
  | 'buff.applied'
  | 'damage.resolving'
  | 'damage.resolved'
  | 'condition.applied'
  | 'condition-tick.resolved'
  | 'control.resolved';

/** Only pre-hit resolution transforms a packet; all other stages observe accepted facts. */
export type Gw2ResolverReactions<TContext = Gw2ResolverRuntime> = Readonly<{
  [Stage in Gw2ResolverStage]?: (
    context: TContext,
    event: Gw2ResolverEvent,
    details: Record<string, unknown>
  ) => Stage extends 'damage.resolving' ? Record<string, unknown> | void : void;
}>;

interface Gw2ResolverReactionHook<Stage extends Gw2ResolverStage> {
  readonly id: string;
  readonly order: number;
  readonly handler: NonNullable<Gw2ResolverReactions[Stage]>;
}

export type Gw2ResolverReactionContributions = Readonly<{
  [Stage in Gw2ResolverStage]?: readonly Gw2ResolverReactionHook<Stage>[];
}>;

export interface Gw2ResolverReactionRegistry {
  dispatch(
    stage: 'damage.resolving',
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    details?: Record<string, unknown>
  ): Record<string, unknown> | void;
  dispatch(
    stage: Exclude<Gw2ResolverStage, 'damage.resolving'>,
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    details?: Record<string, unknown>
  ): void;
  dispatch(
    stage: Gw2ResolverStage,
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
    details?: Record<string, unknown>
  ): Record<string, unknown> | void;
}
