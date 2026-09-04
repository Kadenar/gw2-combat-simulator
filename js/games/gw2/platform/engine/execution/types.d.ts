/** Defines scheduling state, cast commands, and observation contracts used to execute rotations. */
import type {
  Skill,
  SkillMechanicTrigger,
  SkillHandlerMode,
  SkillEffect,
  SkillId,
  CanonicalCatalog
} from '#gw2/platform/engine/skills/types.js';
import type { SimulationEvent, SimulationEventInput, ScheduledEventStream } from '#gw2/platform/engine/events/types.js';
import type { NormalizedProfessionContract } from '#gw2/platform/engine/profession/types.js';

export type ObservationPolicy =
  | { readonly kind: 'rotation' }
  | { readonly kind: 'tail'; readonly durationMs: number }
  | { readonly kind: 'absolute'; readonly endTimeMs: number };

export type NormalizedObservationPolicy = ObservationPolicy;

/** Runtime input supplied when a declarative skill mechanic reaches its scheduled timestamp. */
export interface SkillMechanicInvocation<TProfessionState extends object = SchedulerRecord> {
  readonly context: SchedulerContext<TProfessionState>;
  readonly skill: Skill;
  readonly trigger: SkillMechanicTrigger;
  readonly at: number;
  readonly castStart: number;
  readonly castEnd: number;
  readonly activationId: string;
}

export type SkillMechanicTriggerHandler<TProfessionState extends object = SchedulerRecord> = (
  invocation: SkillMechanicInvocation<TProfessionState>
) => unknown;

export type SchedulerRecord = Record<string, unknown>;

export type SkillHandlerPhase<TContext extends object = SchedulerRecord> = (context: TContext, skill: Skill) => unknown;

export interface SkillHandlerStrategy<TContext extends object = SchedulerRecord> {
  readonly mode: SkillHandlerMode;
  readonly resolveMode?: (context: TContext, skill: Skill) => SkillHandlerMode;
  readonly beforeEffects?: SkillHandlerPhase<TContext>;
  readonly afterEffect?: (
    context: TContext,
    skill: Skill,
    event: SimulationEvent,
    handlerState: unknown,
    details: {
      readonly effect: SkillEffect;
      readonly effectIndex: number;
    }
  ) => unknown;
  readonly afterEffects?: (context: TContext, skill: Skill, handlerState: unknown) => unknown;
}

export interface AmmoState {
  charges: number;
  maximum: number;
  rechargeDuration: number;
  nextRechargeAt: number | null;
}

export interface SchedulerState<TProfessionState = SchedulerRecord> {
  time: number;
  cooldowns: Map<SkillId, number>;
  ammo: Map<SkillId, AmmoState>;
  lockouts: Map<string, number>;
  activeWeaponSet: number;
  skillUses: Map<SkillId, number>;
  pendingEvents: SimulationEvent[];
  profession: TProfessionState;
}

export interface ScheduledTask<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly at: number;
  readonly priority: number;
  readonly ownerId: string | null;
  readonly payload: TPayload | null;
  readonly order: number;
}

export interface ScheduledTaskInput<TPayload = unknown> {
  readonly id?: string;
  readonly type: string;
  readonly at: number;
  readonly priority?: number;
  readonly ownerId?: string | number | null;
  readonly payload?: TPayload;
  readonly required?: boolean;
}

export type ScheduledTaskHandler<TContext = unknown, TPayload = unknown> = (
  context: TContext,
  task: ScheduledTask<TPayload>
) => unknown;

export interface TaskQueue<TContext = unknown, TPayload = unknown> {
  schedule(task: ScheduledTaskInput<TPayload>): string;
  cancel(id: string | number): void;
  cancelOwner(ownerId: string | number): void;
  nextAt(type?: string): number;
  drainThrough(target: number, context: TContext): void;
  has(id: string | number): boolean;
}

export type AvailabilityResult =
  | Readonly<{ ready: true }>
  | Readonly<{
      ready: false;
      retryAt: null;
      reason: string;
      code: string;
    }>
  | Readonly<{
      ready: false;
      retryAt: number;
      reason: string;
      code: string;
    }>;

export interface SchedulerConfig extends SchedulerRecord {
  readonly boons?: Readonly<Record<string, boolean | number>>;
}

export interface CooldownController {
  ammoMaximum(skill: Skill): number;
  ensureAmmo(skill: Skill, at?: number): AmmoState | null;
  reduceAmmoRecharge(skill: Skill, reduction: number, at?: number): { ammo: AmmoState | null; reducedBy: number };
  reduceSkillRecharge(skill: Skill, reduction: number, at?: number): number;
  refreshAmmo(skill: Skill, at: number): AmmoState | null;
  setAmmoLockout(skill: Skill, readyAt: number, at?: number): AmmoState | null;
  spendAmmo(skill: Skill, at: number): AmmoState | false;
}

export interface SchedulerTaskAccess {
  schedule(task: ScheduledTaskInput<SchedulerRecord>): string;
  cancel(id: string | number): void;
  cancelOwner(ownerId: string | number): void;
  nextAt(type?: string): number;
}

export interface SchedulerPolicy<TProfessionState extends object = SchedulerRecord> {
  readonly initialWeaponSet?: (input: {
    profession: NormalizedProfessionContract<TProfessionState>;
    config: SchedulerConfig;
  }) => number;
  readonly prepareEvent?: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventInput
  ) => SimulationEventInput | undefined;
  readonly initialize?: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly availability?: (context: CastContext<TProfessionState>, skill: Skill) => AvailabilityResult;
  readonly castDuration?: (
    context: CastContext<TProfessionState>,
    skill: Skill,
    duration: number
  ) => number | undefined;
  readonly rechargeDuration?: (
    context: SchedulerContext<TProfessionState> & SchedulerRecord,
    skill: Skill,
    duration: number
  ) => number | undefined;
  readonly maximumAmmo?: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    skill: Skill,
    maximum: number
  ) => number | undefined;
  readonly effectTiming?: (
    context: SchedulerContext<TProfessionState> &
      SchedulerRecord & {
        skill: Skill;
        start: number;
        fullEnd: number;
        effectiveEnd: number;
      },
    skill: Skill,
    effect: SkillEffect
  ) => SkillEffect | undefined;
  readonly effectDuration?: (
    context: SchedulerContext<TProfessionState>,
    skill: Skill,
    effect: SkillEffect,
    duration: number
  ) => number | undefined;
  readonly buffStacks?: (
    context: SchedulerContext<TProfessionState>,
    kind: string,
    at: number,
    configuredStacks: number,
    applications: readonly SimulationEvent[],
    defaultStacks: number
  ) => number | undefined;
  readonly onEventScheduled?: (context: SchedulerContext<TProfessionState>, event: SimulationEvent) => unknown;
  readonly advance?: (context: SchedulerContext<TProfessionState>, at: number) => unknown;
  readonly taskHandlers?: Readonly<
    Record<string, ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>>
  >;
}

export interface SchedulerContext<TProfessionState extends object = SchedulerRecord> {
  readonly profession: NormalizedProfessionContract<TProfessionState>;
  readonly config: SchedulerConfig;
  readonly catalog: CanonicalCatalog;
  readonly state: SchedulerState<TProfessionState>;
  readonly events: SimulationEvent[];
  readonly warnings: string[];
  readonly epsilon: number;
  readonly schedulerPolicy: SchedulerPolicy<TProfessionState>;
  readonly observationPolicy: NormalizedObservationPolicy;
  observationEndTime: number | null;
  readonly inFlight: Map<SkillId, Set<string>>;
  hasExplicitCombatStart: boolean;
  combatStartTime: number | null;
  tasks: SchedulerTaskAccess;
  cooldownController: CooldownController;
  castDurationFor(context: CastContext<TProfessionState>, skill: Skill): number;
  rechargeDurationFor(skill: Skill, at?: number, details?: SchedulerRecord): number;
  maximumAmmoFor(skill: Skill): number;
  createActivationId(kind?: 'effect' | 'summon-attack' | string): string;
  advanceTo(at: number): void;
  eventsOfType(type: string): readonly SimulationEvent[];
  eventByOrder(order: number): SimulationEvent | undefined;
  emit(event: SimulationEventInput): SimulationEvent;
  replaceEvent(event: SimulationEvent, updates: SchedulerRecord): SimulationEvent;
  emitDerived(cause: SimulationEvent, event: SimulationEventInput): SimulationEvent;
  buffStacks(kind: string, at?: number): number;
  hasBuff(kind: string, at?: number): boolean;
}

export type CastContext<TProfessionState extends object = SchedulerRecord> = SchedulerContext<TProfessionState> &
  SchedulerRecord & {
    readonly command: CastCommand;
    readonly commandIndex: number;
    readonly skill: Skill;
    readonly start: number;
    readonly ammo: AmmoState | null;
  };

export type CastLifecycleContext<TProfessionState extends object = SchedulerRecord> = CastContext<TProfessionState> & {
  readonly action: SimulationEvent;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeDuration: number;
  readonly ammoLockoutDuration: number;
  readonly rechargeStart: number;
  readonly rechargeReadyAt: number | null;
  readonly reservationId: string;
};

export interface SchedulerStep {
  readonly ri: number;
  readonly skill: string;
  /** Stable cast identity used by result analysis without relying on display names or bar positions. */
  readonly skillId?: SkillId;
  readonly start: number;
  readonly end: number;
  readonly activationId?: string;
  readonly actualStart?: number;
  readonly fullCastMs?: number;
  readonly interrupted?: boolean;
  /** Millisecond timestamp through which this cast still reserves its execution lane after ending. */
  readonly castLockoutEnd?: number;
  /** Identifies an interrupted commit-mode cast that ended before every declared interrupt cutoff. */
  readonly cancelledBeforeCommit?: boolean;
  /** Identifies interrupted commit-mode casts whose damage had no commit cutoff and can therefore be reported as wasted time. */
  readonly missingInterruptCommit?: boolean;
  readonly invalid?: boolean;
  readonly invalidReason?: string;
}

export interface SchedulerRunResult<TProfessionState extends object = SchedulerRecord> {
  readonly context: SchedulerContext<TProfessionState>;
  readonly state: SchedulerState<TProfessionState>;
  readonly events: readonly SimulationEvent[];
  readonly steps: readonly SchedulerStep[];
  readonly warnings: readonly string[];
  readonly snapshot: unknown;
  readonly stream: ScheduledEventStream;
}

export interface Scheduler<TProfessionState extends object = SchedulerRecord> {
  readonly state: SchedulerState<TProfessionState>;
  readonly events: SimulationEvent[];
  readonly warnings: string[];
  readonly context: SchedulerContext<TProfessionState>;
  cast(command: CastCommand, commandIndex?: number): boolean;
  advanceTo(at: number): void;
  run(rotation: readonly unknown[]): SchedulerRunResult<TProfessionState>;
}

export interface CastCommand {
  readonly type: 'cast';
  readonly skillId: SkillId;
  /** Casts normally but prevents this activation's hostile packets from reaching the target. */
  readonly offTarget?: boolean;
  readonly concurrentOffsetMs?: number;
  readonly interruptAfterMs?: number;
  /** Exact remaining duration carried by a hidden combat-log initial-state action. */
  readonly initialStateDurationMs?: number;
  readonly releaseAtCharges?: number;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

export interface WaitCommand {
  readonly type: 'wait';
  readonly durationMs: number;
}

export interface CombatStartCommand {
  readonly type: 'combat-start';
  readonly concurrentOffsetMs?: number;
}

export interface CooldownResetCommand {
  readonly type: 'cooldown-reset';
}

export type RotationCommand = CastCommand | WaitCommand | CombatStartCommand | CooldownResetCommand;
