import { defineProfessionFamily } from "../engine/profession.js";
import type {
  CanonicalCatalog,
  ProfessionFamilyDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition,
  ProfessionUiContract,
  SchedulerConfig,
  SchedulerRecord,
} from "../engine/types.js";
import { getNativeCatalogAssembly } from "./native-catalog-assembly.js";
import {
  CURRENT_PATCH_ID,
  applySkillPatch,
  patchRuntimeValuesFor,
  professionPatchFor,
  validatePatchPreview,
} from "./skill-patch.js";
import type {
  AnyNativeModule,
  NativeModule,
  NativeModuleDefinition,
  NativeProfessionContract,
  NativeProfessionDefinition,
  NativeProfessionRuntimeState,
  NativeResolvedReaction,
  NativeResolverMechanic,
  NativeSchedulerMechanic,
} from "./native-module-types.js";
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from "./types.js";

export {
  assembleNativeApplicationCatalog,
  createNativeModuleData,
  nativeSkillRuntimeOwner,
} from "./native-catalog-assembly.js";
export * from "./native-mechanics.js";
export * from "./native-module-types.js";
export * from "./skill-patch.js";

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
      readonly availability?:
        NativeSchedulerMechanic | readonly NativeSchedulerMechanic[];
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
    if (
      candidate.state?.[name] != null &&
      typeof candidate.state[name] !== "function"
    ) {
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
    if (
      declaration.phase !== "scheduler" ||
      typeof declaration.handler !== "function"
    ) {
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
  TReactions extends readonly NativeResolverMechanic[] =
    readonly NativeResolverMechanic[],
  TSchedulerMechanics extends readonly NativeSchedulerMechanic[] =
    readonly NativeSchedulerMechanic[],
  TPresentation extends object = object,
>(
  definition: NativeModuleDefinition<
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
  >,
): NativeModule<
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
    presentation:
      typeof definition.presentation === "function"
        ? definition.presentation
        : definition.presentation
          ? Object.freeze({ ...definition.presentation })
          : undefined,
  });
}

function appendOrderedHook(
  target: SchedulerRecord,
  name: string,
  declaration: NativeSchedulerMechanic,
): void {
  const existing = target[name];
  target[name] = [
    ...(existing == null
      ? []
      : Array.isArray(existing)
        ? existing
        : [existing]),
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
  for (const declaration of (mechanics.reactions ||
    []) as NativeResolvedReaction<
    Gw2ResolverRuntime,
    Gw2ResolverEvent,
    object
  >[]) {
    const existing = reactions[declaration.stage];
    reactions[declaration.stage] = [
      ...(existing == null
        ? []
        : Array.isArray(existing)
          ? existing
          : [existing]),
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
  const presentation =
    typeof module.presentation === "function"
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
  const TModules extends readonly [
    AnyNativeModule<"Core">,
    ...AnyNativeModule[],
  ],
  TPresentation extends object = object,
  TSimulation extends object = object,
>(
  definition: NativeProfessionDefinition<TModules, TPresentation, TSimulation>,
): NativeProfessionContract<TModules> {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A native profession definition is required.");
  }
  const modules = definition.modules as readonly AnyNativeModule[];
  for (const module of modules) assertNativeModuleDefinition(module);
  const preview = definition.patchPreview
    ? validatePatchPreview(definition.patchPreview)
    : null;
  const professionPatch = professionPatchFor(preview, definition.id);
  const assembly = getNativeCatalogAssembly(modules, definition.catalog);
  const core = modules[0];
  const specializations = Object.fromEntries(
    modules
      .slice(1)
      .map((module) => [
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
  let previewCatalog: Readonly<CanonicalCatalog> | null = null;
  const runtimeCatalogs = new WeakMap<
    Readonly<CanonicalCatalog>,
    Readonly<CanonicalCatalog>
  >();
  const assertPatchId = (patchId = CURRENT_PATCH_ID): string => {
    if (patchId === CURRENT_PATCH_ID) return patchId;
    if (preview && patchId === preview.id) return patchId;
    throw new TypeError(
      `Unknown ${definition.name} patch ${patchId}. Expected ${CURRENT_PATCH_ID}` +
        (preview ? ` or ${preview.id}.` : "."),
    );
  };
  const catalogFor = (
    patchId = CURRENT_PATCH_ID,
  ): Readonly<CanonicalCatalog> => {
    if (assertPatchId(patchId) === CURRENT_PATCH_ID) return family.catalog;
    previewCatalog ||= applySkillPatch(family.catalog, professionPatch);
    return previewCatalog;
  };
  const patchValuesFor = (patchId = CURRENT_PATCH_ID) =>
    assertPatchId(patchId) === CURRENT_PATCH_ID
      ? Object.freeze({})
      : patchRuntimeValuesFor(preview, definition.id);
  const resolveRuntime = (config: Readonly<SchedulerConfig> = {}) => {
    const patchId = assertPatchId(String(config.patchId || CURRENT_PATCH_ID));
    const runtime = family.resolveRuntime(config);
    if (patchId === CURRENT_PATCH_ID) return runtime;
    const cached = runtimeCatalogs.get(runtime.catalog);
    const catalog = cached || applySkillPatch(runtime.catalog, professionPatch);
    if (!cached) runtimeCatalogs.set(runtime.catalog, catalog);
    return Object.freeze({ ...runtime, catalog });
  };
  return Object.freeze({
    ...family,
    preview,
    catalogFor,
    patchValuesFor,
    resolveRuntime,
    specializationIds: Object.freeze(
      modules.slice(1).map((module) => module.id),
    ),
  }) as NativeProfessionContract<TModules>;
}
