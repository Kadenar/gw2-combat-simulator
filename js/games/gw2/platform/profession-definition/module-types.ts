import type {
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity,
  Skill,
  SkillFragment,
  SkillId
} from '#gw2/platform/engine/skills/types.js';
import type { ProfessionBuildDefinition, ProfessionFamilyContract } from '#gw2/platform/engine/profession/types.js';
import type { SchedulerConfig, SkillHandlerStrategy } from '#gw2/platform/engine/execution/types.js';
import type { Gw2ProfessionContract } from '#gw2/platform/simulation/types.js';
import type {
  Gw2HitResolutionContext,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2ResolverStage
} from '#gw2/platform/resolver/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2AutoattackChainOptions } from '#gw2/platform/skills/autoattack-chains.js';

export interface NativeAutoattackChains {
  readonly additional?: readonly (readonly SkillId[])[];
  readonly excludeSkillIds?: readonly SkillId[];
}

export type NativeSkillHandlerRegistry<TContext extends object> =
  ReadonlyMap<string, SkillHandlerStrategy<TContext>> | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;

export interface NativeModuleCatalogData {
  readonly generatedSkills?: readonly Skill[];
  readonly skillMechanics?: Readonly<Record<string, SkillFragment>>;
  readonly skillOverrides?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: NativeAutoattackChains;
  /** Runtime-local name selections for identities that collide with Core skills. */
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
  /**
   * Skills that look like ordinary weapon or Core skills in API metadata but
   * must only exist when this specialization is active.
   */
  readonly specializationOnlySkillIds?: readonly SkillId[];
  /** Stable positions from the profession-wide generated metadata input. */
  readonly generatedSkillOrder?: ReadonlyMap<SkillId, number>;
  /** Stable positions from the profession-wide shared-extra input. */
  readonly sharedExtraSkillOrder?: ReadonlyMap<SkillId, number>;
}

export interface NativeStateDefinition<
  TSchedulerState extends object,
  TResolverState extends object,
  TProjectOptions extends object,
  TProjectedState extends object
> {
  readonly scheduler: (config: Readonly<SchedulerConfig>) => TSchedulerState;
  readonly resolver?: (config: Readonly<SchedulerConfig>) => TResolverState;
  readonly project?: (options: TProjectOptions) => TProjectedState;
}

export interface NativeResolvedDamageDetails {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
}

export interface NativeResolvedReaction<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object
> {
  readonly phase: 'resolver';
  readonly stage: Gw2ResolverStage;
  readonly id: string;
  readonly order: number;
  readonly requiresCriticalFacts?: boolean;
  readonly handler: (context: TContext, event: TEvent, details?: TDetails) => object | void;
}

export interface NativeResolverMechanic {
  readonly phase: 'resolver';
  readonly stage: Gw2ResolverStage;
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => object | void;
}

export interface NativeSchedulerMechanic {
  readonly phase: 'scheduler';
  readonly hook: 'availability' | 'afterCast' | 'onCastStart' | 'onCastComplete';
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => object | boolean | number | string | null | void;
}

/** Scheduler-owned behavior exposed by one canonical profession-content module. */
export interface NativeExecutionMechanicsDefinition<
  THandlerContext extends object,
  TCastRulesEscape extends object,
  TSchedulerHooksEscape extends object,
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[]
> {
  /** Runtime implementations selected by declarative skill handler ids. */
  /** A registry may compose handlers with narrower, handler-specific contexts. */
  readonly skillHandlers?: NativeSkillHandlerRegistry<THandlerContext> | NativeSkillHandlerRegistry<never>;
  /** Phase-explicit availability declarations. */
  readonly availability?: NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
  /** Phase-explicit cast lifecycle declarations. */
  readonly castLifecycle?: TSchedulerMechanics;
  /** Profession-owned implementations for declarative skill mechanic triggers. */
  readonly skillMechanicHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  /** Advanced scheduler cast-policy escape hatch. */
  readonly castRules?: TCastRulesEscape;
  /** Advanced scheduler lifecycle/task escape hatch. */
  readonly hooks?: TSchedulerHooksEscape;
}

/** Resolver-owned behavior exposed by one canonical profession-content module. */
export interface NativeResolutionMechanicsDefinition<
  TResolverHooksEscape extends object,
  TReactions extends readonly NativeResolverMechanic[]
> {
  /** Phase-explicit resolver reactions. */
  readonly reactions?: TReactions;
  /** Advanced resolver event-handler/reaction escape hatch. */
  readonly hooks?: TResolverHooksEscape;
}

export interface NativeMechanicsDefinition<
  TModifierEscape extends object,
  TCastRulesEscape extends object,
  TSchedulerHooksEscape extends object,
  TResolverHooksEscape extends object,
  TReactions extends readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[],
  THandlerContext extends object = object
> {
  /** Declarative modifier rules or an explicit legacy modifier hook bundle. */
  readonly modifiers?: readonly Gw2ModifierRule[] | TModifierEscape;
  /** Scheduler-owned behavior. */
  readonly execution?: NativeExecutionMechanicsDefinition<
    THandlerContext,
    TCastRulesEscape,
    TSchedulerHooksEscape,
    TSchedulerMechanics
  >;
  /** Resolver-owned behavior. */
  readonly resolution?: NativeResolutionMechanicsDefinition<TResolverHooksEscape, TReactions>;
}

export interface NativeModuleDefinition<
  TId extends string,
  TSchedulerState extends object,
  TResolverState extends object,
  TProjectOptions extends object,
  TProjectedState extends object,
  THandlerContext extends object,
  TModifierEscape extends object,
  TCastRulesEscape extends object,
  TSchedulerHooksEscape extends object,
  TResolverHooksEscape extends object,
  TReactions extends readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[],
  TPresentation extends object
> {
  readonly id: TId;
  readonly data: NativeModuleCatalogData;
  readonly state: NativeStateDefinition<TSchedulerState, TResolverState, TProjectOptions, TProjectedState>;
  readonly mechanics?: NativeMechanicsDefinition<
    TModifierEscape,
    TCastRulesEscape,
    TSchedulerHooksEscape,
    TResolverHooksEscape,
    TReactions,
    TSchedulerMechanics,
    THandlerContext
  >;
  readonly presentation?: TPresentation | ((catalog: Readonly<CanonicalCatalog>) => TPresentation);
}

export interface NativeModule<
  TId extends string = string,
  TSchedulerState extends object = object,
  TResolverState extends object = TSchedulerState,
  TProjectOptions extends object = object,
  TProjectedState extends object = object,
  THandlerContext extends object = object,
  TModifierEscape extends object = object,
  TCastRulesEscape extends object = object,
  TSchedulerHooksEscape extends object = object,
  TResolverHooksEscape extends object = object,
  TReactions extends readonly NativeResolverMechanic[] = readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[] = readonly NativeSchedulerMechanic[],
  TPresentation extends object = object
> extends NativeModuleDefinition<
  TId,
  TSchedulerState,
  TResolverState,
  TProjectOptions,
  TProjectedState,
  THandlerContext,
  TModifierEscape,
  TCastRulesEscape,
  TSchedulerHooksEscape,
  TResolverHooksEscape,
  TReactions,
  TSchedulerMechanics,
  TPresentation
> {
  readonly kind: 'native-profession-module';
}

export interface NativeCatalogOptions {
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export type AnyNativeModule<TId extends string = string> = NativeModule<
  TId,
  object,
  object,
  never,
  object,
  never,
  object,
  object,
  object,
  object,
  readonly NativeResolverMechanic[],
  readonly NativeSchedulerMechanic[],
  object
>;

type NativeModuleState<TModule> = TModule extends {
  readonly state: {
    readonly scheduler: (config: Readonly<SchedulerConfig>) => infer TState;
  };
}
  ? TState
  : never;

type NativeCoreState<TModules extends readonly AnyNativeModule[]> = NativeModuleState<
  Extract<TModules[number], { readonly id: 'Core' }>
>;

type NativeSpecializationState<TModules extends readonly AnyNativeModule[]> =
  Exclude<TModules[number], { readonly id: 'Core' }> extends infer TModule
    ? TModule extends AnyNativeModule
      ? {
          readonly kind: TModule['id'];
          readonly state: NativeModuleState<TModule>;
        }
      : never
    : never;

export type NativeProfessionRuntimeState<TModules extends readonly AnyNativeModule[]> = {
  readonly core: NativeCoreState<TModules>;
  readonly specialization:
    { readonly kind: 'Core'; readonly state: Record<string, never> } | NativeSpecializationState<TModules>;
};

export type NativeSpecializationId<TModules extends readonly AnyNativeModule[]> = Exclude<
  TModules[number]['id'],
  'Core'
>;

export interface NativeProfessionDefinition<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
> {
  readonly id: string;
  readonly name: string;
  readonly modules: TModules;
  readonly build?: ProfessionBuildDefinition;
  readonly presentation?: TPresentation;
  readonly simulation?: TSimulation | null;
  readonly catalog?: NativeCatalogOptions;
  /** Profession-specific exceptions and observers for the automatically installed GW2 chain controller. */
  readonly autoattackChains?: Gw2AutoattackChainOptions;
}

export type NativeProfessionContract<
  TModules extends readonly [AnyNativeModule<'Core'>, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object
> = ProfessionFamilyContract<
  NativeProfessionRuntimeState<TModules>,
  Gw2ProfessionContract<NativeProfessionRuntimeState<TModules>>
> & {
  readonly specializationIds: readonly NativeSpecializationId<TModules>[];
  /** Retains the immutable composition input so optional integrations can decorate the family without content imports. */
  readonly nativeDefinition: Readonly<NativeProfessionDefinition<TModules, TPresentation, TSimulation>>;
};
