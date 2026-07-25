/**
 * Profession contract composition. This module turns sparse profession
 * definitions into deterministic no-op-safe contracts so the neutral engine can
 * run different professions without special cases.
 */
const HOOK_NAMES = Object.freeze([
  "initialize",
  "validateCast",
  "scheduleSkill",
  "afterCast",
  "advance",
  "snapshot",
  "modifyCastDuration",
  "modifyRechargeDuration",
  "modifyMaximumAmmo",
  "modifyAttributes",
  "modifyCriticalChance",
  "modifyCriticalDamage",
  "modifyStrikeDamage",
  "modifyConditionDamage",
  "modifyConditionDuration",
]);

const NOOP = () => undefined;
const IDENTITY_SECOND_ARGUMENT = (_context, value) => value;
const VALID_CAST = () => true;

/**
 * Normalizes one hook or hook list into an order-stable array.
 */
function orderedHooks(value, hookName) {
  const entries = value == null
    ? []
    : Array.isArray(value)
      ? value
      : [value];
  return entries
    .map((entry, index) => {
      if (typeof entry === "function") {
        return { id: `${hookName}:${index}`, order: 0, handler: entry, index };
      }
      if (!entry || typeof entry.handler !== "function") {
        throw new TypeError(`Invalid ${hookName} hook at index ${index}.`);
      }
      return {
        id: String(entry.id || `${hookName}:${index}`),
        order: Number(entry.order || 0),
        handler: entry.handler,
        index,
      };
    })
    .sort((left, right) =>
      left.order - right.order
      || left.index - right.index
      || left.id.localeCompare(right.id));
}

/**
 * Reduces normalized hooks into one callable function with semantics tailored
 * to the hook family: validators must all pass, modifiers chain their return
 * values, and ordinary hooks simply run in order.
 */
function composeHooks(value, hookName, fallback) {
  const hooks = orderedHooks(value, hookName);
  if (!hooks.length) return fallback;
  if (hookName === "validateCast") {
    return (context, skill) =>
      hooks.every(hook => hook.handler(context, skill) !== false);
  }
  if (hookName === "scheduleSkill") {
    return (context, skill) => {
      let handled = false;
      for (const hook of hooks) {
        if (hook.handler(context, skill) === true) handled = true;
      }
      return handled;
    };
  }
  if (hookName.startsWith("modify")) {
    return (context, initialValue) =>
      hooks.reduce((value, hook) => {
        const next = hook.handler(context, value);
        return next === undefined ? value : next;
      }, initialValue);
  }
  return (context, value) => {
    let result;
    for (const hook of hooks) {
      const next = hook.handler(context, value);
      if (next !== undefined) result = next;
    }
    return result;
  };
}

/**
 * Flattens optional hook sources without forcing profession definitions to use
 * one specific container shape.
 */
function combineHookSources(...sources) {
  const combined = [];
  for (const source of sources) {
    if (source == null) continue;
    if (Array.isArray(source)) combined.push(...source);
    else combined.push(source);
  }
  return combined.length ? combined : undefined;
}

/**
 * Normalizes resolver event reactions into deterministic per-event dispatchers.
 */
export function createEventReactions(value) {
  const reactions = {};
  for (const [eventType, handlers] of Object.entries(value || {})) {
    const hooks = orderedHooks(handlers, `eventReactions.${eventType}`);
    reactions[eventType] = (context, event, details = {}) => {
      let result;
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
function assertDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A profession definition must be an object.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(String(definition.id || ""))) {
    throw new TypeError("Profession id must be a stable lowercase identifier.");
  }
  if (!String(definition.name || "").trim()) {
    throw new TypeError("Profession name is required.");
  }
}

/**
 * Creates an immutable profession contract with stable defaults for every
 * optional capability. The returned object is what the engine depends on; raw
 * profession definition objects are intentionally not used directly elsewhere.
 */
export function defineProfession(definition) {
  assertDefinition(definition);
  const build = definition.build || {};
  const resources = definition.resources || {};
  const attributeRules = definition.attributeRules || {};
  const castRules = definition.castRules || {};
  const schedulerHooks = definition.schedulerHooks || {};
  const resolverHooks = definition.resolverHooks || {};
  const ui = definition.ui || {};
  const catalogSkillHandlers =
    definition.catalog?.skillHandlers instanceof Map
      ? definition.catalog.skillHandlers
      : new Map();
  const dispatchCatalogSkill = catalogSkillHandlers.size
    ? (context, skill) => {
        const handler = catalogSkillHandlers.get(String(skill.handlerId || ""));
        return handler ? handler(context, skill) : undefined;
      }
    : null;
  const legacyResourceView = ui.resourceView || (() => null);
  const resourceViews = ui.resourceViews || (context => {
    const view = legacyResourceView(context);
    return view ? [view] : [];
  });
  const sources = {
    initialize: schedulerHooks.initialize,
    validateCast: castRules.validateCast ?? schedulerHooks.validateCast,
    scheduleSkill: combineHookSources(
      dispatchCatalogSkill,
      castRules.scheduleSkill ?? schedulerHooks.scheduleSkill,
    ),
    afterCast: schedulerHooks.afterCast,
    advance: schedulerHooks.advance,
    snapshot: schedulerHooks.snapshot,
    modifyCastDuration:
      castRules.modifyCastDuration
      ?? schedulerHooks.modifyCastDuration,
    modifyRechargeDuration:
      castRules.modifyRechargeDuration
      ?? schedulerHooks.modifyRechargeDuration,
    modifyMaximumAmmo:
      castRules.modifyMaximumAmmo
      ?? schedulerHooks.modifyMaximumAmmo,
    modifyAttributes: attributeRules.modifyAttributes,
    modifyCriticalChance: attributeRules.modifyCriticalChance,
    modifyCriticalDamage: attributeRules.modifyCriticalDamage,
    modifyStrikeDamage: attributeRules.modifyStrikeDamage,
    modifyConditionDamage: attributeRules.modifyConditionDamage,
    modifyConditionDuration: attributeRules.modifyConditionDuration,
  };
  const hooks = {};
  for (const name of HOOK_NAMES) {
    const fallback = name === "validateCast"
      ? VALID_CAST
      : name.startsWith("modify")
        ? IDENTITY_SECOND_ARGUMENT
        : NOOP;
    hooks[name] = composeHooks(sources[name], name, fallback);
  }

  const profession = {
    id: definition.id,
    name: definition.name,
    catalog: definition.catalog || { skills: [], traits: [], specializations: [] },
    createBuildDefaults: build.createBuildDefaults || (() => ({
      schemaVersion: 3,
      profession: definition.id,
    })),
    migrateBuild: build.migrateBuild || (saved => saved),
    validateBuild: build.validateBuild || (() => ({ valid: true, errors: [] })),
    createProfessionState:
      resources.createProfessionState
      || definition.createProfessionState
      || (() => ({})),
    createResolverState:
      resources.createResolverState
      || definition.createResolverState
      || null,
    ...hooks,
    eventHandlers: Object.freeze({
      ...(resolverHooks.eventHandlers || definition.eventHandlers || {}),
    }),
    eventReactions: createEventReactions(
      resolverHooks.eventReactions || definition.eventReactions,
    ),
    paletteGroups: ui.paletteGroups || (() => []),
    resourceView: context => resourceViews(context)[0] || null,
    resourceViews,
    ui: Object.freeze({
      ...ui,
      paletteGroups: ui.paletteGroups || (() => []),
      resourceView: context => resourceViews(context)[0] || null,
      resourceViews,
    }),
    simulation: definition.simulation || null,
  };
  return Object.freeze(profession);
}

/**
 * Ordered list of supported hook names, mainly for documentation and tests.
 */
export const PROFESSION_HOOK_ORDER = HOOK_NAMES;
