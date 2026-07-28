/**
 * Shared skill-handler strategy contract.
 *
 * Declarative effects remain scheduler-owned for augmenting handlers. Replacing
 * handlers explicitly own the complete emitted profile and therefore require an
 * empty declarative effect list. A mode resolver supports the small number of
 * skills whose profile changes at runtime.
 */

export const SKILL_HANDLER_MODES = Object.freeze({
  AUGMENT: "augment",
  REPLACE: "replace",
});

const VALID_MODES = new Set(Object.values(SKILL_HANDLER_MODES));
const HANDLER_PHASES = Object.freeze([
  "beforeEffects",
  "afterEffect",
  "afterEffects",
]);
const HANDLER_FIELDS = new Set([
  "mode",
  "resolveMode",
  ...HANDLER_PHASES,
]);

function assertFields(value, handlerId) {
  const unknownFields = Object.keys(value)
    .filter(field => !HANDLER_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Skill handler ${handlerId} has unsupported field`
      + `${unknownFields.length === 1 ? "" : "s"}: `
      + unknownFields.join(", "),
    );
  }
}

function assertMode(mode, handlerId) {
  if (!VALID_MODES.has(mode)) {
    throw new TypeError(
      `Skill handler ${handlerId} has invalid mode "${String(mode)}".`,
    );
  }
  return mode;
}

/**
 * Creates one immutable handler strategy.
 */
export function skillHandler(options = {}) {
  assertFields(options, "<unregistered>");
  const {
    mode,
    resolveMode = null,
    beforeEffects = null,
    afterEffect = null,
    afterEffects = null,
  } = options;
  assertMode(mode, "<unregistered>");
  if (resolveMode != null && typeof resolveMode !== "function") {
    throw new TypeError("Skill handler resolveMode must be a function.");
  }
  const strategy = { mode };
  if (resolveMode) strategy.resolveMode = resolveMode;
  for (const phase of HANDLER_PHASES) {
    const handler = { beforeEffects, afterEffect, afterEffects }[phase];
    if (handler == null) continue;
    if (typeof handler !== "function") {
      throw new TypeError(`Skill handler ${phase} must be a function.`);
    }
    strategy[phase] = handler;
  }
  return Object.freeze(strategy);
}

export function augmentSkillHandler(beforeEffects, options = {}) {
  return skillHandler({
    ...options,
    mode: SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects,
  });
}

export function replaceSkillHandler(beforeEffects, options = {}) {
  return skillHandler({
    ...options,
    mode: SKILL_HANDLER_MODES.REPLACE,
    beforeEffects,
  });
}

/**
 * Validates a registered strategy while retaining its callable phases.
 */
export function normalizeSkillHandler(handlerId, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(
      `Skill handler ${handlerId} must be an explicit strategy object.`,
    );
  }
  assertFields(value, handlerId);
  const mode = assertMode(value.mode, handlerId);
  if (
    value.resolveMode != null
    && typeof value.resolveMode !== "function"
  ) {
    throw new TypeError(
      `Skill handler ${handlerId} resolveMode must be a function.`,
    );
  }
  const normalized = { mode };
  if (value.resolveMode) normalized.resolveMode = value.resolveMode;
  for (const phase of HANDLER_PHASES) {
    if (value[phase] == null) continue;
    if (typeof value[phase] !== "function") {
      throw new TypeError(
        `Skill handler ${handlerId} ${phase} must be a function.`,
      );
    }
    normalized[phase] = value[phase];
  }
  return Object.freeze(normalized);
}

export function resolveSkillHandlerMode(
  strategy,
  context,
  skill,
) {
  if (!strategy) return SKILL_HANDLER_MODES.AUGMENT;
  const selected = strategy.resolveMode
    ? strategy.resolveMode(context, skill)
    : strategy.mode;
  return assertMode(selected, skill?.handlerId || "<unregistered>");
}
