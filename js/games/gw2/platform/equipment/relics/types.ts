/** Owns the equipment/relics/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { StableEventQueue } from '#kernel/events/queue.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ProcStep, Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';
import type { Gw2TargetConfig } from '#gw2/platform/combat/state/targets.js';

/** Minimal configuration surface consumed by relic rules. */
export interface Gw2RelicConfig {
  readonly relic?: string;
  readonly precastRelics?: readonly string[];
  readonly initialThornsStacks?: number;
  readonly target?: Gw2TargetConfig;
}

/** Optional fields are initialized by the relic rule that owns each timer or history. */
export interface Gw2RelicState {
  combatStartTime?: number;
  timelineEvents?: readonly SimulationEvent[];
  timelineLength?: number;
  buffFrom?: number;
  activationTimes?: number[];
  trackedActivations?: Set<string>;
  count?: number;
  combatMarker?: SimulationEvent;
  windows?: { from: number; until: number }[];
  whirlReadyAt?: number;
  activations?: {
    readonly at: number;
    readonly expiresAt: number;
    readonly stacks: number;
    readonly event: SimulationEvent;
  }[];
  readyAt?: number;
  stackReadyAt?: number;
  buffUntil?: number;
  stacks?: number;
  expiresAt?: number;
}

export interface Gw2RelicRuntimeContext {
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
}

export interface Gw2RelicMaterializerContext {
  readonly combatStartTime?: number | null;
  readonly hasExplicitCombatStart?: boolean;
  emitDerived(cause: SimulationEvent, event: Gw2EventDraft): SimulationEvent;
}

export interface Gw2RelicContext {
  readonly helpers?: Gw2ResolverHelpers;
  precastRelics?: readonly Gw2RelicRuntime[];
  readonly config: Gw2RelicConfig;
  readonly totals: { strike: number; condition: number };
  /** Includes the direct life-siphon report, which is not queued as an owned simulation event. */
  readonly resolved: Array<
    | SimulationEvent
    | {
        readonly type: 'damage';
        readonly at: number;
        readonly source: string;
        readonly name: string;
        readonly skillName: string;
        readonly triggeredBy?: string;
        readonly coefficient: number;
        readonly hits?: SimulationEvent['hits'];
        readonly damage: number;
      }
  >;
  readonly queue: StableEventQueue<SimulationEvent>;
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
  recordProc(
    kind: string,
    name: string,
    at: number,
    sourceSkill?: string,
    detail?: string,
    icon?: string,
    cooldownReduction?: number | null,
    expiresAt?: number | null,
    effectState?: Gw2ProcStep['effectState']
  ): unknown;
  addBreakdown(name: string, amount: number, kind: string, hits?: unknown): unknown;
}

export type Gw2EventDraft = {
  readonly schedulerBoonPrediction?: boolean;
  readonly ownerActorType?: SimulationActorType;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly procType?: string;
  readonly coefficient?: number;
  readonly controlKind?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly hits?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly skillWeapon?: string;
  readonly canCrit?: boolean;
  readonly summonOwner?: SimulationEvent['summonOwner'];
  readonly independentConditionOwner?: boolean;
  readonly metadata?: SimulationEvent['metadata'];
  readonly type: string;
  readonly at: number;
  readonly source: string;
  readonly sourceId?: import('#gw2/platform/engine/skills/types.js').SkillId;
  readonly actorType?: SimulationActorType;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly damageBreakdownName?: string;
  readonly skillId?: import('#gw2/platform/engine/skills/types.js').SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly condition?: string;
  readonly fixedDuration?: boolean;
};

export type Gw2ApplyCondition = (context: Gw2RelicContext, event: Gw2EventDraft) => unknown;

export interface Gw2ConditionHelpers {
  activeConditionStackCount(context: Gw2RelicContext, condition: string, at: number): number;
  applyCondition: Gw2ApplyCondition;
}

export interface Gw2RelicRule {
  readonly createState?: () => Gw2RelicState;
  readonly materializeBoon?: (
    context: Gw2RelicMaterializerContext,
    state: Gw2RelicState,
    event: SimulationEvent
  ) => unknown;
  readonly materializeCondition?: (
    context: Gw2RelicMaterializerContext,
    state: Gw2RelicState,
    event: SimulationEvent
  ) => unknown;
  readonly control?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    helpers: Gw2ConditionHelpers
  ) => unknown;
  readonly timeline?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    events: readonly SimulationEvent[],
    rotationEndTime: number
  ) => unknown;
  readonly boon?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly combo?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly strikeMultiplier?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => number;
  readonly outgoingDamageBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    damageType: 'strike' | 'condition',
    at: number,
    event: SimulationEvent | null
  ) => number;
  readonly criticalChanceBonus?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    mightStacks: number
  ) => number;
  readonly afterHit?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    skill: Skill | null | undefined
  ) => unknown;
  readonly conditionDurationBonus?: (context: Gw2RelicContext, state: Gw2RelicState, at: number) => number;
  readonly conditionDamageBonus?: (context: Gw2RelicContext, state: Gw2RelicState, at: number) => number;
  readonly condition?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    application: SimulationEvent,
    helpers: Gw2ConditionHelpers
  ) => unknown;
  readonly damageResolved?: (context: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) => unknown;
  readonly peitha?: (
    context: Gw2RelicContext,
    state: Gw2RelicState,
    event: SimulationEvent,
    applyCondition: Gw2ApplyCondition
  ) => unknown;
}

export interface Gw2RelicRuntime {
  readonly name: string;
  readonly rules: Readonly<Gw2RelicRule>;
  readonly state: Gw2RelicState;
}
