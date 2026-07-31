/**
 * Profession contract composition. This module turns sparse profession
 * definitions into deterministic no-op-safe contracts so the neutral engine can
 * run different professions without special cases.
 */
import type {
  CatalogEntity,
  CanonicalCatalog,
  AvailabilityResult,
  NormalizedProfessionContract,
  PaletteSkillAvailability,
  ProfessionDefinition,
  ProfessionFamilyContract,
  ProfessionFamilyDefinition,
  ProfessionModuleCatalogFragment,
  ProfessionModuleDefinition,
  ProfessionSource,
  ProfessionUiContract,
  SchedulerRecord,
  SchedulerConfig,
  Skill,
  SkillId,
} from "./types.js";
import { createCanonicalCatalog } from "./catalog.js";

type ComposableHook = (...args: any[]) => unknown;

interface OrderedHook {
  readonly id: string;
  readonly order: number;
  readonly handler: ComposableHook;
  readonly index: number;
}

type EventReaction = (
  context: SchedulerRecord,
  event: SchedulerRecord,
  details?: SchedulerRecord,
) => unknown;
const HOOK_NAMES = Object.freeze([
  "initialize",
  "availability",
  "validateCast",
  "scheduleSkill",
  "afterCast",
  "advance",
  "snapshot",
  "projectEndState",
  "onCastStart",
  "onCastComplete",
  "onCooldownReset",
  "onEventScheduled",
  "modifyCastDuration",
  "modifyRechargeDuration",
  "modifyRechargeStart",
  "modifyMaximumAmmo",
  "modifyAttributes",
  "modifyCriticalChance",
  "modifyCriticalDamage",
  "modifyStrikeDamage",
  "modifyConditionDamage",
  "modifyConditionBaseDuration",
  "modifyConditionDuration",
]);

const NOOP: ComposableHook = (..._args) => undefined;
const IDENTITY_SECOND_ARGUMENT: ComposableHook = (...args) => args[1];
const VALID_CAST: ComposableHook = (..._args) => true;
const READY_CAST: ComposableHook = (..._args) => ({ ready: true });

const UI_CALLBACK_NAMES = Object.freeze([
  "eventLogRow",
  "isPaletteSkillInstant",
  "paletteSkillAvailability",
  "isPaletteSkillAvailable",
  "isSlotSkillSelectable",
  "paletteSkillUnavailableMessage",
  "paletteGroups",
  "resourceView",
  "resourceViews",
  "skillBarGroups",
  "targetHealthThresholds",
  "timelineWeaponLineTransition",
  "timelineSkillIcon",
  "updateSkillBarSelection",
  "weaponSkillMatchesSet",
]);

/**
 * Normalizes one hook or hook list into an order-stable array.
 */
function orderedHooks(
  value: unknown,
  hookName: string,
): OrderedHook[] {
  const entries = value == null ? [] : Array.isArray(value) ? value : [value];
  const hooks = entries
    .map((entry, index) => {
      if (typeof entry === "function") {
        return {
          id: `${hookName}:${index}`,
          order: 0,
          handler: entry as ComposableHook,
          index,
        };
      }
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new TypeError(`Invalid ${hookName} hook at index ${index}.`);
      }
      const candidate = entry as SchedulerRecord;
      if (typeof candidate.handler !== "function") {
        throw new TypeError(`Invalid ${hookName} hook at index ${index}.`);
      }
      return {
        id: String(candidate.id || `${hookName}:${index}`),
        order: Number(candidate.order || 0),
        handler: candidate.handler as ComposableHook,
        index,
      };
    })
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.index - right.index ||
        left.id.localeCompare(right.id),
    );
  const ids = new Set<string>();
  for (const hook of hooks) {
    if (ids.has(hook.id)) {
      throw new TypeError(`Duplicate ${hookName} hook id: ${hook.id}.`);
    }
    ids.add(hook.id);
  }
  return hooks;
}

/**
 * Reduces normalized hooks into one callable function with semantics tailored
 * to the hook family: validators must all pass, modifiers chain their return
 * values, and ordinary hooks simply run in order.
 */
function composeHooks(
  value: unknown,
  hookName: string,
  fallback: ComposableHook,
): ComposableHook {
  const hooks = orderedHooks(value, hookName);
  if (!hooks.length) return fallback;
  if (hookName === "availability") {
    return (context: SchedulerRecord, skill: Skill) => {
      let result: AvailabilityResult = { ready: true };
      for (const hook of hooks) {
        const next = hook.handler(context, skill);
        if (next == null || next === true) continue;
        const availability =
          next === false
            ? {
                ready: false,
                retryAt: null,
                code: `${hook.id}.unavailable`,
                reason: `${skill.name} is unavailable.`,
              }
            : next as AvailabilityResult;
        if (availability.ready !== false) continue;
        if (availability.retryAt == null)
          return {
            ready: false,
            retryAt: null,
            code: String(availability.code || `${hook.id}.unavailable`),
            reason: String(
              availability.reason || `${skill.name} is unavailable.`,
            ),
          };
        const retryAt = Number(availability.retryAt);
        if (!Number.isFinite(retryAt)) {
          throw new TypeError(
            `${hook.id} returned a non-finite cast retry time.`,
          );
        }
        if (result.ready || retryAt > Number(result.retryAt ?? -Infinity)) {
          result = {
            ready: false,
            retryAt,
            code: String(availability.code || `${hook.id}.not-ready`),
            reason: String(
              availability.reason ||
                `${skill.name} is not ready until ${retryAt.toFixed(3)}.`,
            ),
          };
        }
      }
      return result;
    };
  }
  if (hookName === "validateCast") {
    return (context: SchedulerRecord, skill: Skill) =>
      hooks.every((hook) => hook.handler(context, skill) !== false);
  }
  if (hookName === "scheduleSkill") {
    return (context: SchedulerRecord, skill: Skill) => {
      let handled = false;
      for (const hook of hooks) {
        if (hook.handler(context, skill) === true) handled = true;
      }
      return handled;
    };
  }
  if (hookName.startsWith("modify")) {
    return (context: SchedulerRecord, initialValue: unknown) =>
      hooks.reduce((chainedValue: unknown, hook) => {
        const next = hook.handler(context, chainedValue);
        return next === undefined ? chainedValue : next;
      }, initialValue);
  }
  return (context: SchedulerRecord, value: unknown) => {
    let result: unknown;
    for (const hook of hooks) {
      const next = hook.handler(context, value);
      if (next !== undefined) result = next;
    }
    return result;
  };
}

/**
 * Normalizes resolver event reactions into deterministic per-event dispatchers.
 */
export function createEventReactions(
  value: Readonly<Record<string, unknown>> | null | undefined,
): Readonly<Record<string, EventReaction>> {
  const reactions: Record<string, EventReaction> = {};
  for (const [eventType, handlers] of Object.entries(value || {})) {
    const hooks = orderedHooks(handlers, `eventReactions.${eventType}`);
    reactions[eventType] = (
      context: SchedulerRecord,
      event: SchedulerRecord,
      details: SchedulerRecord = {},
    ) => {
      let result: unknown;
      for (const hook of hooks) {
        const next = hook.handler(context, event, details);
        if (next !== undefined) result = next;
      }
      return result;
    };
  }
  return Object.freeze(reactions);
}

/**
 * Rejects malformed profession definitions before hook composition begins.
 */
function assertDefinition(definition: unknown): void {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A profession definition must be an object.");
  }
  const candidate = definition as SchedulerRecord;
  if (!/^[a-z][a-z0-9-]*$/.test(String(candidate.id || ""))) {
    throw new TypeError("Profession id must be a stable lowercase identifier.");
  }
  if (!String(candidate.name || "").trim()) {
    throw new TypeError("Profession name is required.");
  }
}

function assertOptionalCallback(
  container: object,
  name: string,
  scope: string,
): void {
  const candidate = container as SchedulerRecord;
  if (candidate[name] != null && typeof candidate[name] !== "function") {
    throw new TypeError(`${scope}.${name} must be a function.`);
  }
}

function assertCallbackContainer(
  container: object,
  names: readonly string[],
  scope: string,
): void {
  for (const name of names) assertOptionalCallback(container, name, scope);
}

function assertUiDefinition(ui: SchedulerRecord): void {
  assertCallbackContainer(ui, [...UI_CALLBACK_NAMES], "ui");
  if (
    ui.assumptionControls != null
    && !Array.isArray(ui.assumptionControls)
  ) {
    throw new TypeError("ui.assumptionControls must be an array.");
  }
  if (
    ui.slotLoadout != null
    && (typeof ui.slotLoadout !== "object" || Array.isArray(ui.slotLoadout))
  ) {
    throw new TypeError("ui.slotLoadout must be an object.");
  }
  if (
    ui.weaponSwapChangesSet != null
    && typeof ui.weaponSwapChangesSet !== "boolean"
  ) {
    throw new TypeError("ui.weaponSwapChangesSet must be a boolean.");
  }
}

function assertHandlerMap(
  value: unknown,
  scope: string,
): void {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${scope} must be an object.`);
  }
  for (const [name, handler] of Object.entries(value)) {
    if (typeof handler !== "function") {
      throw new TypeError(`${scope}.${name} must be a function.`);
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} professionId
 * @returns {PaletteSkillAvailability}
 */
function normalizePaletteAvailability(
  value: unknown,
  professionId: string,
): PaletteSkillAvailability {
  if (!value || typeof value !== "object") {
    throw new TypeError(
      `${professionId} paletteSkillAvailability must return an object.`,
    );
  }
  const result = value as SchedulerRecord;
  if (typeof result.available !== "boolean") {
    throw new TypeError(
      `${professionId} paletteSkillAvailability.available must be boolean.`,
    );
  }
  return {
    available: result.available,
    message: String(result.message || ""),
  };
}

function assertShallowUnchanged(
  value: SchedulerRecord,
  snapshot: SchedulerRecord,
  label: string,
): void {
  const keys = Object.keys(value);
  const priorKeys = Object.keys(snapshot);
  if (
    keys.length !== priorKeys.length
    || keys.some((key) => !Object.hasOwn(snapshot, key))
    || priorKeys.some((key) => value[key] !== snapshot[key])
  ) {
    throw new TypeError(
      `simulation.refineSchedulerConfig must not mutate prior ${label}.`,
    );
  }
}

function normalizeSimulation(
  simulation: SchedulerRecord | null | undefined,
): SchedulerRecord | null {
  if (simulation == null) return null;
  if (typeof simulation !== "object" || Array.isArray(simulation)) {
    throw new TypeError("simulation must be an object.");
  }
  assertOptionalCallback(
    simulation,
    "refineSchedulerConfig",
    "simulation",
  );
  assertOptionalCallback(
    simulation,
    "projectEndState",
    "simulation",
  );
  if (!simulation.refineSchedulerConfig) {
    return Object.freeze({ ...simulation });
  }
  const refine = simulation.refineSchedulerConfig as (
    config: SchedulerRecord,
    result: SchedulerRecord,
  ) => unknown;
  return Object.freeze({
    ...simulation,
    refineSchedulerConfig(
      config: SchedulerRecord,
      result: SchedulerRecord,
    ) {
      if (
        !config
        || typeof config !== "object"
        || !result
        || typeof result !== "object"
      ) {
        throw new TypeError(
          "simulation.refineSchedulerConfig requires config and result objects.",
        );
      }
      const configSnapshot = { ...config };
      const resultSnapshot = { ...result };
      const refined = refine(config, result);
      assertShallowUnchanged(config, configSnapshot, "config");
      assertShallowUnchanged(result, resultSnapshot, "result");
      if (refined == null) return null;
      if (typeof refined !== "object" || Array.isArray(refined)) {
        throw new TypeError(
          "simulation.refineSchedulerConfig must return an object or null.",
        );
      }
      if (refined === config) {
        throw new TypeError(
          "simulation.refineSchedulerConfig must return a new config object.",
        );
      }
      return refined as SchedulerRecord;
    },
  });
}

/**
 * Creates an immutable profession contract with stable defaults for every
 * optional capability. The returned object is what the engine depends on; raw
 * profession definition objects are intentionally not used directly elsewhere.
 */
/**
 * @template {object} TProfessionState
 * @param {ProfessionDefinition<TProfessionState>} definition
 * @returns {Readonly<NormalizedProfessionContract<TProfessionState>>}
 */
export function defineProfession<
  TProfessionState extends object,
>(
  definition: ProfessionDefinition<TProfessionState>,
): Readonly<NormalizedProfessionContract<TProfessionState>> {
  assertDefinition(definition);
  const build = definition.build || {};
  const resources = definition.resources || {};
  const attributeRules = definition.attributeRules || {};
  const castRules = definition.castRules || {};
  const schedulerHooks = definition.schedulerHooks || {};
  const resolverHooks = definition.resolverHooks || {};
  const ui = definition.ui || {};
  assertCallbackContainer(
    build,
    ["createBuildDefaults", "migrateBuild", "validateBuild"],
    "build",
  );
  assertCallbackContainer(
    resources,
    [
      "createProfessionState",
      "createResolverState",
      "projectEndState",
    ],
    "resources",
  );
  assertOptionalCallback(
    definition as unknown as SchedulerRecord,
    "createProfessionState",
    "definition",
  );
  assertOptionalCallback(
    definition as unknown as SchedulerRecord,
    "createResolverState",
    "definition",
  );
  assertUiDefinition(ui);
  assertHandlerMap(
    schedulerHooks.taskHandlers,
    "schedulerHooks.taskHandlers",
  );
  assertHandlerMap(
    resolverHooks.eventHandlers || definition.eventHandlers,
    "resolverHooks.eventHandlers",
  );
  const catalogSkillHandlers =
    definition.catalog?.skillHandlers instanceof Map
      ? definition.catalog.skillHandlers
      : new Map();
  const legacyResourceView = ui.resourceView || (() => null);
  const resourceViews =
    ui.resourceViews ||
    ((context: SchedulerRecord) => {
      const view = legacyResourceView(context);
      return view ? [view] : [];
    });
  const structuredPaletteAvailability = ui.paletteSkillAvailability;
  const paletteSkillAvailability = structuredPaletteAvailability
      ? (context: SchedulerRecord, skill: Skill) =>
        normalizePaletteAvailability(
        structuredPaletteAvailability(context, skill),
        definition.id,
      )
    : (context: SchedulerRecord, skill: Skill) => ({
        available:
          ui.isPaletteSkillAvailable?.(context, skill) !== false,
        message: String(
          ui.paletteSkillUnavailableMessage?.(context, skill) || "",
        ),
      });
  const normalizedUi: ProfessionUiContract = {
    ...ui,
    assumptionControls: Object.freeze([...(ui.assumptionControls || [])]),
    paletteGroups: ui.paletteGroups || (() => []),
    resourceView: (context: SchedulerRecord) =>
      resourceViews(context)[0] || null,
    resourceViews,
    isPaletteSkillInstant: ui.isPaletteSkillInstant || (() => false),
    paletteSkillAvailability,
    isPaletteSkillAvailable: (
      context: SchedulerRecord,
      skill: Skill,
    ) =>
      paletteSkillAvailability(context, skill).available,
    isSlotSkillSelectable: ui.isSlotSkillSelectable || (() => true),
    paletteSkillUnavailableMessage: (
      context: SchedulerRecord,
      skill: Skill,
    ) =>
      paletteSkillAvailability(context, skill).message,
    skillBarGroups: ui.skillBarGroups || (() => []),
    slotLoadout: ui.slotLoadout || null,
    targetHealthThresholds: ui.targetHealthThresholds || (() => []),
    timelineWeaponLineTransition:
      ui.timelineWeaponLineTransition || (() => undefined),
    timelineSkillIcon: ui.timelineSkillIcon || (() => ""),
    updateSkillBarSelection:
      ui.updateSkillBarSelection || (() => false),
    weaponSwapChangesSet: ui.weaponSwapChangesSet !== false,
  };
  const sources: SchedulerRecord = {
    initialize: schedulerHooks.initialize,
    availability: castRules.availability ?? schedulerHooks.availability,
    validateCast: castRules.validateCast ?? schedulerHooks.validateCast,
    scheduleSkill: castRules.scheduleSkill ?? schedulerHooks.scheduleSkill,
    afterCast: schedulerHooks.afterCast,
    advance: schedulerHooks.advance,
    snapshot: schedulerHooks.snapshot,
    projectEndState:
      resources.projectEndState ?? schedulerHooks.projectEndState,
    onCastStart: schedulerHooks.onCastStart,
    onCastComplete: schedulerHooks.onCastComplete,
    onCooldownReset: schedulerHooks.onCooldownReset,
    onEventScheduled: schedulerHooks.onEventScheduled,
    modifyCastDuration:
      castRules.modifyCastDuration ?? schedulerHooks.modifyCastDuration,
    modifyRechargeDuration:
      castRules.modifyRechargeDuration ?? schedulerHooks.modifyRechargeDuration,
    modifyRechargeStart:
      castRules.modifyRechargeStart ?? schedulerHooks.modifyRechargeStart,
    modifyMaximumAmmo:
      castRules.modifyMaximumAmmo ?? schedulerHooks.modifyMaximumAmmo,
    modifyAttributes: attributeRules.modifyAttributes,
    modifyCriticalChance: attributeRules.modifyCriticalChance,
    modifyCriticalDamage: attributeRules.modifyCriticalDamage,
    modifyStrikeDamage: attributeRules.modifyStrikeDamage,
    modifyConditionDamage: attributeRules.modifyConditionDamage,
    modifyConditionBaseDuration:
      attributeRules.modifyConditionBaseDuration,
    modifyConditionDuration: attributeRules.modifyConditionDuration,
  };
  const hooks: SchedulerRecord = {};
  for (const name of HOOK_NAMES) {
    const fallback =
      name === "availability"
        ? READY_CAST
        : name === "validateCast"
          ? VALID_CAST
          : name.startsWith("modify")
            ? IDENTITY_SECOND_ARGUMENT
            : NOOP;
    hooks[name] = composeHooks(sources[name], name, fallback);
  }

  const profession = {
    id: definition.id,
    name: definition.name,
    catalog: definition.catalog || {
      skills: [],
      traits: [],
      specializations: [],
    },
    skillHandlerFor: (skill: Skill) =>
      catalogSkillHandlers.get(String(skill?.handlerId || "")) || null,
    createBuildDefaults:
      build.createBuildDefaults ||
      (() => ({
        schemaVersion: 3,
        profession: definition.id,
      })),
    migrateBuild:
      build.migrateBuild || ((saved: SchedulerRecord) => saved),
    validateBuild: build.validateBuild || (() => ({ valid: true, errors: [] })),
    createProfessionState:
      resources.createProfessionState ||
      definition.createProfessionState ||
      (() => ({})),
    createResolverState:
      resources.createResolverState || definition.createResolverState || null,
    taskHandlers: Object.freeze({
      ...(schedulerHooks.taskHandlers || {}),
    }),
    ...hooks,
    eventHandlers: Object.freeze({
      ...(resolverHooks.eventHandlers || definition.eventHandlers || {}),
    }),
    eventReactions: createEventReactions(
      resolverHooks.eventReactions || definition.eventReactions,
    ),
    paletteGroups: normalizedUi.paletteGroups,
    resourceView: (context: SchedulerRecord) =>
      resourceViews(context)[0] || null,
    resourceViews,
    ui: Object.freeze(normalizedUi),
    simulation: normalizeSimulation(definition.simulation),
  };
  return Object.freeze(profession) as unknown as Readonly<
    NormalizedProfessionContract<TProfessionState>
  >;
}

const ATTRIBUTE_HOOK_NAMES = Object.freeze([
  "modifyAttributes",
  "modifyCriticalChance",
  "modifyCriticalDamage",
  "modifyStrikeDamage",
  "modifyConditionDamage",
  "modifyConditionBaseDuration",
  "modifyConditionDuration",
]);
const CAST_HOOK_NAMES = Object.freeze([
  "availability",
  "validateCast",
  "scheduleSkill",
  "modifyCastDuration",
  "modifyRechargeDuration",
  "modifyRechargeStart",
  "modifyMaximumAmmo",
]);
const SCHEDULER_HOOK_NAMES = Object.freeze([
  "initialize",
  "availability",
  "validateCast",
  "scheduleSkill",
  "afterCast",
  "advance",
  "snapshot",
  "projectEndState",
  "onCastStart",
  "onCastComplete",
  "onCooldownReset",
  "onEventScheduled",
  "modifyCastDuration",
  "modifyRechargeDuration",
  "modifyRechargeStart",
  "modifyMaximumAmmo",
]);
const UI_LIST_CALLBACK_NAMES = Object.freeze([
  "paletteGroups",
  "resourceViews",
  "skillBarGroups",
  "targetHealthThresholds",
]);
const UI_SINGLE_CALLBACK_NAMES = Object.freeze([
  "eventLogRow",
  "isPaletteSkillInstant",
  "isSlotSkillSelectable",
  "timelineWeaponLineTransition",
  "timelineSkillIcon",
  "updateSkillBarSelection",
  "weaponSkillMatchesSet",
]);

interface NamedModule<TProfessionState extends object> {
  readonly name: string;
  readonly module: ProfessionModuleDefinition<TProfessionState>;
}

function assertModuleDefinition(
  definition: unknown,
): void {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("A profession module must be an object.");
  }
  const candidate = definition as SchedulerRecord;
  if (!String(candidate.id || "").trim()) {
    throw new TypeError("Profession module id is required.");
  }
}

/**
 * Declares one independently composable profession mechanics fragment.
 */
export function defineProfessionModule<
  TProfessionState extends object = SchedulerRecord,
>(
  definition: ProfessionModuleDefinition<TProfessionState>,
): Readonly<ProfessionModuleDefinition<TProfessionState>> {
  assertModuleDefinition(definition);
  return Object.freeze({
    ...definition,
    catalog: definition.catalog
      ? Object.freeze({ ...definition.catalog })
      : undefined,
  });
}

function mergeUniqueEntries<T>(
  modules: readonly NamedModule<object>[],
  values: (module: ProfessionModuleDefinition<any>) => readonly T[],
  keyFor: (value: T) => string | number,
  label: string,
): T[] {
  const result: T[] = [];
  const owners = new Map<string | number, string>();
  for (const entry of modules) {
    for (const value of values(entry.module)) {
      const key = keyFor(value);
      const previous = owners.get(key);
      if (previous) {
        throw new TypeError(
          `Duplicate ${label} ${String(key)} in ${previous} and ${entry.name}.`,
        );
      }
      owners.set(key, entry.name);
      result.push(value);
    }
  }
  return result;
}

function handlerEntries(
  value: ProfessionModuleCatalogFragment["skillHandlers"],
): [string, unknown][] {
  return value instanceof Map
    ? [...value.entries()].map(([id, handler]) => [String(id), handler])
    : Object.entries(value || {});
}

function composeModuleCatalog(
  modules: readonly NamedModule<object>[],
): Readonly<CanonicalCatalog> {
  const skills = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.skills || [],
    (skill) => skill.id,
    "skill id",
  ) as Skill[];
  const traits = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.traits || [],
    (trait) => trait.id,
    "trait id",
  ) as CatalogEntity[];
  const specializations = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.specializations || [],
    (specialization) => specialization.id,
    "specialization id",
  ) as CatalogEntity[];
  const handlers = new Map<string, unknown>();
  const handlerOwners = new Map<string, string>();
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const additionalChains: SkillId[][] = [];
  const excludedSkillIds = new Set<SkillId>();

  for (const entry of modules) {
    const fragment = entry.module.catalog || {};
    for (const [id, handler] of handlerEntries(fragment.skillHandlers)) {
      const previous = handlerOwners.get(id);
      if (previous) {
        throw new TypeError(
          `Duplicate skill handler ${id} in ${previous} and ${entry.name}.`,
        );
      }
      handlerOwners.set(id, entry.name);
      handlers.set(id, handler);
    }
    for (const weapon of fragment.weapons || []) weapons.add(weapon);
    const hands = fragment.weaponHands instanceof Map
      ? fragment.weaponHands.entries()
      : Object.entries(fragment.weaponHands || {});
    for (const [weapon, hand] of hands) {
      if (weaponHands.has(weapon)) {
        throw new TypeError(
          `Duplicate weapon-hand entry ${weapon} in ${entry.name}.`,
        );
      }
      weaponHands.set(weapon, String(hand));
    }
    for (const chain of fragment.autoattackChains?.additional || []) {
      additionalChains.push([...chain]);
    }
    for (const skillId of fragment.autoattackChains?.excludeSkillIds || []) {
      excludedSkillIds.add(skillId);
    }
  }

  return createCanonicalCatalog({
    generated: skills,
    skillHandlers: handlers,
    traits,
    specializations,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: {
      additional: additionalChains,
      excludeSkillIds: [...excludedSkillIds],
    },
  });
}

function hookValues(
  modules: readonly NamedModule<object>[],
  container: keyof ProfessionModuleDefinition<any>,
  name: string,
): unknown[] {
  return modules.flatMap((entry) => {
    const source = entry.module[container] as SchedulerRecord | undefined;
    const value = source?.[name];
    return value == null ? [] : Array.isArray(value) ? value : [value];
  });
}

function composeHookContainer(
  modules: readonly NamedModule<object>[],
  container: keyof ProfessionModuleDefinition<any>,
  names: readonly string[],
): SchedulerRecord {
  return Object.fromEntries(
    names.flatMap((name) => {
      const values = hookValues(modules, container, name);
      return values.length ? [[name, values]] : [];
    }),
  );
}

function mergeHandlerRegistries(
  modules: readonly NamedModule<object>[],
  select: (module: ProfessionModuleDefinition<any>) =>
    | Readonly<Record<string, (...args: never[]) => unknown>>
    | null
    | undefined,
  label: string,
): Readonly<Record<string, (...args: never[]) => unknown>> {
  const result: Record<string, (...args: never[]) => unknown> = {};
  const owners = new Map<string, string>();
  for (const entry of modules) {
    for (const [id, handler] of Object.entries(select(entry.module) || {})) {
      const previous = owners.get(id);
      if (previous) {
        throw new TypeError(
          `Duplicate ${label} ${id} in ${previous} and ${entry.name}.`,
        );
      }
      owners.set(id, entry.name);
      result[id] = handler;
    }
  }
  return Object.freeze(result);
}

function composeEventReactions(
  modules: readonly NamedModule<object>[],
): Readonly<Record<string, unknown>> {
  const eventTypes = new Set<string>();
  for (const entry of modules) {
    for (const eventType of Object.keys(
      entry.module.resolverHooks?.eventReactions || {},
    )) {
      eventTypes.add(eventType);
    }
  }
  return Object.freeze(
    Object.fromEntries(
      [...eventTypes].map((eventType) => [
        eventType,
        modules.flatMap((entry) => {
          const value =
            entry.module.resolverHooks?.eventReactions?.[eventType];
          return value == null ? [] : Array.isArray(value) ? value : [value];
        }),
      ]),
    ),
  );
}

function createStateFragment(
  entry: NamedModule<object>,
  config: Readonly<SchedulerConfig>,
  resolver: boolean,
): SchedulerRecord {
  const resources = entry.module.resources;
  const factory = resolver
    ? resources?.createResolverState || resources?.createProfessionState
    : resources?.createProfessionState;
  const fragment = factory?.(config) || {};
  if (!fragment || typeof fragment !== "object" || Array.isArray(fragment)) {
    throw new TypeError(`${entry.name} state factory must return an object.`);
  }
  return fragment as SchedulerRecord;
}

function createComposedStateAdapter(
  core: SchedulerRecord,
  specializationKind: string,
  specializationState: SchedulerRecord,
): object {
  const specializationKeys = new Set(Reflect.ownKeys(specializationState));
  const target = {
    core,
    specialization: {
      kind: specializationKind,
      state: specializationState,
    },
  };
  return new Proxy(target, {
    get(current, property, receiver) {
      if (Reflect.has(current, property)) {
        return Reflect.get(current, property, receiver);
      }
      if (Reflect.has(specializationState, property)) {
        return Reflect.get(specializationState, property);
      }
      return Reflect.get(core, property);
    },
    set(_current, property, value) {
      const owner = specializationKeys.has(property)
        ? specializationState
        : core;
      return Reflect.set(owner, property, value);
    },
    deleteProperty(_current, property) {
      const owner = specializationKeys.has(property)
        ? specializationState
        : core;
      return Reflect.deleteProperty(owner, property);
    },
    has(current, property) {
      return Reflect.has(current, property) ||
        Reflect.has(specializationState, property) ||
        Reflect.has(core, property);
    },
    ownKeys(current) {
      return [...new Set<string | symbol>([
        ...Reflect.ownKeys(current),
        ...Reflect.ownKeys(core),
        ...Reflect.ownKeys(specializationState),
      ])];
    },
    getOwnPropertyDescriptor(current, property) {
      const direct = Reflect.getOwnPropertyDescriptor(current, property);
      if (direct) return direct;
      const descriptor =
        Reflect.getOwnPropertyDescriptor(specializationState, property) ||
        Reflect.getOwnPropertyDescriptor(core, property);
      return descriptor
        ? { ...descriptor, configurable: true, enumerable: false }
        : undefined;
    },
  });
}

function composeStateFragments(
  modules: readonly NamedModule<object>[],
  config: Readonly<SchedulerConfig>,
  resolver: boolean,
): object {
  const core = createStateFragment(modules[0], config, resolver);
  const specialization = modules[1];
  return createComposedStateAdapter(
    core,
    specialization?.name || "Core",
    specialization
      ? createStateFragment(specialization, config, resolver)
      : {},
  );
}

/**
 * Clones either ordinary profession state or the nested storage behind a
 * family-state compatibility adapter.
 */
export function cloneProfessionState(value: unknown): unknown {
  if (!value || typeof value !== "object") return structuredClone(value);
  const candidate = value as SchedulerRecord;
  const specialization = candidate.specialization as
    | { readonly kind?: unknown; readonly state?: unknown }
    | undefined;
  if (
    candidate.core &&
    typeof candidate.core === "object" &&
    specialization &&
    specialization.state &&
    typeof specialization.state === "object"
  ) {
    return {
      core: structuredClone(candidate.core),
      specialization: {
        kind: String(specialization.kind || "Core"),
        state: structuredClone(specialization.state),
      },
    };
  }
  return structuredClone(value);
}

/**
 * Produces an independent mutable state value while preserving the family
 * adapter used by direct resolver entry points.
 */
export function cloneMutableProfessionState(value: unknown): unknown {
  if (!value || typeof value !== "object") return structuredClone(value);
  const candidate = value as SchedulerRecord;
  const specialization = candidate.specialization as
    | { readonly kind?: unknown; readonly state?: unknown }
    | undefined;
  if (
    candidate.core &&
    typeof candidate.core === "object" &&
    specialization &&
    specialization.state &&
    typeof specialization.state === "object"
  ) {
    return createComposedStateAdapter(
      structuredClone(candidate.core) as SchedulerRecord,
      String(specialization.kind || "Core"),
      structuredClone(specialization.state) as SchedulerRecord,
    );
  }
  return structuredClone(value);
}

function singleOwnerValue(
  modules: readonly NamedModule<object>[],
  select: (module: ProfessionModuleDefinition<any>) => unknown,
  label: string,
): unknown {
  const owners = modules.filter((entry) => select(entry.module) != null);
  if (owners.length > 1) {
    throw new TypeError(
      `${label} has multiple owners: ${owners.map((entry) => entry.name).join(", ")}.`,
    );
  }
  return owners.length ? select(owners[0].module) : undefined;
}

function composeModuleUi(
  modules: readonly NamedModule<object>[],
): Partial<ProfessionUiContract> & SchedulerRecord {
  const ui: SchedulerRecord = {};
  ui.assumptionControls = Object.freeze(
    modules.flatMap((entry) => entry.module.ui?.assumptionControls || []),
  );
  for (const name of UI_LIST_CALLBACK_NAMES) {
    const callbacks = modules
      .map((entry) => entry.module.ui?.[name])
      .filter((value): value is (...args: unknown[]) => unknown[] =>
        typeof value === "function"
      );
    if (callbacks.length) {
      ui[name] = (...args: unknown[]) =>
        callbacks.flatMap((callback) => callback(...args) || []);
    }
  }
  const availabilityCallbacks = modules
    .map((entry) => entry.module.ui?.paletteSkillAvailability)
    .filter((value): value is (...args: unknown[]) => PaletteSkillAvailability =>
      typeof value === "function"
    );
  if (availabilityCallbacks.length) {
    ui.paletteSkillAvailability = (...args: unknown[]) => {
      for (const callback of availabilityCallbacks) {
        const result = callback(...args);
        if (result?.available === false) return result;
      }
      return { available: true, message: "" };
    };
  }
  for (const name of UI_SINGLE_CALLBACK_NAMES) {
    const callback = singleOwnerValue(
      modules,
      (module) => module.ui?.[name],
      `ui.${name}`,
    );
    if (callback != null) ui[name] = callback;
  }
  const slotLoadout = singleOwnerValue(
    modules,
    (module) => module.ui?.slotLoadout,
    "ui.slotLoadout",
  );
  if (slotLoadout != null) ui.slotLoadout = slotLoadout;
  const weaponSwapChangesSet = singleOwnerValue(
    modules,
    (module) => module.ui?.weaponSwapChangesSet,
    "ui.weaponSwapChangesSet",
  );
  if (weaponSwapChangesSet != null) {
    ui.weaponSwapChangesSet = weaponSwapChangesSet;
  }
  return ui;
}

/**
 * Composes ordinary attribute hooks plus optional declarative rule fragments.
 * The compiler is single-owner (normally Core) so GW2 damage buckets are
 * compiled once after Core and active-specialization declarations are merged.
 */
function composeModuleAttributeRules(
  modules: readonly NamedModule<object>[],
): SchedulerRecord {
  const result = composeHookContainer(
    modules,
    "attributeRules",
    ATTRIBUTE_HOOK_NAMES,
  );
  const declarations = modules.flatMap((entry) => {
    const value = entry.module.attributeRules?.modifierRules;
    if (value == null) return [];
    if (!Array.isArray(value)) {
      throw new TypeError(
        `${entry.name} attributeRules.modifierRules must be an array.`,
      );
    }
    return value;
  });
  const compiler = singleOwnerValue(
    modules,
    (module) => module.attributeRules?.compileModifierRules,
    "attributeRules.compileModifierRules",
  );
  if (!declarations.length) return result;
  if (typeof compiler !== "function") {
    throw new TypeError(
      "Attribute modifier-rule fragments require one compiler.",
    );
  }
  const compiled = compiler(declarations);
  if (!compiled || typeof compiled !== "object" || Array.isArray(compiled)) {
    throw new TypeError(
      "attributeRules.compileModifierRules must return a hook object.",
    );
  }
  for (const name of ATTRIBUTE_HOOK_NAMES) {
    const hook = (compiled as SchedulerRecord)[name];
    if (hook == null) continue;
    result[name] = [
      ...((result[name] as unknown[] | undefined) || []),
      hook,
    ];
  }
  return result;
}

function composeRuntimeDefinition<TProfessionState extends object>(
  definition: ProfessionFamilyDefinition<TProfessionState>,
  modules: readonly NamedModule<TProfessionState>[],
): ProfessionDefinition<TProfessionState> {
  const genericModules = modules as readonly NamedModule<object>[];
  const schedulerHooks = composeHookContainer(
    genericModules,
    "schedulerHooks",
    SCHEDULER_HOOK_NAMES,
  );
  schedulerHooks.taskHandlers = mergeHandlerRegistries(
    genericModules,
    (module) => module.schedulerHooks?.taskHandlers,
    "task handler",
  );
  const eventHandlers = mergeHandlerRegistries(
    genericModules,
    (module) => module.resolverHooks?.eventHandlers,
    "event handler",
  );
  const projectEndState = singleOwnerValue(
    genericModules,
    (module) => module.resources?.projectEndState,
    "resources.projectEndState",
  );
  return {
    id: definition.id,
    name: definition.name,
    catalog: composeModuleCatalog(genericModules),
    build: definition.build,
    resources: {
      createProfessionState: (config) =>
        composeStateFragments(genericModules, config, false) as TProfessionState,
      createResolverState: (config) =>
        composeStateFragments(genericModules, config, true),
      ...(projectEndState == null ? {} : { projectEndState }),
    },
    attributeRules: composeModuleAttributeRules(genericModules),
    castRules: composeHookContainer(
      genericModules,
      "castRules",
      CAST_HOOK_NAMES,
    ),
    schedulerHooks,
    resolverHooks: {
      eventHandlers,
      eventReactions: composeEventReactions(genericModules),
    },
    ui: composeModuleUi(genericModules),
    simulation: definition.simulation,
  };
}

/**
 * Creates a full application-facing profession catalog with a cached
 * core-plus-one-specialization simulation resolver.
 */
export function defineProfessionFamily<
  TProfessionState extends object = SchedulerRecord,
>(
  definition: ProfessionFamilyDefinition<TProfessionState>,
): Readonly<ProfessionFamilyContract<TProfessionState>> {
  assertDefinition(definition);
  assertModuleDefinition(definition.core);
  if (definition.core.id !== "Core") {
    throw new TypeError('The core profession module id must be "Core".');
  }
  if (
    !definition.specializations ||
    typeof definition.specializations !== "object" ||
    Array.isArray(definition.specializations)
  ) {
    throw new TypeError("Profession family specializations must be an object.");
  }
  const specializationModules = new Map<
    string,
    Readonly<ProfessionModuleDefinition<TProfessionState>>
  >();
  for (const [name, module] of Object.entries(definition.specializations)) {
    assertModuleDefinition(module);
    if (name !== module.id) {
      throw new TypeError(
        `Specialization key ${name} does not match module id ${module.id}.`,
      );
    }
    specializationModules.set(name, defineProfessionModule(module));
  }
  const core = defineProfessionModule(definition.core);
  const applicationSurface = defineProfession(definition);
  const cache = new Map<
    string,
    Readonly<NormalizedProfessionContract<TProfessionState>>
  >();
  const resolveRuntime = (
    config: Readonly<SchedulerConfig> = {},
  ): Readonly<NormalizedProfessionContract<TProfessionState>> => {
    const specialization =
      String(config.specialization || "Core").trim() || "Core";
    if (specialization !== "Core" && !specializationModules.has(specialization)) {
      throw new Error(
        `Unknown ${definition.name} elite specialization "${specialization}". ` +
          `Expected Core or one of: ${[...specializationModules.keys()].join(", ")}.`,
      );
    }
    const cached = cache.get(specialization);
    if (cached) return cached;
    const modules: NamedModule<TProfessionState>[] = [
      { name: "Core", module: core },
    ];
    const specializationModule = specializationModules.get(specialization);
    if (specializationModule) {
      modules.push({ name: specialization, module: specializationModule });
    }
    const runtime = defineProfession(
      composeRuntimeDefinition(definition, modules),
    );
    cache.set(specialization, runtime);
    return runtime;
  };
  return Object.freeze({
    ...applicationSurface,
    resolveRuntime,
  }) as Readonly<ProfessionFamilyContract<TProfessionState>>;
}

/**
 * Legacy contracts pass through unchanged. Family contracts resolve once for
 * the supplied configuration.
 */
export function resolveProfessionRuntime<
  TProfessionState extends object = SchedulerRecord,
>(
  profession: ProfessionSource<TProfessionState>,
  config: Readonly<SchedulerConfig> = {},
): Readonly<NormalizedProfessionContract<TProfessionState>> {
  if (!profession || typeof profession !== "object") {
    throw new TypeError("A profession contract is required.");
  }
  return typeof (profession as ProfessionFamilyContract<TProfessionState>)
    .resolveRuntime === "function"
    ? (profession as ProfessionFamilyContract<TProfessionState>)
      .resolveRuntime(config)
    : profession;
}

/**
 * Ordered list of supported hook names, mainly for documentation and tests.
 */
export const PROFESSION_HOOK_ORDER = HOOK_NAMES;
