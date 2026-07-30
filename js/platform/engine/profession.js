/**
 * Profession contract composition. This module turns sparse profession
 * definitions into deterministic no-op-safe contracts so the neutral engine can
 * run different professions without special cases.
 */
// @ts-check

/** @typedef {Record<string, any>} AnyRecord */

/**
 * Canonical profession event presenter output. `null` explicitly suppresses an
 * internal event; `undefined` leaves it unpresented so diagnostics can expose
 * missing adapters.
 *
 * @typedef {Object} ProfessionEventLogDescriptor
 * @property {string} type
 * @property {string} description
 * @property {string} [className]
 * @property {number} [order]
 * @property {string[]} [flags]
 */

/**
 * @typedef {Object} ProfessionResourceView
 * @property {string} id
 * @property {string} singular
 * @property {string} plural
 * @property {number} maximum
 * @property {number} value
 * @property {boolean} canStart
 * @property {string} shortLabel
 * @property {string} statusLabel
 * @property {number} [startMaximum]
 * @property {number} [startValue]
 * @property {string} [buildKey]
 * @property {number} [step]
 * @property {string} [displayMode]
 * @property {string} [pipStyle]
 * @property {number} [pipRows]
 */

/**
 * @typedef {Object} ProfessionPaletteGroup
 * @property {string} id
 * @property {string} label
 * @property {number[]} skillIds
 * @property {boolean} [resourceAnchor]
 * @property {string} [color]
 * @property {string} [stackId]
 * @property {string} [className]
 * @property {number[]} [reservedSkillIds]
 * @property {AnyRecord[]} [skillEntries]
 * @property {boolean} [includeActionSkills]
 */

/**
 * @typedef {Object} PaletteSkillAvailability
 * @property {boolean} available
 * @property {string} message
 */

/**
 * Complete UI extension surface consumed by the shared application.
 *
 * @typedef {Object} ProfessionUiContract
 * @property {readonly AnyRecord[]} assumptionControls
 * @property {(context: AnyRecord, event: AnyRecord) => ProfessionEventLogDescriptor|null|undefined} [eventLogRow]
 * @property {(context: AnyRecord, skill: AnyRecord) => boolean} isPaletteSkillInstant
 * @property {(context: AnyRecord, skill: AnyRecord) => PaletteSkillAvailability} paletteSkillAvailability
 * @property {(context: AnyRecord, skill: AnyRecord) => boolean} isPaletteSkillAvailable
 * @property {(context: AnyRecord, skill: AnyRecord) => boolean} isSlotSkillSelectable
 * @property {(context: AnyRecord, skill: AnyRecord) => string} paletteSkillUnavailableMessage
 * @property {(context: AnyRecord) => ProfessionPaletteGroup[]} paletteGroups
 * @property {(context: AnyRecord) => ProfessionResourceView|null} resourceView
 * @property {(context: AnyRecord) => ProfessionResourceView[]} resourceViews
 * @property {(context: AnyRecord) => AnyRecord[]} skillBarGroups
 * @property {AnyRecord|null} slotLoadout
 * @property {(context: AnyRecord) => number[]} targetHealthThresholds
 * @property {(context: AnyRecord) => string} timelineSkillIcon
 * @property {(context: AnyRecord, selection: AnyRecord) => boolean} updateSkillBarSelection
 * @property {(skill: AnyRecord, weapons: string[], context: AnyRecord) => boolean} [weaponSkillMatchesSet]
 * @property {boolean} weaponSwapChangesSet
 */

/**
 * Sparse input accepted by `defineProfession`.
 *
 * @typedef {Object} ProfessionDefinition
 * @property {string} id
 * @property {string} name
 * @property {AnyRecord} [catalog]
 * @property {AnyRecord} [build]
 * @property {AnyRecord} [resources]
 * @property {AnyRecord} [attributeRules]
 * @property {AnyRecord} [castRules]
 * @property {AnyRecord} [schedulerHooks]
 * @property {AnyRecord} [resolverHooks]
 * @property {Partial<ProfessionUiContract>&AnyRecord} [ui]
 * @property {AnyRecord|null} [simulation]
 * @property {Function} [createProfessionState]
 * @property {Function} [createResolverState]
 * @property {AnyRecord} [eventHandlers]
 * @property {AnyRecord} [eventReactions]
 */

/**
 * Immutable engine-facing result of profession composition.
 *
 * @typedef {Object} NormalizedProfessionContract
 * @property {string} id
 * @property {string} name
 * @property {AnyRecord} catalog
 * @property {ProfessionUiContract} ui
 * @property {AnyRecord|null} simulation
 * @property {(skill: AnyRecord) => AnyRecord|null} skillHandlerFor
 * @property {Function} createBuildDefaults
 * @property {Function} migrateBuild
 * @property {Function} validateBuild
 * @property {Function} createProfessionState
 * @property {Function|null} createResolverState
 * @property {AnyRecord} taskHandlers
 * @property {AnyRecord} eventHandlers
 * @property {AnyRecord} eventReactions
 * @property {(context: AnyRecord) => ProfessionPaletteGroup[]} paletteGroups
 * @property {(context: AnyRecord) => ProfessionResourceView|null} resourceView
 * @property {(context: AnyRecord) => ProfessionResourceView[]} resourceViews
 */
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

/** @type {Function} */
const NOOP = () => undefined;
/** @type {Function} */
const IDENTITY_SECOND_ARGUMENT = (
  /** @type {AnyRecord} */ _context,
  /** @type {any} */ value,
) => value;
/** @type {Function} */
const VALID_CAST = () => true;
/** @type {Function} */
const READY_CAST = () => ({ ready: true });

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
  "timelineSkillIcon",
  "updateSkillBarSelection",
  "weaponSkillMatchesSet",
]);

/**
 * Normalizes one hook or hook list into an order-stable array.
 */
function orderedHooks(
  /** @type {unknown} */ value,
  /** @type {string} */ hookName,
) {
  const entries = value == null ? [] : Array.isArray(value) ? value : [value];
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
  /** @type {unknown} */ value,
  /** @type {string} */ hookName,
  /** @type {Function} */ fallback,
) {
  const hooks = orderedHooks(value, hookName);
  if (!hooks.length) return fallback;
  if (hookName === "availability") {
    return (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ skill,
    ) => {
      /** @type {AnyRecord} */
      let result = { ready: true };
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
            : next;
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
        if (result.ready || retryAt > result.retryAt) {
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
    return (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ skill,
    ) =>
      hooks.every((hook) => hook.handler(context, skill) !== false);
  }
  if (hookName === "scheduleSkill") {
    return (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ skill,
    ) => {
      let handled = false;
      for (const hook of hooks) {
        if (hook.handler(context, skill) === true) handled = true;
      }
      return handled;
    };
  }
  if (hookName.startsWith("modify")) {
    return (
      /** @type {AnyRecord} */ context,
      /** @type {any} */ initialValue,
    ) =>
      hooks.reduce((/** @type {any} */ value, hook) => {
        const next = hook.handler(context, value);
        return next === undefined ? value : next;
      }, initialValue);
  }
  return (
    /** @type {AnyRecord} */ context,
    /** @type {any} */ value,
  ) => {
    let result;
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
  /** @type {AnyRecord|null|undefined} */ value,
) {
  /** @type {AnyRecord} */
  const reactions = {};
  for (const [eventType, handlers] of Object.entries(value || {})) {
    const hooks = orderedHooks(handlers, `eventReactions.${eventType}`);
    reactions[eventType] = (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ event,
      /** @type {AnyRecord} */ details = {},
    ) => {
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
function assertDefinition(/** @type {unknown} */ definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A profession definition must be an object.");
  }
  const candidate = /** @type {AnyRecord} */ (definition);
  if (!/^[a-z][a-z0-9-]*$/.test(String(candidate.id || ""))) {
    throw new TypeError("Profession id must be a stable lowercase identifier.");
  }
  if (!String(candidate.name || "").trim()) {
    throw new TypeError("Profession name is required.");
  }
}

function assertOptionalCallback(
  /** @type {AnyRecord} */ container,
  /** @type {string} */ name,
  /** @type {string} */ scope,
) {
  if (container[name] != null && typeof container[name] !== "function") {
    throw new TypeError(`${scope}.${name} must be a function.`);
  }
}

function assertCallbackContainer(
  /** @type {AnyRecord} */ container,
  /** @type {readonly string[]} */ names,
  /** @type {string} */ scope,
) {
  for (const name of names) assertOptionalCallback(container, name, scope);
}

function assertUiDefinition(/** @type {AnyRecord} */ ui) {
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
  /** @type {unknown} */ value,
  /** @type {string} */ scope,
) {
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

function normalizePaletteAvailability(
  /** @type {unknown} */ value,
  /** @type {string} */ professionId,
) {
  if (!value || typeof value !== "object") {
    throw new TypeError(
      `${professionId} paletteSkillAvailability must return an object.`,
    );
  }
  const result = /** @type {AnyRecord} */ (value);
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
  /** @type {AnyRecord} */ value,
  /** @type {AnyRecord} */ snapshot,
  /** @type {string} */ label,
) {
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
  /** @type {AnyRecord|null|undefined} */ simulation,
) {
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
  const refine = simulation.refineSchedulerConfig;
  return Object.freeze({
    ...simulation,
    refineSchedulerConfig(
      /** @type {AnyRecord} */ config,
      /** @type {AnyRecord} */ result,
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
      return refined;
    },
  });
}

/**
 * Creates an immutable profession contract with stable defaults for every
 * optional capability. The returned object is what the engine depends on; raw
 * profession definition objects are intentionally not used directly elsewhere.
 */
/**
 * @param {ProfessionDefinition} definition
 * @returns {Readonly<NormalizedProfessionContract>&AnyRecord}
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
    /** @type {AnyRecord} */ (definition),
    "createProfessionState",
    "definition",
  );
  assertOptionalCallback(
    /** @type {AnyRecord} */ (definition),
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
    ((/** @type {AnyRecord} */ context) => {
      const view = legacyResourceView(context);
      return view ? [view] : [];
    });
  const structuredPaletteAvailability = ui.paletteSkillAvailability;
  const paletteSkillAvailability = structuredPaletteAvailability
    ? (
        /** @type {AnyRecord} */ context,
        /** @type {AnyRecord} */ skill,
      ) => normalizePaletteAvailability(
        structuredPaletteAvailability(context, skill),
        definition.id,
      )
    : (
        /** @type {AnyRecord} */ context,
        /** @type {AnyRecord} */ skill,
      ) => ({
        available:
          ui.isPaletteSkillAvailable?.(context, skill) !== false,
        message: String(
          ui.paletteSkillUnavailableMessage?.(context, skill) || "",
        ),
      });
  /** @type {AnyRecord} */
  const normalizedUi = {
    ...ui,
    assumptionControls: Object.freeze([...(ui.assumptionControls || [])]),
    paletteGroups: ui.paletteGroups || (() => []),
    resourceView: (/** @type {AnyRecord} */ context) =>
      resourceViews(context)[0] || null,
    resourceViews,
    isPaletteSkillInstant: ui.isPaletteSkillInstant || (() => false),
    paletteSkillAvailability,
    isPaletteSkillAvailable: (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ skill,
    ) =>
      paletteSkillAvailability(context, skill).available,
    isSlotSkillSelectable: ui.isSlotSkillSelectable || (() => true),
    paletteSkillUnavailableMessage: (
      /** @type {AnyRecord} */ context,
      /** @type {AnyRecord} */ skill,
    ) =>
      paletteSkillAvailability(context, skill).message,
    skillBarGroups: ui.skillBarGroups || (() => []),
    slotLoadout: ui.slotLoadout || null,
    targetHealthThresholds: ui.targetHealthThresholds || (() => []),
    timelineSkillIcon: ui.timelineSkillIcon || (() => ""),
    updateSkillBarSelection:
      ui.updateSkillBarSelection || (() => false),
    weaponSwapChangesSet: ui.weaponSwapChangesSet !== false,
  };
  /** @type {AnyRecord} */
  const sources = {
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
  /** @type {AnyRecord} */
  const hooks = {};
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
    skillHandlerFor: (/** @type {AnyRecord} */ skill) =>
      catalogSkillHandlers.get(String(skill?.handlerId || "")) || null,
    createBuildDefaults:
      build.createBuildDefaults ||
      (() => ({
        schemaVersion: 3,
        profession: definition.id,
      })),
    migrateBuild:
      build.migrateBuild || ((/** @type {AnyRecord} */ saved) => saved),
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
    resourceView: (/** @type {AnyRecord} */ context) =>
      resourceViews(context)[0] || null,
    resourceViews,
    ui: Object.freeze(normalizedUi),
    simulation: normalizeSimulation(definition.simulation),
  };
  return /** @type {Readonly<NormalizedProfessionContract>&AnyRecord} */ (
    Object.freeze(profession)
  );
}

/**
 * Ordered list of supported hook names, mainly for documentation and tests.
 */
export const PROFESSION_HOOK_ORDER = HOOK_NAMES;
