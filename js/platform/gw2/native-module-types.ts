import type {
  CanonicalCatalog,
  CatalogEntity,
  ProfessionBuildDefinition,
  ProfessionFamilyContract,
  SchedulerConfig,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId,
} from "../engine/types.js";
import type {
  Gw2EventDraft,
  Gw2HitResolutionContext,
  Gw2ModifierRule,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2ResolverStage,
} from "./types.js";
import type {
  PatchPreview,
  PatchRuntimeValues,
  ProfessionPatchPreview,
} from "./skill-patch.js";

export interface NativeAutoattackChains {
  readonly additional?: readonly (readonly SkillId[])[];
  readonly excludeSkillIds?: readonly SkillId[];
}

export type NativeSkillHandlerRegistry<TContext extends object> =
  | ReadonlyMap<string, SkillHandlerStrategy<TContext>>
  | Readonly<Record<string, SkillHandlerStrategy<TContext>>>;

export interface NativeModuleCatalogData<
  THandlerContext extends object = object,
> {
  readonly generatedSkills?: readonly Skill[];
  readonly skillMechanics?: Readonly<Record<string, SkillFragment>>;
  readonly skillOverrides?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly handlers?: NativeSkillHandlerRegistry<THandlerContext>;
  readonly weapons?: readonly string[];
  readonly weaponHands?:
    ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: NativeAutoattackChains;
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
  TProjectedState extends object,
> {
  readonly scheduler: (config: Readonly<SchedulerConfig>) => TSchedulerState;
  readonly resolver?: (config: Readonly<SchedulerConfig>) => TResolverState;
  readonly project?: (options: TProjectOptions) => TProjectedState;
}

export interface NativeResolvedDamageDetails {
  readonly hitContext?: Gw2HitResolutionContext;
  readonly criticalChance?: number;
  readonly applyCondition?: (
    context: Gw2ResolverRuntime,
    event: Gw2EventDraft,
  ) => unknown;
}

export interface NativeResolvedReaction<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object,
> {
  readonly phase: "resolver";
  readonly stage: Gw2ResolverStage;
  readonly id: string;
  readonly order: number;
  readonly handler: (
    context: TContext,
    event: TEvent,
    details?: TDetails,
  ) => object | void;
}

export interface NativeResolverMechanic {
  readonly phase: "resolver";
  readonly stage: Gw2ResolverStage;
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => object | void;
}

export interface NativeSchedulerMechanic {
  readonly phase: "scheduler";
  readonly hook:
    "availability" | "afterCast" | "onCastStart" | "onCastComplete";
  readonly id: string;
  readonly order: number;
  readonly handler: (
    ...args: never[]
  ) => object | boolean | number | string | null | void;
}

export interface NativeMechanicsDefinition<
  TModifierEscape extends object,
  TCastRulesEscape extends object,
  TSchedulerHooksEscape extends object,
  TResolverHooksEscape extends object,
  TReactions extends readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[],
> {
  /** Declarative modifier rules or an explicit legacy modifier hook bundle. */
  readonly modifiers?: readonly Gw2ModifierRule[] | TModifierEscape;
  /** Phase-explicit availability declarations. */
  readonly availability?:
    NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
  /** Phase-explicit cast lifecycle declarations. */
  readonly castLifecycle?: TSchedulerMechanics;
  /** Phase-explicit resolver reactions. */
  readonly reactions?: TReactions;
  /** Advanced scheduler cast-policy escape hatch. */
  readonly castRules?: TCastRulesEscape;
  /** Advanced scheduler lifecycle/task escape hatch. */
  readonly schedulerHooks?: TSchedulerHooksEscape;
  /** Advanced resolver event-handler/reaction escape hatch. */
  readonly resolverHooks?: TResolverHooksEscape;
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
  TPresentation extends object,
> {
  readonly id: TId;
  readonly data: NativeModuleCatalogData<THandlerContext>;
  readonly state: NativeStateDefinition<
    TSchedulerState,
    TResolverState,
    TProjectOptions,
    TProjectedState
  >;
  readonly mechanics?: NativeMechanicsDefinition<
    TModifierEscape,
    TCastRulesEscape,
    TSchedulerHooksEscape,
    TResolverHooksEscape,
    TReactions,
    TSchedulerMechanics
  >;
  readonly presentation?:
    TPresentation | ((catalog: Readonly<CanonicalCatalog>) => TPresentation);
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
  TReactions extends readonly NativeResolverMechanic[] =
    readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[] =
    readonly NativeSchedulerMechanic[],
  TPresentation extends object = object,
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
  readonly kind: "native-profession-module";
}

export interface NativeCatalogOptions {
  readonly skillNameCollision?: "first" | "last";
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

type NativeCoreState<TModules extends readonly AnyNativeModule[]> =
  NativeModuleState<Extract<TModules[number], { readonly id: "Core" }>>;

type NativeSpecializationState<TModules extends readonly AnyNativeModule[]> =
  Exclude<TModules[number], { readonly id: "Core" }> extends infer TModule
    ? TModule extends AnyNativeModule
      ? {
          readonly kind: TModule["id"];
          readonly state: NativeModuleState<TModule>;
        }
      : never
    : never;

export type NativeProfessionRuntimeState<
  TModules extends readonly AnyNativeModule[],
> = {
  readonly core: NativeCoreState<TModules>;
  readonly specialization:
    | { readonly kind: "Core"; readonly state: Record<string, never> }
    | NativeSpecializationState<TModules>;
};

export type NativeSpecializationId<
  TModules extends readonly AnyNativeModule[],
> = Exclude<TModules[number]["id"], "Core">;

export interface NativeProfessionDefinition<
  TModules extends readonly [AnyNativeModule<"Core">, ...AnyNativeModule[]],
  TPresentation extends object,
  TSimulation extends object,
> {
  readonly id: string;
  readonly name: string;
  readonly modules: TModules;
  readonly build?: ProfessionBuildDefinition;
  readonly presentation?: TPresentation;
  readonly simulation?: TSimulation | null;
  readonly catalog?: NativeCatalogOptions;
  /** The repository-wide singular active preview, when one is authored. */
  readonly patchPreview?: PatchPreview | null;
}

export interface NativePreviewModifierRuleTarget {
  readonly id: string;
  readonly moduleId: string;
  readonly fields: readonly string[];
}

export interface NativePatchAuthoringSkill {
  readonly id: SkillId;
  readonly name: string;
  readonly moduleId: string;
  readonly skill: Readonly<Skill>;
  readonly patchableFields: Readonly<Record<string, number>>;
}

export interface NativePatchAuthoringModifierValue {
  readonly kind: "static" | "resolver" | "absent";
  readonly value?: number;
}

export interface NativePatchAuthoringModifierRule {
  readonly id: string;
  readonly label: string | null;
  readonly moduleId: string;
  readonly targets: readonly string[];
  readonly operation: string;
  readonly amount: NativePatchAuthoringModifierValue;
  readonly factor: NativePatchAuthoringModifierValue;
  readonly parameters: Readonly<Record<string, number>>;
  readonly conditional: boolean;
  readonly order: number;
}

export interface NativePatchAuthoringModule {
  readonly id: string;
  readonly traits: readonly Readonly<CatalogEntity>[];
  readonly skills: readonly NativePatchAuthoringSkill[];
  readonly modifierRules: readonly NativePatchAuthoringModifierRule[];
}

export interface NativePatchAuthoringMetadata {
  readonly professionId: string;
  readonly professionName: string;
  readonly modules: readonly NativePatchAuthoringModule[];
}

export type NativeProfessionContract<
  TModules extends readonly AnyNativeModule[],
> = ProfessionFamilyContract<NativeProfessionRuntimeState<TModules>> & {
  readonly specializationIds: readonly NativeSpecializationId<TModules>[];
  readonly preview: PatchPreview | null;
  readonly catalogFor: (patchId?: string) => Readonly<CanonicalCatalog>;
  readonly patchValuesFor: (patchId?: string) => PatchRuntimeValues;
  /** Serializable live metadata consumed by the local patch authoring UI. */
  readonly patchAuthoring: NativePatchAuthoringMetadata;
  /** Validates one profession's authored edits against live declarations. */
  readonly validatePatch: (
    patch: ProfessionPatchPreview | null | undefined,
  ) => true;
  /** Validated report metadata for modifier rules touched by the preview. */
  readonly previewModifierRuleTargets: readonly NativePreviewModifierRuleTarget[];
};
