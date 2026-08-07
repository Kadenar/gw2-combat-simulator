import { createCanonicalCatalog } from "../engine/catalog.js";
import {
  defineProfessionFamily,
} from "../engine/profession.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../engine/skill-handlers.js";
import { isInternalCooldownReady } from "../engine/clock.js";
import type {
  AvailabilityResult,
  CanonicalCatalog,
  CatalogEntity,
  ProfessionBuildDefinition,
  ProfessionFamilyContract,
  ProfessionFamilyDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition,
  ProfessionUiContract,
  SchedulerConfig,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect,
  SkillFragment,
  SkillHandlerMode,
  SkillHandlerStrategy,
  SkillId,
} from "../engine/types.js";
import type {
  Gw2EventDraft,
  Gw2HitResolutionContext,
  Gw2ModifierRule,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
} from "./types.js";

type OrderedEscapeHandler = Readonly<{
  id: string;
  order?: number;
  handler: (...args: never[]) => object | boolean | number | string | null | void;
}>;

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
    | ReadonlyMap<string, string>
    | Readonly<Record<string, string>>;
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
  readonly scheduler: (
    config: Readonly<SchedulerConfig>,
  ) => TSchedulerState;
  readonly resolver?: (
    config: Readonly<SchedulerConfig>,
  ) => TResolverState;
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
  readonly eventType: string;
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
  readonly eventType: string;
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => object | void;
}

export interface NativeSchedulerMechanic {
  readonly phase: "scheduler";
  readonly hook:
    | "availability"
    | "afterCast"
    | "onCastStart"
    | "onCastComplete";
  readonly id: string;
  readonly order: number;
  readonly handler: (...args: never[]) => object | boolean | number | string | null | void;
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
  readonly availability?: NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
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
    | TPresentation
    | ((catalog: Readonly<CanonicalCatalog>) => TPresentation);
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
    readonly scheduler: (
      config: Readonly<SchedulerConfig>,
    ) => infer TState;
  };
} ? TState : never;

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
}

export type NativeProfessionContract<
  TModules extends readonly AnyNativeModule[],
> = ProfessionFamilyContract<NativeProfessionRuntimeState<TModules>> & {
  readonly specializationIds: readonly NativeSpecializationId<TModules>[];
};

interface NativeModuleDataSelection<TContext extends object> {
  readonly id: string;
  readonly generatedSkills?: readonly Skill[];
  readonly sharedExtraSkills?: readonly Skill[];
  readonly skillMechanics?: Readonly<Record<string, SkillFragment>>;
  readonly skillOverrides?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly handlers?: NativeSkillHandlerRegistry<TContext>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?:
    | ReadonlyMap<string, string>
    | Readonly<Record<string, string>>;
  readonly autoattackChains?: NativeAutoattackChains;
  readonly specializationOnlySkillIds?: readonly SkillId[];
  readonly specializationOnlySkillOwners?: Readonly<Record<string, string>>;
}

function canonicalModuleName(
  value: object,
  specializations: readonly CatalogEntity[],
): string {
  const specialization = String(
    (value as { readonly specialization?: string }).specialization || "",
  ).toLowerCase();
  return specializations.find(
    (entry) => entry.elite && entry.name.toLowerCase() === specialization,
  )?.name || "Core";
}

/**
 * Selects generated identity metadata for one semantic owner while retaining
 * the module's locally authored mechanics, handlers, and extra skills.
 */
export function createNativeModuleData<TContext extends object>({
  id,
  generatedSkills = [],
  sharedExtraSkills = [],
  skillMechanics = {},
  skillOverrides = {},
  extraSkills = [],
  handlers,
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  autoattackChains,
  specializationOnlySkillIds = [],
  specializationOnlySkillOwners = {},
}: NativeModuleDataSelection<TContext>): NativeModuleCatalogData<TContext> {
  const forced = new Set(specializationOnlySkillIds.map(String));
  const ownsSkill = (skill: Skill): boolean => {
    const forcedOwner = specializationOnlySkillOwners[String(skill.id)];
    if (forcedOwner) return forcedOwner === id;
    if (forced.has(String(skill.id))) return true;
    return canonicalModuleName(skill, specializations) === id;
  };
  const generated = generatedSkills.filter(ownsSkill);
  const sharedExtra = sharedExtraSkills.filter(ownsSkill);
  const generatedIds = new Set(generated.map((skill) => String(skill.id)));
  const localOverrides = Object.fromEntries(
    Object.entries(skillOverrides).filter(([skillId]) =>
      generatedIds.has(String(skillId))
    ),
  );
  return Object.freeze({
    generatedSkills: Object.freeze(generated),
    generatedSkillOrder: new Map(
      generated.map((skill) => [skill.id, generatedSkills.indexOf(skill)]),
    ),
    skillMechanics: Object.freeze({ ...skillMechanics }),
    skillOverrides: Object.freeze(localOverrides),
    extraSkills: Object.freeze([...sharedExtra, ...extraSkills]),
    sharedExtraSkillOrder: new Map(
      sharedExtra.map((skill) => [skill.id, sharedExtraSkills.indexOf(skill)]),
    ),
    traits: Object.freeze(
      traits.filter((trait) =>
        canonicalModuleName(trait, specializations) === id
      ),
    ),
    specializations: Object.freeze(
      specializations.filter((specialization) =>
        specialization.elite ? specialization.name === id : id === "Core"
      ),
    ),
    ...(handlers == null ? {} : { handlers }),
    ...(weapons.length ? { weapons: Object.freeze([...weapons]) } : {}),
    ...(weaponHands instanceof Map || Object.keys(weaponHands).length
      ? { weaponHands }
      : {}),
    ...(autoattackChains == null ? {} : { autoattackChains }),
    ...(specializationOnlySkillIds.length
      ? {
          specializationOnlySkillIds: Object.freeze([
            ...specializationOnlySkillIds,
          ]),
        }
      : {}),
  });
}

function assertObject(value: object | null | undefined, label: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNativeModuleDefinition(definition: object): void {
  assertObject(definition, "Native profession module");
  const candidate = definition as {
    readonly id?: string;
    readonly data?: object;
    readonly state?: {
      readonly scheduler?: (...args: never[]) => object;
      readonly resolver?: (...args: never[]) => object;
      readonly project?: (...args: never[]) => object;
    };
    readonly mechanics?: {
      readonly availability?: NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
      readonly castLifecycle?: readonly NativeSchedulerMechanic[];
      readonly reactions?: readonly { readonly phase?: string }[];
    };
  };
  if (!String(candidate.id || "").trim()) {
    throw new TypeError("Native profession module id is required.");
  }
  assertObject(candidate.data, `${candidate.id}.data`);
  assertObject(candidate.state, `${candidate.id}.state`);
  if (typeof candidate.state?.scheduler !== "function") {
    throw new TypeError(`${candidate.id}.state.scheduler must be a function.`);
  }
  for (const name of ["resolver", "project"] as const) {
    if (candidate.state?.[name] != null &&
      typeof candidate.state[name] !== "function") {
      throw new TypeError(`${candidate.id}.state.${name} must be a function.`);
    }
  }
  const schedulerDeclarations = [
    ...(candidate.mechanics?.availability == null
      ? []
      : Array.isArray(candidate.mechanics.availability)
        ? candidate.mechanics.availability
        : [candidate.mechanics.availability]),
    ...(candidate.mechanics?.castLifecycle || []),
  ];
  for (const declaration of schedulerDeclarations) {
    if (declaration.phase !== "scheduler" ||
      typeof declaration.handler !== "function") {
      throw new TypeError(
        `${candidate.id} contains an invalid scheduler mechanic declaration.`,
      );
    }
  }
  for (const declaration of candidate.mechanics?.reactions || []) {
    if (declaration.phase !== "resolver") {
      throw new TypeError(
        `${candidate.id} contains a non-resolver reaction declaration.`,
      );
    }
  }
}

/** Declares a module without exposing engine normalization plumbing. */
export function defineNativeModule<
  const TId extends string,
  TSchedulerState extends object,
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
  TPresentation extends object = object,
>(definition: NativeModuleDefinition<
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
>): NativeModule<
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
  assertNativeModuleDefinition(definition);
  return Object.freeze({
    ...definition,
    kind: "native-profession-module" as const,
    data: Object.freeze({ ...definition.data }),
    state: Object.freeze({ ...definition.state }),
    mechanics: definition.mechanics
      ? Object.freeze({ ...definition.mechanics })
      : undefined,
    presentation: typeof definition.presentation === "function"
      ? definition.presentation
      : definition.presentation
        ? Object.freeze({ ...definition.presentation })
        : undefined,
  });
}

function resolvedReaction<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object,
>(
  eventType: string,
  declaration: Readonly<{
    id: string;
    order?: number;
    handler: (
      context: TContext,
      event: TEvent,
      details?: TDetails,
    ) => object | void;
  }>,
): NativeResolvedReaction<TContext, TEvent, TDetails> {
  if (!String(declaration.id || "").trim() ||
    typeof declaration.handler !== "function") {
    throw new TypeError(`${eventType} resolver reaction requires id and handler.`);
  }
  return Object.freeze({
    phase: "resolver",
    eventType,
    id: declaration.id,
    order: Number(declaration.order || 0),
    handler: declaration.handler,
  });
}

export function onResolvedDamage<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = NativeResolvedDamageDetails,
>(declaration: Readonly<{
  id: string;
  order?: number;
  handler: (
    context: TContext,
    event: TEvent,
    details?: TDetails,
  ) => object | void;
}>): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction("damage", declaration);
}

export function onResolvedControl<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object,
>(declaration: Readonly<{
  id: string;
  order?: number;
  handler: (
    context: TContext,
    event: TEvent,
    details?: TDetails,
  ) => object | void;
}>): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction("control", declaration);
}

export function onResolvedBlind<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends object = object,
>(declaration: Readonly<{
  id: string;
  order?: number;
  handler: (
    context: TContext,
    event: TEvent,
    details?: TDetails,
  ) => object | void;
}>): NativeResolvedReaction<TContext, TEvent, TDetails> {
  return resolvedReaction("blind", declaration);
}

export interface ResolvedCriticalHitOptions<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails,
> {
  readonly id: string;
  readonly order?: number;
  readonly chanceOnCriticalHit?: number | ((
    context: TContext,
    event: TEvent,
  ) => number);
  readonly actorTypes?: readonly ("player" | "summon" | "effect" | "unknown")[];
  readonly sourceIds?: readonly SkillId[];
  readonly when?: (
    context: TContext,
    event: TEvent,
    details: TDetails,
  ) => boolean;
  readonly expectedProgress: {
    readonly get: (context: TContext) => number;
    readonly set: (context: TContext, value: number) => void;
  };
  readonly internalCooldown?: {
    readonly duration: number;
    readonly readyAt: (context: TContext) => number;
    readonly setReadyAt: (context: TContext, readyAt: number) => void;
  };
  readonly randomStream?: string;
  readonly attribution: {
    readonly kind: "trait" | "skill" | "effect";
    readonly id: SkillId;
  };
  readonly handler: (
    context: TContext,
    event: TEvent,
    details: TDetails,
  ) => object | void;
}

/**
 * Runs a resolved critical-hit reaction without rerolling the canonical hit.
 * Deterministic mode accumulates expected critical probability; stochastic
 * mode consumes `didCrit` and a stable secondary random stream.
 */
export function onResolvedPlayerCriticalHit<
  TContext extends Gw2ResolverRuntime,
  TEvent extends Gw2ResolverEvent,
  TDetails extends NativeResolvedDamageDetails,
>(
  options: ResolvedCriticalHitOptions<TContext, TEvent, TDetails>,
): NativeResolvedReaction<TContext, TEvent, TDetails> & {
  readonly attribution: ResolvedCriticalHitOptions<
    TContext,
    TEvent,
    TDetails
  >["attribution"];
} {
  const actorTypes = new Set(options.actorTypes || ["player"]);
  const sourceIds = options.sourceIds == null
    ? null
    : new Set(options.sourceIds.map(String));
  const chanceFor = (context: TContext, event: TEvent): number => {
    const raw = typeof options.chanceOnCriticalHit === "function"
      ? options.chanceOnCriticalHit(context, event)
      : options.chanceOnCriticalHit ?? 1;
    const chance = Number(raw);
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      throw new TypeError(`${options.id} critical proc chance must be 0..1.`);
    }
    return chance;
  };
  const reaction = onResolvedDamage<TContext, TEvent, TDetails>({
    id: options.id,
    order: options.order,
    handler(context, event, details = {} as TDetails) {
      if (!actorTypes.has(event.actorType || "unknown")) return;
      if (sourceIds && !sourceIds.has(String(event.sourceId ?? ""))) return;
      if (options.when?.(context, event, details) === false) return;
      const chanceOnCritical = chanceFor(context, event);
      if (!(chanceOnCritical > 0)) return;
      const readyAt = options.internalCooldown?.readyAt(context) ?? -Infinity;
      if (context.random.stochastic) {
        if (details.hitContext?.critical?.didCrit !== true ||
          !isInternalCooldownReady(event.at, readyAt)) return;
        if (chanceOnCritical < 1 && !context.random.roll(
          chanceOnCritical,
          options.randomStream || options.id,
        )) return;
        options.handler(context, event, details);
        if (options.internalCooldown) {
          options.internalCooldown.setReadyAt(
            context,
            event.at + options.internalCooldown.duration,
          );
        }
        return;
      }
      const criticalChance = Number(
        details.hitContext?.critical?.chance ?? details.criticalChance ?? 0,
      );
      let progress = options.expectedProgress.get(context) +
        criticalChance * chanceOnCritical;
      options.expectedProgress.set(context, progress);
      while (progress >= 1 && isInternalCooldownReady(event.at, readyAt)) {
        progress -= 1;
        options.expectedProgress.set(context, progress);
        options.handler(context, event, details);
        if (options.internalCooldown) {
          options.internalCooldown.setReadyAt(
            context,
            event.at + options.internalCooldown.duration,
          );
          break;
        }
      }
    },
  });
  return Object.freeze({ ...reaction, attribution: options.attribution });
}

function schedulerMechanic(
  hook: NativeSchedulerMechanic["hook"],
  declaration: OrderedEscapeHandler,
): NativeSchedulerMechanic {
  if (!String(declaration.id || "").trim() ||
    typeof declaration.handler !== "function") {
    throw new TypeError(`${hook} scheduler mechanic requires id and handler.`);
  }
  return Object.freeze({
    phase: "scheduler",
    hook,
    id: declaration.id,
    order: Number(declaration.order || 0),
    handler: declaration.handler,
  });
}

export function skillAvailability(
  declaration: OrderedEscapeHandler,
): NativeSchedulerMechanic {
  return schedulerMechanic("availability", declaration);
}

export function afterSkillEffects(
  declaration: OrderedEscapeHandler,
): NativeSchedulerMechanic {
  return schedulerMechanic("afterCast", declaration);
}

export function augmentSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, "mode">,
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return augmentSkillHandler(beforeEffects, options);
}

export function replaceSkill<TContext extends object>(
  phases: Omit<Partial<SkillHandlerStrategy<TContext>>, "mode">,
): Readonly<SkillHandlerStrategy<TContext>> {
  const { beforeEffects = null, ...options } = phases;
  return replaceSkillHandler(beforeEffects, options);
}

interface AssembledNativeCatalog {
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly fragments: ReadonlyMap<string, Readonly<ProfessionModuleCatalogFragment>>;
  readonly skillOwners: ReadonlyMap<SkillId, string>;
}

interface AssemblyCacheEntry {
  readonly modules: readonly AnyNativeModule[];
  readonly options: NativeCatalogOptions | undefined;
  readonly assembly: AssembledNativeCatalog;
}

const assemblyCache = new WeakMap<AnyNativeModule, AssemblyCacheEntry[]>();

function entriesOf<T>(
  value: ReadonlyMap<string, T> | Readonly<Record<string, T>> | undefined,
): [string, T][] {
  return value instanceof Map ? [...value] : Object.entries(value || {});
}

function mergeEntityArrays<T extends CatalogEntity>(
  modules: readonly AnyNativeModule[],
  select: (module: AnyNativeModule) => readonly T[],
  label: string,
): { readonly values: T[]; readonly owners: Map<SkillId, string> } {
  const values: T[] = [];
  const owners = new Map<SkillId, string>();
  for (const module of modules) {
    for (const entity of select(module)) {
      const prior = owners.get(entity.id);
      if (prior) {
        throw new TypeError(
          `Duplicate ${label} ${String(entity.id)} in ${prior} and ${module.id}.`,
        );
      }
      owners.set(entity.id, module.id);
      values.push(entity);
    }
  }
  return { values, owners };
}

function applySkillNameOverrides(
  catalog: Readonly<CanonicalCatalog>,
  overrides: Readonly<Record<string, SkillId>> | undefined,
): void {
  for (const [name, skillId] of Object.entries(overrides || {})) {
    const skill = catalog.skillsById.get(skillId);
    if (!skill) {
      throw new TypeError(`Unknown skill-name override ${name}: ${String(skillId)}.`);
    }
    if (skill.name !== name) {
      throw new TypeError(
        `Skill-name override ${name} points to ${skill.name} (${String(skillId)}).`,
      );
    }
    (catalog.skillsByName as Map<string, Skill>).set(name, skill);
  }
}

function restoreSharedSourceOrder(
  values: CatalogEntity[],
  modules: readonly AnyNativeModule[],
  select: (module: AnyNativeModule) => ReadonlyMap<SkillId, number> | undefined,
): void {
  const positions = new Map<SkillId, number>();
  for (const module of modules) {
    for (const [id, position] of select(module) || []) {
      positions.set(id, position);
    }
  }
  values.sort((left, right) =>
    (positions.get(left.id) ?? Number.POSITIVE_INFINITY) -
    (positions.get(right.id) ?? Number.POSITIVE_INFINITY)
  );
}

function composeNativeCatalog(
  modules: readonly AnyNativeModule[],
  options: NativeCatalogOptions | undefined,
): AssembledNativeCatalog {
  const moduleIds = new Set(modules.map((module) => module.id));
  if (modules[0]?.id !== "Core") {
    throw new TypeError('Native profession modules must begin with "Core".');
  }
  if (moduleIds.size !== modules.length) {
    throw new TypeError("Native profession module IDs must be unique.");
  }
  const generated = mergeEntityArrays(
    modules,
    (module) => module.data.generatedSkills || [],
    "generated skill id",
  );
  const extras = mergeEntityArrays(
    modules,
    (module) => module.data.extraSkills || [],
    "extra skill id",
  );
  restoreSharedSourceOrder(
    generated.values,
    modules,
    (module) => module.data.generatedSkillOrder,
  );
  restoreSharedSourceOrder(
    extras.values,
    modules,
    (module) => module.data.sharedExtraSkillOrder,
  );
  const traits = mergeEntityArrays(
    modules,
    (module) => module.data.traits || [],
    "trait id",
  );
  const specializations = mergeEntityArrays(
    modules,
    (module) => module.data.specializations || [],
    "specialization id",
  );
  const mechanics: Record<string, SkillFragment> = {};
  const mechanicsOwners = new Map<string, string>();
  const overrides: Record<string, SkillFragment> = {};
  const overrideOwners = new Map<string, string>();
  const handlers = new Map<string, SkillHandlerStrategy<object>>();
  const handlerOwners = new Map<string, string>();
  const exclusiveOwners = new Map<string, string>();
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const weaponHandOwners = new Map<string, string>();
  const additionalChains: Array<{ owner: string; chain: readonly SkillId[] }> = [];
  const excludedChains: Array<{ owner: string; skillId: SkillId }> = [];

  for (const module of modules) {
    for (const [skillId, mechanic] of Object.entries(
      module.data.skillMechanics || {},
    )) {
      const prior = mechanicsOwners.get(skillId);
      if (prior) {
        throw new TypeError(
          `Duplicate skill mechanics ${skillId} in ${prior} and ${module.id}.`,
        );
      }
      mechanicsOwners.set(skillId, module.id);
      mechanics[skillId] = mechanic;
    }
    for (const [skillId, override] of Object.entries(
      module.data.skillOverrides || {},
    )) {
      const prior = overrideOwners.get(skillId);
      if (prior) {
        throw new TypeError(
          `Duplicate skill override ${skillId} in ${prior} and ${module.id}.`,
        );
      }
      overrideOwners.set(skillId, module.id);
      overrides[skillId] = override;
    }
    for (const [handlerId, handler] of entriesOf(
      module.data.handlers as NativeSkillHandlerRegistry<object> | undefined,
    )) {
      const prior = handlerOwners.get(handlerId);
      if (prior) {
        throw new TypeError(
          `Duplicate skill handler ${handlerId} in ${prior} and ${module.id}.`,
        );
      }
      handlerOwners.set(handlerId, module.id);
      handlers.set(handlerId, handler);
    }
    for (const skillId of module.data.specializationOnlySkillIds || []) {
      const key = String(skillId);
      const prior = exclusiveOwners.get(key);
      if (prior) {
        throw new TypeError(
          `Duplicate specialization-only skill ${key} in ${prior} and ${module.id}.`,
        );
      }
      exclusiveOwners.set(key, module.id);
    }
    for (const weapon of module.data.weapons || []) weapons.add(weapon);
    for (const [weapon, hand] of entriesOf(module.data.weaponHands)) {
      const prior = weaponHandOwners.get(weapon);
      if (prior) {
        throw new TypeError(
          `Duplicate weapon-hand entry ${weapon} in ${prior} and ${module.id}.`,
        );
      }
      weaponHandOwners.set(weapon, module.id);
      weaponHands.set(weapon, hand);
    }
    for (const chain of module.data.autoattackChains?.additional || []) {
      additionalChains.push({ owner: module.id, chain });
    }
    for (const skillId of module.data.autoattackChains?.excludeSkillIds || []) {
      excludedChains.push({ owner: module.id, skillId });
    }
  }

  const catalog = createCanonicalCatalog({
    generated: generated.values as Skill[],
    mechanics,
    overrides,
    extraSkills: extras.values as Skill[],
    skillHandlers: handlers,
    traits: traits.values,
    specializations: specializations.values,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: {
      additional: additionalChains.map((entry) => entry.chain),
      excludeSkillIds: excludedChains.map((entry) => entry.skillId),
    },
    skillNameCollision: options?.skillNameCollision,
  });
  applySkillNameOverrides(catalog, options?.skillNameOverrides);

  const eliteNames = new Map(
    catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => [specialization.name.toLowerCase(), specialization.name]),
  );
  const declaredOwners = new Map<SkillId, string>([
    ...generated.owners,
    ...extras.owners,
  ]);
  const skillOwners = new Map<SkillId, string>();
  for (const skill of catalog.skills) {
    const explicit = exclusiveOwners.get(String(skill.id));
    const specialization = eliteNames.get(
      String(skill.specialization || "").toLowerCase(),
    );
    const mechanicOwner = mechanicsOwners.get(String(skill.id));
    const owner = explicit ||
      (skill.type === "Weapon" ? "Core" : null) ||
      specialization ||
      declaredOwners.get(skill.id) ||
      mechanicOwner ||
      "Core";
    if (!moduleIds.has(owner)) {
      throw new TypeError(
        `Skill ${String(skill.id)} resolves to unknown runtime module ${owner}.`,
      );
    }
    skillOwners.set(skill.id, owner);
  }
  for (const [skillId, owner] of exclusiveOwners) {
    if (!catalog.skillsById.has(Number(skillId))) {
      throw new TypeError(
        `${owner} declares unknown specialization-only skill ${skillId}.`,
      );
    }
  }
  for (const [handlerId, owner] of handlerOwners) {
    const referencedOwners = new Set(
      catalog.skills
        .filter((skill) => skill.handlerId === handlerId)
        .map((skill) => skillOwners.get(skill.id)),
    );
    if (!referencedOwners.size) {
      throw new TypeError(`Skill handler ${handlerId} is unused.`);
    }
    if ((owner === "Core" && !referencedOwners.has("Core")) ||
      (owner !== "Core" &&
        (referencedOwners.size !== 1 || !referencedOwners.has(owner)))) {
      throw new TypeError(
        `Skill handler ${handlerId} is contributed by ${owner}, but its skills ` +
          `are available in ${[...referencedOwners].join(", ")}.`,
      );
    }
  }

  const chainContributions = new Map<string, NativeAutoattackChains>();
  for (const module of modules) {
    chainContributions.set(module.id, { additional: [], excludeSkillIds: [] });
  }
  for (const { owner: declarationOwner, chain } of additionalChains) {
    const owners = new Set(chain.map((skillId) => skillOwners.get(skillId)));
    if (owners.size !== 1 || owners.has(undefined)) {
      throw new TypeError(
        `${declarationOwner} autoattack chain crosses runtime module ownership.`,
      );
    }
    const owner = [...owners][0] as string;
    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, {
      ...current,
      additional: [...(current.additional || []), chain],
    });
  }
  for (const { skillId } of excludedChains) {
    const owner = skillOwners.get(skillId);
    if (!owner) throw new TypeError(`Unknown excluded autoattack skill ${String(skillId)}.`);
    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, {
      ...current,
      excludeSkillIds: [...(current.excludeSkillIds || []), skillId],
    });
  }

  const fragments = new Map<string, Readonly<ProfessionModuleCatalogFragment>>();
  for (const module of modules) {
    const moduleHandlers = new Map(
      [...handlers].filter(([handlerId]) => handlerOwners.get(handlerId) === module.id),
    );
    const hands = new Map(
      [...weaponHands].filter(([weapon]) => weaponHandOwners.get(weapon) === module.id),
    );
    const chains = chainContributions.get(module.id)!;
    fragments.set(module.id, Object.freeze({
      skills: Object.freeze(
        catalog.skills.filter((skill) => skillOwners.get(skill.id) === module.id),
      ),
      skillHandlers: moduleHandlers,
      traits: Object.freeze(
        catalog.traits.filter((trait) => traits.owners.get(trait.id) === module.id),
      ),
      specializations: Object.freeze(
        catalog.specializations.filter((specialization) =>
          specializations.owners.get(specialization.id) === module.id
        ),
      ),
      weapons: Object.freeze(
        [...weapons].filter((weapon) =>
          modules.find((candidate) => candidate.id === module.id)?.data.weapons
            ?.includes(weapon)
        ),
      ),
      weaponHands: hands,
      autoattackChains: Object.freeze(chains),
      ...(module.id === "Core"
        ? {
            skillNameCollision: options?.skillNameCollision,
            skillNameOverrides: options?.skillNameOverrides,
          }
        : {}),
    } as ProfessionModuleCatalogFragment));
  }
  return Object.freeze({ catalog, fragments, skillOwners });
}

function cachedAssembly(
  modules: readonly AnyNativeModule[],
  options: NativeCatalogOptions | undefined,
): AssembledNativeCatalog {
  const first = modules[0];
  if (!first) throw new TypeError("A native profession requires modules.");
  const cached = assemblyCache.get(first) || [];
  const match = cached.find((entry) =>
    entry.options === options &&
    entry.modules.length === modules.length &&
    entry.modules.every((module, index) => module === modules[index])
  );
  if (match) return match.assembly;
  const assembly = composeNativeCatalog(modules, options);
  cached.push({ modules: [...modules], options, assembly });
  assemblyCache.set(first, cached);
  return assembly;
}

/** Derives the complete application catalog from module contributions. */
export function assembleNativeApplicationCatalog(
  modules: readonly AnyNativeModule[],
  options?: NativeCatalogOptions,
): Readonly<CanonicalCatalog> {
  return cachedAssembly(modules, options).catalog;
}

export function nativeSkillRuntimeOwner(
  modules: readonly AnyNativeModule[],
  skill: Skill,
  options?: NativeCatalogOptions,
): string {
  return cachedAssembly(modules, options).skillOwners.get(skill.id) || "Core";
}

function appendOrderedHook(
  target: SchedulerRecord,
  name: string,
  declaration: NativeSchedulerMechanic,
): void {
  const existing = target[name];
  target[name] = [
    ...(existing == null ? [] : Array.isArray(existing) ? existing : [existing]),
    {
      id: declaration.id,
      order: declaration.order,
      handler: declaration.handler,
    },
  ];
}

function compileNativeModule(
  module: AnyNativeModule,
  applicationCatalog: Readonly<CanonicalCatalog>,
  fragment: Readonly<ProfessionModuleCatalogFragment>,
): ProfessionModuleDefinition {
  const mechanics = module.mechanics || {};
  const castRules = {
    ...((mechanics.castRules || {}) as SchedulerRecord),
  };
  const schedulerHooks = {
    ...((mechanics.schedulerHooks || {}) as SchedulerRecord),
  };
  for (const declaration of [
    ...(mechanics.availability == null
      ? []
      : Array.isArray(mechanics.availability)
        ? mechanics.availability
        : [mechanics.availability]),
    ...((mechanics.castLifecycle || []) as NativeSchedulerMechanic[]),
  ]) {
    appendOrderedHook(
      declaration.hook === "availability" ? castRules : schedulerHooks,
      declaration.hook,
      declaration,
    );
  }
  const resolverHooks = {
    ...((mechanics.resolverHooks || {}) as SchedulerRecord),
  };
  const reactions = {
    ...((resolverHooks.eventReactions || {}) as SchedulerRecord),
  };
  for (const declaration of (mechanics.reactions || []) as NativeResolvedReaction<
    Gw2ResolverRuntime,
    Gw2ResolverEvent,
    object
  >[]) {
    const existing = reactions[declaration.eventType];
    reactions[declaration.eventType] = [
      ...(existing == null ? [] : Array.isArray(existing) ? existing : [existing]),
      {
        id: declaration.id,
        order: declaration.order,
        handler: declaration.handler,
      },
    ];
  }
  resolverHooks.eventReactions = reactions;
  const modifiers = Array.isArray(mechanics.modifiers)
    ? { modifierRules: mechanics.modifiers }
    : mechanics.modifiers;
  const presentation = typeof module.presentation === "function"
    ? module.presentation(applicationCatalog)
    : module.presentation;
  return {
    id: module.id,
    catalog: fragment,
    resources: {
      createProfessionState: module.state.scheduler as (
        config: Readonly<SchedulerConfig>,
      ) => SchedulerRecord,
      createResolverState: module.state.resolver || module.state.scheduler,
      ...(module.state.project == null
        ? {}
        : { projectEndState: module.state.project }),
    },
    attributeRules: modifiers as SchedulerRecord | undefined,
    castRules,
    schedulerHooks,
    resolverHooks,
    ui: presentation as Partial<ProfessionUiContract> | undefined,
  };
}

/**
 * Compiles the native authoring contract into the existing engine family
 * boundary. Application and runtime catalogs are independently assembled from
 * the same module contributions.
 */
export function defineNativeProfession<
  const TModules extends readonly [AnyNativeModule<"Core">, ...AnyNativeModule[]],
  TPresentation extends object = object,
  TSimulation extends object = object,
>(definition: NativeProfessionDefinition<
  TModules,
  TPresentation,
  TSimulation
>): NativeProfessionContract<TModules> {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A native profession definition is required.");
  }
  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const assembly = cachedAssembly(modules, definition.catalog);
  const core = modules[0];
  const specializations = Object.fromEntries(
    modules.slice(1).map((module) => [
      module.id,
      compileNativeModule(
        module,
        assembly.catalog,
        assembly.fragments.get(module.id)!,
      ),
    ]),
  );
  const engineDefinition: ProfessionFamilyDefinition<
    NativeProfessionRuntimeState<TModules>
  > = {
    id: definition.id,
    name: definition.name,
    catalog: assembly.catalog,
    build: definition.build,
    core: compileNativeModule(
      core,
      assembly.catalog,
      assembly.fragments.get("Core")!,
    ),
    specializations,
    ui: definition.presentation as Partial<ProfessionUiContract> | undefined,
    simulation: definition.simulation as SchedulerRecord | null | undefined,
  };
  const family = defineProfessionFamily(engineDefinition);
  return Object.freeze({
    ...family,
    specializationIds: Object.freeze(
      modules.slice(1).map((module) => module.id),
    ),
  }) as NativeProfessionContract<TModules>;
}
