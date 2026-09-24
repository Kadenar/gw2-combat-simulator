import type { ResourcePolicies } from '#gw2/platform/combat/resources/resource-policy.js';
import type { ProfessionUiContract } from '#gw2/platform/profession-presentation/types.js';
import type { AutoattackChainOptions } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import type { ProfessionBuildDefinition, UnvalidatedBuild, BuildValidationResult } from '#gw2/platform/builds/types.js';
/** Defines runtime capabilities and composition inputs; display and build callback types have separate owners. */
import type {
  SkillId,
  Skill,
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity
} from '#gw2/platform/engine/skills/types.js';
import type {
  SchedulerConfig,
  SkillHandlerStrategy,
  CastLifecycleContext,
  RegisteredTaskHandler,
  SchedulerContext,
  SkillMechanicTriggerHandler,
  CastContext,
  AvailabilityResult,
  RechargeContext,
  RechargeQueryDetails
} from '#gw2/platform/execution/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

export interface ProfessionResourceDefinition<TProfessionState extends object = object> extends ResourcePolicies {
  readonly endurance?: EndurancePolicy;
  readonly createProfessionState?: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly projectPlanningState?: unknown;
}

/** One composable hook: a bare function, or a function with ordering metadata. */
export type ProfessionHook =
  | ((...args: never[]) => unknown)
  | {
      readonly id?: string;
      readonly order?: number;
      readonly handler: (...args: never[]) => unknown;
    };

/** A hook slot accepts one hook or an ordered list of them. */
export type ProfessionHookEntry = ProfessionHook | readonly ProfessionHook[];

/** Cast-phase rules a module contributes; composition folds each slot across modules. */
export interface ProfessionCastRuleDefinition {
  readonly availability?: ProfessionHookEntry;
  readonly modifySkillId?: ProfessionHookEntry;
  readonly modifyCastDuration?: ProfessionHookEntry;
  readonly modifyRechargeDuration?: ProfessionHookEntry;
  readonly commitRechargeDuration?: ProfessionHookEntry;
  readonly modifyRechargeStart?: ProfessionHookEntry;
  readonly modifyMaximumAmmo?: ProfessionHookEntry;
}

/** Attribute-phase rules a module contributes, plus its declarative modifier fragments. */
export interface ProfessionAttributeRuleDefinition {
  readonly modifyAttributes?: ProfessionHookEntry;
  readonly modifyCriticalChance?: ProfessionHookEntry;
  readonly modifyCriticalDamage?: ProfessionHookEntry;
  readonly modifyStrikeDamage?: ProfessionHookEntry;
  readonly modifyConditionDamage?: ProfessionHookEntry;
  readonly modifyConditionBaseDuration?: ProfessionHookEntry;
  readonly modifyConditionDuration?: ProfessionHookEntry;
  /** Declarative modifier fragments compiled once per family by the single owning compiler. */
  readonly modifierRules?: readonly Gw2ModifierRule[];
  readonly compileModifierRules?: (declarations: readonly Gw2ModifierRule[]) => {
    readonly [
      K in Exclude<keyof ProfessionAttributeRuleDefinition, 'modifierRules' | 'compileModifierRules'>
    ]?: ProfessionHook;
  };
}

/**
 * Simulation policy a profession declares for the application pipeline. Game layers narrow
 * `refineSchedulerConfig` to their own config and result types.
 */
export interface ProfessionSimulationDefinition {
  readonly refineSchedulerConfig?: (...args: never[]) => object | null | undefined;
}

export interface ProfessionSchedulerHookDefinition {
  readonly prepareEvent?: unknown;
  readonly initialize?: unknown;
  readonly afterCast?: unknown;
  readonly advance?: unknown;
  readonly onCastStart?: unknown;
  readonly onCastComplete?: unknown;
  readonly onCooldownReset?: unknown;
  readonly onEventScheduled?: unknown;
  readonly onWeaponSwap?: unknown;
  readonly taskHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly skillMechanicHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
}

export interface ProfessionResolverHookDefinition {
  readonly eventHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
}

export interface ProfessionDefinition<TProfessionState extends object = object, TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly attributeRules?: ProfessionAttributeRuleDefinition;
  readonly castRules?: ProfessionCastRuleDefinition;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract>;
  readonly simulation?: ProfessionSimulationDefinition | null;
}

export interface ProfessionModuleCatalogFragment {
  readonly skills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly skillHandlers?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: AutoattackChainOptions;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export interface ProfessionModuleDefinition<TModuleState extends object = object> {
  readonly id: string;
  readonly catalog?: ProfessionModuleCatalogFragment;
  readonly resources?: ProfessionResourceDefinition<TModuleState>;
  readonly attributeRules?: ProfessionAttributeRuleDefinition;
  readonly castRules?: ProfessionCastRuleDefinition;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract>;
}

export interface ProfessionFamilyDefinition<TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly core: ProfessionModuleDefinition<any>;
  readonly specializations: Readonly<Record<string, ProfessionModuleDefinition<any>>>;
  /**
   * Application-only callbacks that are genuinely global to the family.
   * Runtime callbacks belong to Core or the active specialization module.
   */
  readonly ui?: Partial<ProfessionUiContract>;
  readonly simulation?: ProfessionSimulationDefinition | null;
}

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<
  TProfessionState extends object = object,
  TEventHandlers extends object = object,
  TEventReactions extends object = object
> {
  readonly resources: ResourcePolicies & { readonly endurance: EndurancePolicy | null };
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly simulation: ProfessionSimulationDefinition | null;
  readonly skillHandlerFor: (skill: Skill) => SkillHandlerStrategy<CastLifecycleContext<TProfessionState>> | null;
  readonly createProfessionState: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState: ((config: Readonly<SchedulerConfig>) => object) | null;
  readonly taskHandlers: Readonly<Record<string, RegisteredTaskHandler<SchedulerContext<TProfessionState>>>>;
  readonly skillMechanicHandlers: Readonly<Record<string, SkillMechanicTriggerHandler<TProfessionState>>>;
  readonly eventHandlers: TEventHandlers;
  readonly eventReactions: TEventReactions;
  readonly prepareEvent: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventBase
  ) => SimulationEventBase;
  readonly initialize: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly availability: (context: CastContext<TProfessionState>, skill: Skill) => AvailabilityResult;
  readonly afterCast: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly advance: (context: SchedulerContext<TProfessionState>, at: number) => unknown;
  readonly projectPlanningState: (...args: never[]) => unknown;
  readonly onCastStart: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCastComplete: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCooldownReset: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly onEventScheduled: (context: SchedulerContext<TProfessionState>, event: SimulationEvent) => unknown;
  readonly onWeaponSwap: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  /** Resolves build-selected skill variants before availability and resource bookkeeping. */
  readonly modifySkillId: (context: SchedulerContext<TProfessionState>, skillId: SkillId) => SkillId;
  readonly modifyCastDuration: (context: CastContext<TProfessionState>, duration: number) => number;
  /** Pure persistent recharge calculation; querying must not consume profession state. */
  readonly modifyRechargeDuration: (context: RechargeContext<TProfessionState>, duration: number) => number;
  /** Consumes cast-only modifiers once at reservation acceptance, before overlapping casts can claim them. */
  readonly commitRechargeDuration: (
    context: CastContext<TProfessionState> & RechargeQueryDetails,
    duration: number
  ) => number;
  readonly modifyRechargeStart: (
    context: CastContext<TProfessionState> & RechargeQueryDetails,
    start: number
  ) => number;
  readonly modifyMaximumAmmo: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    maximum: number
  ) => number;
  readonly modifyAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
  readonly modifyCriticalChance: (context: Gw2ModifierContext, chance: number) => number;
  readonly modifyCriticalDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyStrikeDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionBaseDuration: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDuration: (context: Gw2ModifierContext, multiplier: number) => number;
}

export interface ProfessionApplicationContract<
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: TSimulation | null;
  readonly createBuildDefaults: () => TBuild;
  readonly migrateBuild: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild: (build: UnvalidatedBuild) => BuildValidationResult;
}

export interface ProfessionFamilyContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>,
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> extends ProfessionApplicationContract<TSimulation, TBuild> {
  readonly resolveRuntime: (config: Readonly<SchedulerConfig>) => Readonly<TRuntime>;
}

export type ProfessionSource<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>,
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> = TRuntime | ProfessionFamilyContract<TProfessionState, TRuntime, TSimulation, TBuild>;
