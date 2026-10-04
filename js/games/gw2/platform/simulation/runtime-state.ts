import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type {
  CastDetailContext,
  EffectOwnershipContext,
  MaximumAmmoContext,
  SelectedContentContext,
  RechargeStartContext,
  SkillSelectionContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import type { CastControl } from '#gw2/platform/execution/cast-execution.js';
import type { Gw2QueryProfession } from '#gw2/platform/combat/query/combat-query.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourceKey, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type {
  createRuntimeEndurance,
  createRuntimeResources
} from '#gw2/platform/combat/resources/runtime-resources.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';
import type { SkillFlipWindow } from '#gw2/platform/engine/skills/skill-flips.js';
import type { CanonicalCatalog, Skill, SkillEffect, SkillId, SkillTask } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import type {
  AmmoState,
  AvailabilityResult,
  CastCommand,
  CooldownController,
  SimulationStep
} from '#gw2/platform/execution/types.js';
import type { RechargeRule, TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { createEffectReactions } from '#gw2/platform/simulation/effect-reactions.js';
import type { InternalWork, WorkOwner } from '#gw2/platform/simulation/internal-work.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/simulation/side-effects.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
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
  | InternalWork<
      'runtime.announcement',
      {
        request: import('#gw2/platform/simulation/effect-emission.js').AnnouncementEmission;
        event: SimulationEventBase;
      }
    >
  | InternalWork<'runtime.flip-expiry', { skillId: SkillId; identity: number | string }>
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
  readonly castController: CastControl;
  readonly effectReactions: ReturnType<typeof createEffectReactions>;
  readonly cooldownController: CooldownController;
  readonly mechanics: MechanicContext<T, TSkill>;
  readonly mechanicQueries: MechanicQueryContext<T, TSkill>;
  readonly history: Gw2ResolverEvent[];
  readonly facts: ReturnType<typeof import('#gw2/platform/results/executed-facts.js').createExecutedFacts>;
  readonly steps: SimulationStep[];
  resourceController: ReturnType<typeof createRuntimeResources<T>>;
  endurance: ReturnType<typeof createRuntimeEndurance<T>>;
  readonly hasExplicitCombatStart: boolean;
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

/** Hook registration is selected before execution; isolated payloads do not install activation triggers. */
export interface ProfessionRuntimeOptions {
  readonly traitTriggers?: boolean;
}

/** Canonical live contract: mechanics read and mutate the same context at their actual execution phase. */
export interface RuntimeProfession<T extends object, TSkill extends Skill = Skill> extends Gw2QueryProfession {
  /** Explicit payloads are measurable without running their activation predicates. */
  readonly damageEffects?: readonly import('#gw2/platform/skill-damage/execution.js').DamageEffectDefinition[];
  /** Content owners prepare shared damage inputs; an optional skill adds its occurrence-specific state. */
  prepareDamageState?(
    runtime: MechanicContext<T, TSkill>,
    skill: TSkill | undefined,
    inputs: import('#gw2/platform/skill-damage/types.js').DamageInputs
  ): void;
  /** Native owners expose accepted state using their existing stores and balance values. */
  buffPolicies?(
    runtime: MechanicQueryContext<T, TSkill>
  ): readonly import('#gw2/platform/combat/effect-state.js').BuffStatePolicy[];
  observeEffects?(
    runtime: MechanicQueryContext<T, TSkill>
  ): readonly import('#gw2/platform/combat/effect-state.js').EffectState[];
  readonly catalog: CanonicalCatalog<TSkill>;
  /** Full profession identities remain valid selections when the active specialization narrows executable skills. */
  readonly skillSelectionCatalog?: CanonicalCatalog<TSkill>;
  readonly rechargeRules?: readonly RechargeRule<T, TSkill>[];
  readonly traitTriggers?: readonly TraitTrigger<T, TSkill>[];
  createState(config: Gw2Config): T;
  projectPlanningState?(input: Gw2PlanningStateInput<T>): unknown;
  initialize?(runtime: MechanicContext<T, TSkill>): void;
  /** Select cancellation ownership without publishing or transforming the packet. */
  effectOwner?(context: EffectOwnershipContext<TSkill>, event: SimulationEventBase): WorkOwner | undefined;
  /** Prepare at admission or an owned future impact; null suppresses the application. */
  prepareEvent?(runtime: MechanicContext<T, TSkill>, event: SimulationEventBase): SimulationEventBase | null;
  /** Profession duration rules run once at application, independently of payload authoring and source identity. */
  boonDuration?(
    context: SelectedContentContext,
    event: SimulationEventBase,
    baseDuration: number,
    scaledDuration: number
  ): number;
  onCombatStart?(runtime: MechanicContext<T, TSkill>): void;
  readonly resources?: Partial<Record<ResourceKey, ResourcePolicy<MechanicContext<T, TSkill>>>>;
  readonly endurance?: EndurancePolicy<MechanicContext<T, TSkill>>;
  reserveRecharge?(runtime: MechanicContext<T, TSkill>, skill: TSkill, work: number): number;
  /** Resolve the currently selected action before catalog, equipment, chain, and recharge checks. */
  modifySkillId?(context: SkillSelectionContext<T>, skillId: SkillId): SkillId;
  rechargeWork?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, work: number): number;
  /** Select the activation duration from current state before reserving its completion and packet timing. */
  castDurationMs?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, durationMs: number): number;
  /** Capture the selected cast variant once so reports do not query later profession state. */
  castDetail?(context: CastDetailContext<T>, cast: RuntimeCast<TSkill>): string | undefined;
  /** Selected mechanics may move the recharge anchor while retaining one immutable cast reservation. */
  rechargeStart?(
    context: RechargeStartContext,
    cast: Pick<RuntimeCast<TSkill>, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd' | 'cancelled'>,
    at: number
  ): number;
  /** Capacity selection cannot mutate the pools whose initialization it controls. */
  maximumAmmo?(context: MaximumAmmoContext<T>, skill: TSkill, maximum: number): number;
  availability?(runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, command: CastCommand): AvailabilityResult;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /** Capture dynamic field descriptors at acceptance, before cast-start resource mutations. */
  modifyComboFields?(
    runtime: MechanicQueryContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    fields: Skill['comboFields']
  ): Skill['comboFields'];
  modifyEffects?(
    runtime: MechanicContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    effects: readonly SkillEffect[]
  ): readonly SkillEffect[];
  onCastStart?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Successful casts settle once after declared commit effects, including committed interruptions. */
  onCastCommit?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  /** Cancelled attempts release reservations and cast-local state without granting commit rewards. */
  onCastCancel?(runtime: MechanicContext<T, TSkill>, cast: RuntimeCast<TSkill>): void;
  readonly sideEffectHandlers?: Readonly<
    Record<
      string,
      (runtime: MechanicContext<T, TSkill>, context: ActionContext<TSkill>, action: SideEffectAction) => void
    >
  >;
  readonly autoattackChainOverrides?: readonly AutoattackChainOverride[];
  onAutoattackChainTransition?(
    runtime: MechanicContext<T, TSkill>,
    cast: RuntimeCast<TSkill>,
    result: AutoattackChainTransitionResult
  ): void;
  onCooldownReset?(runtime: MechanicContext<T, TSkill>): void;
  /** Persistent ambient loops run normally but do not define an isolated cast's observation lifetime. */
  readonly backgroundTasks?: readonly string[];
  readonly tasks?: Readonly<Record<string, (runtime: MechanicContext<T, TSkill>, data: unknown) => void>>;
  readonly eventHandlers?: Readonly<
    Record<string, (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent) => void>
  >;
  readonly reactions?: Partial<
    Record<
      Gw2ResolverStage,
      (
        runtime: MechanicContext<T, TSkill>,
        event: Gw2ResolverEvent,
        details: Record<string, unknown>
      ) => Record<string, unknown> | void
    >
  >;
}
