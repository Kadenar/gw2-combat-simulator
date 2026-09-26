import type { Gw2QueryProfession } from '#gw2/platform/combat/query/combat-query.js';
import type { ResourceKey, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type {
  createRuntimeResources,
  createRuntimeEndurance
} from '#gw2/platform/combat/resources/runtime-resources.js';
import type { Skill, SkillId, SkillEffect, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
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
import type {
  AutoattackChainOverride,
  AutoattackChainTransitionResult
} from '#gw2/platform/skills/autoattack-chain-controller.js';

/** A cast owns one reservation from acceptance through completion, including its selected recharge work. */
export interface RuntimeCast {
  readonly id: string;
  readonly skill: Skill;
  readonly command: CastCommand;
  readonly start: number;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeStart: number;
  readonly rechargeWork: number;
  readonly ammoLockoutWork: number;
  readonly ammo: boolean;
}

export type RuntimeWork =
  | InternalWork<'runtime.effect', { event: SimulationEventBase }>
  | InternalWork<'runtime.complete', { reservationId: string }>
  | InternalWork<'runtime.task', { name: string; data: unknown }>;

/** The single mutable context contains both command control and actual combat state. */
export interface Gw2Runtime<T extends object = object> extends Gw2ResolverRuntime {
  /** Live command owners share the compiled catalog already supplied to combat queries. */
  readonly helpers: Gw2ResolverRuntime['helpers'] & CanonicalCatalog;
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
  readonly cooldownController: CooldownController;
  readonly history: Gw2ResolverEvent[];
  readonly steps: SimulationStep[];
  resourceController: ReturnType<typeof createRuntimeResources<T>>;
  endurance: ReturnType<typeof createRuntimeEndurance<T>>;
  readonly hasExplicitCombatStart: boolean;
  emitDerived(cause: Gw2ResolverEvent, event: SimulationEventBase): Gw2ResolverEvent;
  emit(event: SimulationEventBase): Gw2ResolverEvent;
  schedule(name: string, at: number, data?: unknown, owner?: WorkOwner, priority?: number): number;
  cancelOwner(owner: WorkOwner): void;
}

/** Canonical live contract: mechanics read and mutate the same context at their actual execution phase. */
export interface RuntimeProfession<T extends object> extends Gw2QueryProfession {
  createState(config: Gw2Config): T;
  projectPlanningState?(input: Gw2PlanningStateInput<T>): unknown;
  initialize?(runtime: Gw2Runtime<T>): void;
  /** Capture immutable metadata before enqueueing; null defers/suppresses a packet without applying future state. */
  prepareEvent?(runtime: Gw2Runtime<T>, event: SimulationEventBase): SimulationEventBase | null;
  onCombatStart?(runtime: Gw2Runtime<T>): void;
  readonly resources?: Partial<Record<ResourceKey, ResourcePolicy<Gw2Runtime<T>>>>;
  readonly endurance?: EndurancePolicy<Gw2Runtime<T>>;
  reserveRecharge?(runtime: Gw2Runtime<T>, skill: Skill, work: number): number;
  /** Resolve the currently selected action before catalog, equipment, chain, and recharge checks. */
  modifySkillId?(runtime: Gw2Runtime<T>, skillId: SkillId): SkillId;
  rechargeWork?(runtime: Gw2Runtime<T>, skill: Skill, work: number): number;
  /** Select the activation duration from current state before reserving its completion and packet timing. */
  castDurationMs?(runtime: Gw2Runtime<T>, skill: Skill, durationMs: number): number;
  /** Capture the selected cast variant once so reports do not query later profession state. */
  castDetail?(runtime: Gw2Runtime<T>, cast: RuntimeCast): string | undefined;
  /** Selected mechanics may move the recharge anchor while retaining one immutable cast reservation. */
  rechargeStart?(
    runtime: Gw2Runtime<T>,
    cast: Pick<RuntimeCast, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd'>,
    at: number
  ): number;
  maximumAmmo?(runtime: Gw2Runtime<T>, skill: Skill, maximum: number): number;
  availability?(runtime: Gw2Runtime<T>, skill: Skill, command: CastCommand): AvailabilityResult;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  /** Capture dynamic field descriptors at acceptance, before cast-start resource mutations. */
  modifyComboFields?(runtime: Gw2Runtime<T>, cast: RuntimeCast, fields: Skill['comboFields']): Skill['comboFields'];
  modifyEffects?(runtime: Gw2Runtime<T>, cast: RuntimeCast, effects: readonly SkillEffect[]): readonly SkillEffect[];
  onCastStart?(runtime: Gw2Runtime<T>, cast: RuntimeCast): void;
  onCastComplete?(runtime: Gw2Runtime<T>, cast: RuntimeCast): void;
  readonly autoattackChainOverrides?: readonly AutoattackChainOverride[];
  onAutoattackChainTransition?(
    runtime: Gw2Runtime<T>,
    cast: RuntimeCast,
    result: AutoattackChainTransitionResult
  ): void;
  onCooldownReset?(runtime: Gw2Runtime<T>): void;
  readonly tasks?: Readonly<Record<string, (runtime: Gw2Runtime<T>, data: unknown) => void>>;
  readonly eventHandlers?: Readonly<Record<string, (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => void>>;
  readonly reactions?: Partial<
    Record<
      Gw2ResolverStage,
      (
        runtime: Gw2Runtime<T>,
        event: Gw2ResolverEvent,
        details: Record<string, unknown>
      ) => Record<string, unknown> | void
    >
  >;
}
