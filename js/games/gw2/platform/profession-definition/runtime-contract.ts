import type { Gw2QueryProfession } from '#gw2/platform/combat/query/combat-query.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourceKey, ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type {
  AutoattackChainOverride,
  AutoattackChainTransitionResult
} from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { AvailabilityResult, CastCommand } from '#gw2/platform/execution/types.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type {
  CastDetailContext,
  EffectOwnershipContext,
  MaximumAmmoContext,
  RechargeStartContext,
  SelectedContentContext,
  SkillSelectionContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import type { RechargeRule, TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Hook registration is selected before execution; isolated payloads do not install activation triggers. */
export interface ProfessionRuntimeOptions {
  readonly traitTriggers?: boolean;
}

/** Canonical live contract: mechanics read and mutate the same context at their actual execution phase. */
export interface RuntimeProfession<T extends object, TSkill extends Skill = Skill> extends Gw2QueryProfession {
  /** Explicit payloads are measurable without running their activation predicates. */
  readonly damageEffects?: readonly import('#gw2/platform/skill-damage/types.js').DamageEffectDefinition[];
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
