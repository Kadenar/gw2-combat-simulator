/**
 * Profession contract composition. This module turns sparse profession
 * definitions into deterministic no-op-safe contracts so the neutral engine can
 * run different professions without special cases.
 */
import type {
  AvailabilityResult,
  NormalizedProfessionContract,
  PaletteSkillAvailability,
  ProfessionDefinition,
  ProfessionUiContract,
  SchedulerRecord,
  Skill,
} from "./types.js";

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
  return entries
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

/**
 * Ordered list of supported hook names, mainly for documentation and tests.
 */
export const PROFESSION_HOOK_ORDER = HOOK_NAMES;
