/** Resolver queue and reaction contracts; resolution consumes kernel randomness without execution dependencies. */
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ConditionResolution, Gw2ConditionWork } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { BalanceSource } from '#gw2/platform/skills/balance-profiles.js';
import type { StableEventQueue } from '#kernel/events/queue.js';

/** A queued packet as the resolver sees it, including private condition scheduling references. */
export type Gw2ConditionWorkEvent = Gw2ResolverEvent & Gw2ConditionWork;

/** Every resolver receives the selected skill and profile maps from simulation construction. */
export interface Gw2ResolverHelpers extends BalanceSource {
  conditionName(value: unknown): string;
}

/** Resolution schedules packets but cannot inspect or dispatch the coordinator's mixed work heap. */
export type Gw2EventQueue = Pick<
  StableEventQueue<Gw2ConditionWorkEvent>,
  'enqueue' | 'cancel' | 'currentCausalOrder' | 'currentTime' | 'currentPhase'
>;

type Gw2ResolverEventHandler = (context: Gw2ResolverRuntime, event: Gw2ResolverEvent) => unknown;

export type Gw2ResolverEventHandlers = Readonly<Record<string, Gw2ResolverEventHandler>>;

/** Each notification carries only the facts produced by its resolution stage. */
export interface Gw2ResolverStageDetails {
  'aura.applied': undefined;
  'combo.resolved': undefined;
  'buff.applied': undefined;
  'damage.resolving': undefined;
  'damage.resolved': NativeResolvedDamageDetails;
  'condition.applied': {
    readonly application: ReturnType<Gw2ConditionResolution['applyCondition']>[number];
    readonly conditionStackIndex: number;
    readonly stacksBeforeApplication: number;
    readonly activeConditionStackCount: Gw2ConditionResolution['activeConditionStackCount'];
  };
  'condition-tick.resolved': {
    readonly resolved: NonNullable<ReturnType<Gw2ConditionResolution['handleConditionTick']>>;
  };
  'control.resolved': {
    readonly activeConditionStackCount: Gw2ConditionResolution['activeConditionStackCount'];
  };
}

export type Gw2ResolverStage = keyof Gw2ResolverStageDetails;

export type Gw2ResolverReactionResult<Stage extends Gw2ResolverStage> = Stage extends 'damage.resolving'
  ? Record<string, unknown> | void
  : void;

/** Correlated tuples prevent forwarders from separating a stage from its required payload. */
export type Gw2ResolverReactionArgs<Stage extends Gw2ResolverStage = Gw2ResolverStage> = {
  [S in Stage]: [stage: S, event: Gw2ResolverEvent, details: Gw2ResolverStageDetails[S]];
}[Stage];

export type Gw2ResolverDispatchArgs<Stage extends Gw2ResolverStage = Gw2ResolverStage> = {
  [S in Stage]: [stage: S, context: Gw2ResolverRuntime, event: Gw2ResolverEvent, details: Gw2ResolverStageDetails[S]];
}[Stage];

/** Only pre-hit resolution transforms a packet; all other stages observe accepted facts. */
export type Gw2ResolverReactions<TContext = Gw2ResolverRuntime> = Readonly<{
  [Stage in Gw2ResolverStage]?: (
    context: TContext,
    event: Gw2ResolverEvent,
    details: Gw2ResolverStageDetails[Stage]
  ) => Gw2ResolverReactionResult<Stage>;
}>;

export interface Gw2ResolverReactionHook<Stage extends Gw2ResolverStage> {
  readonly id: string;
  readonly order: number;
  readonly handler: NonNullable<Gw2ResolverReactions[Stage]>;
}

export type Gw2ResolverReactionContributions = Readonly<{
  [Stage in Gw2ResolverStage]?: readonly Gw2ResolverReactionHook<Stage>[];
}>;

export interface Gw2ResolverReactionRegistry {
  dispatch<Args extends Gw2ResolverDispatchArgs>(...args: Args): Gw2ResolverReactionResult<Args[0]>;
}
