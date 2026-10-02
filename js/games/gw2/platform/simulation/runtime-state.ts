import type { createEffectReactions } from '#gw2/platform/simulation/effect-reactions.js';
import type { Gw2QueryProfession } from '#gw2/platform/combat/query/combat-query.js';
import type { ResourceKey, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type {
  createRuntimeResources,
  createRuntimeEndurance
} from '#gw2/platform/combat/resources/runtime-resources.js';
import type { Skill, SkillId, SkillEffect, SkillTask, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type {
  AmmoState,
  AvailabilityResult,
  CastCommand,
  CooldownController,
  SimulationStep
} from '#gw2/platform/execution/types.js';
import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { InternalWork, WorkOwner } from '#gw2/platform/simulation/internal-work.js';
import type { SkillFlipWindow } from '#gw2/platform/engine/skills/skill-flips.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/simulation/side-effects.js';
import type { RechargeRule, TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type {
  AutoattackChainOverride,
  AutoattackChainTransitionResult
} from '#gw2/platform/skills/autoattack-chain-controller.js';

/** A cast owns one reservation from acceptance through completion, including its selected recharge work. */
export interface RuntimeCast<TSkill extends Skill = Skill> {
  readonly id: string;
  readonly skill: TSkill;
  readonly command: CastCommand;
  readonly start: number;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeStart: number;
  readonly rechargeWork: number;
  readonly ammoLockoutWork: number;
  readonly ammo: boolean;
  /**
   * The activation ended before its authored commit point, so its committed effects never happen. Decided once at
   * acceptance from the reserved cast window, so every hook reads the same answer.
   */
  readonly cancelled: boolean;
}

/**
 * Controls a packet that a profession mechanic builds itself instead of materializing it from authored skill effects.
 * The runtime owns deferral, boon-duration sampling, and causal placement, so every profession emits the same way.
 */
export interface ProceduralEmissionOptions {
  /** The triggering packet: immediate packets queue beside it, and deferred packets keep its activation and order. */
  readonly cause?: Gw2ResolverEvent | null;
  /** A lifetime owner: a future packet waits in the queue and is cancelled together with its owner. */
  readonly owner?: WorkOwner;
  /** The queue priority of a deferred packet. */
  readonly priority?: number;
  /** Keep the buff's authored duration instead of applying boon-duration modifiers; defaults to the event's flag. */
  readonly fixedDuration?: boolean;
}

/** The payload a profession task receives when a committed activation schedules its authored skill task. */
export interface SkillTaskData<TSkill extends Skill = Skill> {
  readonly cast: RuntimeCast<TSkill>;
  readonly trigger: SkillTask;
}

/** One follow-up window; omitted bounds open it now and leave it open until consumed. */
export interface FlipWindowOptions {
  readonly availableAt?: number;
  readonly expiresAt?: number;
  /** A window can appear on the bar before it becomes castable. */
  readonly visibleAt?: number;
  /** A caller-owned identity, such as the arming cast, for expiries the caller also tracks. */
  readonly identity?: number | string;
  /** Queue priority of the expiry, so it can precede or follow same-instant casts. */
  readonly expiryPriority?: number;
}

export type RuntimeWork =
  | InternalWork<'runtime.effect', { event: SimulationEventBase }>
  | InternalWork<'runtime.flip-expiry', { skillId: SkillId; identity: number | string }>
  | InternalWork<'runtime.procedural', { event: SimulationEventBase; fixedDuration?: boolean }>
  | InternalWork<'runtime.complete', { reservationId: string }>
  | InternalWork<
      'runtime.cast-task',
      { name: string; cast: Omit<RuntimeCast, 'skill'>; skillId: SkillId; data: Record<string, unknown> }
    >
  | InternalWork<'runtime.task', { name: string; data: unknown }>;

/** The single mutable context contains both command control and actual combat state. */
export interface Gw2Runtime<T extends object = object, TSkill extends Skill = Skill> extends Gw2ResolverRuntime {
  /** Live skill lookups retain the profession type while unrelated resolver helpers stay shared. */
  readonly helpers: Omit<Gw2ResolverRuntime['helpers'], 'skills' | 'skillsById' | 'skillsByName'> &
    CanonicalCatalog<TSkill>;
  profession: T;
  time: number;
  inputReadyAt: number;
  combatActive: boolean;
  rotationEndTime: number | null;
  readonly cursor: RotationCursor;
  readonly cooldowns: Map<SkillId, number>;
  readonly rechargeProgress: Map<SkillId, RechargeProgress>;
  readonly ammo: Map<SkillId, AmmoState>;
  readonly lockouts: Map<string, number>;
  readonly inFlight: Map<SkillId, Set<string>>;
  readonly effectReactions: ReturnType<typeof createEffectReactions>;
  readonly cooldownController: CooldownController;
  readonly history: Gw2ResolverEvent[];
  readonly steps: SimulationStep[];
  resourceController: ReturnType<typeof createRuntimeResources<T>>;
  endurance: ReturnType<typeof createRuntimeEndurance<T>>;
  readonly hasExplicitCombatStart: boolean;
  emitDerived(cause: Gw2ResolverEvent, event: SimulationEventBase): Gw2ResolverEvent;
  emit(event: SimulationEventBase): Gw2ResolverEvent;
  /**
   * Emits a mechanic-built packet. A future buff waits until its own instant so its duration samples the stats live
   * when it applies; a future owner-bound packet waits so retiring the owner cancels it. Returns null when deferred.
   */
  emitProcedural(event: SimulationEventBase, options?: ProceduralEmissionOptions): Gw2ResolverEvent | null;
  /**
   * Opens a follow-up window on the profession's Core state. A finite window retires itself at expiry, and only this
   * occurrence: a later rearm of the same skill survives the older deadline.
   */
  armFlip(skillId: SkillId, window?: FlipWindowOptions): SkillFlipWindow;
  /** Retires a follow-up once; an absent window is already consumed. */
  consumeFlip(skillId: SkillId): SkillFlipWindow | undefined;
  /** True once combat has started: always without an explicit marker, otherwise from the executed marker onward. */
  combatStartedAt(at?: number): boolean;
  /** Queues private work; cancellation uses its owner and generation rather than a packet identity. */
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number): void;
  /** Snapshots cast data without cloning executable skill declarations; handlers receive `{ ...data, cast }`. */
  scheduleForCast(
    name: string,
    at: number,
    cast: RuntimeCast<TSkill>,
    data?: Record<string, unknown>,
    owner?: WorkOwner,
    priority?: number
  ): void;
  cancelOwner(owner: WorkOwner): void;
}

/** Canonical live contract: mechanics read and mutate the same context at their actual execution phase. */
export interface RuntimeProfession<T extends object, TSkill extends Skill = Skill> extends Gw2QueryProfession {
  readonly catalog: CanonicalCatalog<TSkill>;
  readonly rechargeRules?: readonly RechargeRule<T, TSkill>[];
  readonly traitTriggers?: readonly TraitTrigger<T, TSkill>[];
  createState(config: Gw2Config): T;
  projectPlanningState?(input: Gw2PlanningStateInput<T>): unknown;
  initialize?(runtime: Gw2Runtime<T, TSkill>): void;
  /** Capture immutable metadata before enqueueing; null defers/suppresses a packet without applying future state. */
  prepareEvent?(runtime: Gw2Runtime<T, TSkill>, event: SimulationEventBase): SimulationEventBase | null;
  onCombatStart?(runtime: Gw2Runtime<T, TSkill>): void;
  readonly resources?: Partial<Record<ResourceKey, ResourcePolicy<Gw2Runtime<T, TSkill>>>>;
  readonly endurance?: EndurancePolicy<Gw2Runtime<T, TSkill>>;
  reserveRecharge?(runtime: Gw2Runtime<T, TSkill>, skill: TSkill, work: number): number;
  /** Resolve the currently selected action before catalog, equipment, chain, and recharge checks. */
  modifySkillId?(runtime: Gw2Runtime<T, TSkill>, skillId: SkillId): SkillId;
  rechargeWork?(runtime: Gw2Runtime<T, TSkill>, skill: TSkill, work: number): number;
  /** Select the activation duration from current state before reserving its completion and packet timing. */
  castDurationMs?(runtime: Gw2Runtime<T, TSkill>, skill: TSkill, durationMs: number): number;
  /** Capture the selected cast variant once so reports do not query later profession state. */
  castDetail?(runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>): string | undefined;
  /** Selected mechanics may move the recharge anchor while retaining one immutable cast reservation. */
  rechargeStart?(
    runtime: Gw2Runtime<T, TSkill>,
    cast: Pick<RuntimeCast<TSkill>, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd' | 'cancelled'>,
    at: number
  ): number;
  maximumAmmo?(runtime: Gw2Runtime<T, TSkill>, skill: TSkill, maximum: number): number;
  availability?(runtime: Gw2Runtime<T, TSkill>, skill: TSkill, command: CastCommand): AvailabilityResult;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /** Capture dynamic field descriptors at acceptance, before cast-start resource mutations. */
  modifyComboFields?(
    runtime: Gw2Runtime<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    fields: Skill['comboFields']
  ): Skill['comboFields'];
  modifyEffects?(
    runtime: Gw2Runtime<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    effects: readonly SkillEffect[]
  ): readonly SkillEffect[];
  onCastStart?(runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Successful casts settle once after declared commit effects, including committed interruptions. */
  onCastCommit?(runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Cancelled attempts release reservations and cast-local state without granting commit rewards. */
  onCastCancel?(runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  readonly sideEffectHandlers?: Readonly<
    Record<string, (runtime: Gw2Runtime<T, TSkill>, context: ActionContext<TSkill>, action: SideEffectAction) => void>
  >;
  readonly autoattackChainOverrides?: readonly AutoattackChainOverride[];
  onAutoattackChainTransition?(
    runtime: Gw2Runtime<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    result: AutoattackChainTransitionResult
  ): void;
  onCooldownReset?(runtime: Gw2Runtime<T, TSkill>): void;
  readonly tasks?: Readonly<Record<string, (runtime: Gw2Runtime<T, TSkill>, data: unknown) => void>>;
  readonly eventHandlers?: Readonly<Record<string, (runtime: Gw2Runtime<T, TSkill>, event: Gw2ResolverEvent) => void>>;
  readonly reactions?: Partial<
    Record<
      Gw2ResolverStage,
      (
        runtime: Gw2Runtime<T, TSkill>,
        event: Gw2ResolverEvent,
        details: Record<string, unknown>
      ) => Record<string, unknown> | void
    >
  >;
}
