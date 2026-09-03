/** Owns the equipment/relics/types.d.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { StableEventQueue } from '#kernel/events/queue.js';
import type { SchedulerRecord, SimulationActorType, SimulationEvent, Skill } from '#gw2/platform/engine/types.js';

/** Minimal configuration surface consumed by relic rules. */
export interface Gw2RelicConfig extends SchedulerRecord {
  readonly initialThornsStacks?: number;
  readonly target?: {
    readonly health?: number;
  };
}

export interface Gw2RelicState extends SchedulerRecord {
  readyAt?: number;
  buffUntil?: number;
  stacks?: number;
  expiresAt?: number;
}

export interface Gw2RelicRuntimeContext extends SchedulerRecord {
  readonly combatStartTime?: number | null;
  readonly relic?: Gw2RelicRuntime;
}

export interface Gw2RelicMaterializerContext {
  emitDerived(cause: SimulationEvent, event: Gw2EventDraft): SimulationEvent;
}

export interface Gw2RelicContext extends SchedulerRecord {
  readonly config: Gw2RelicConfig;
  readonly totals: { strike: number; condition: number };
  readonly resolved: SchedulerRecord[];
  readonly queue: SimulationEvent[] | StableEventQueue<SimulationEvent>;
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
    expiresAt?: number | null
  ): unknown;
  addBreakdown(name: string, amount: number, kind: string, hits?: unknown): unknown;
}

export interface Gw2EventDraft extends SchedulerRecord {
  readonly type: string;
  readonly at: number;
  readonly source: string;
  readonly sourceId?: import('#gw2/platform/engine/types.js').SkillId;
  readonly actorType?: SimulationActorType;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly damageBreakdownName?: string;
  readonly skillId?: import('#gw2/platform/engine/types.js').SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly condition?: string;
  readonly fixedDuration?: boolean;
}

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
  readonly weaknessVulnerability?: (
    context: Gw2RelicRuntimeContext,
    state: Gw2RelicState,
    event: SimulationEvent
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
