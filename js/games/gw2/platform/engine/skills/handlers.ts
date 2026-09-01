/**
 * Skill-handler strategy contract. Defines the augment/replace modes and cast
 * lifecycle phases a handler may own, with builders, validation, and
 * normalization. Augmenting handlers keep declarative effects scheduler-owned;
 * replacing handlers own the entire emitted profile and require no declarative
 * effects; a mode resolver supports skills whose profile changes at runtime.
 */
import type {
  SchedulerRecord,
  Skill,
  SkillHandlerMode,
  SkillHandlerPhase,
  SkillHandlerStrategy
} from '#gw2/platform/engine/types.js';

type SkillHandlerOptions<TContext extends object> = Omit<
  Partial<SkillHandlerStrategy<TContext>>,
  'mode' | 'beforeEffects'
> & {
  readonly mode?: unknown;
  readonly beforeEffects?: SkillHandlerPhase<TContext> | null;
};

/**
 * Shared skill-handler strategy contract.
 *
 * Declarative effects remain scheduler-owned for augmenting handlers. Replacing
 * handlers explicitly own the complete emitted profile and therefore require an
 * empty declarative effect list. A mode resolver supports the small number of
 * skills whose profile changes at runtime.
 */

export const SKILL_HANDLER_MODES = Object.freeze({
  AUGMENT: 'augment',
  REPLACE: 'replace'
} as const);

const VALID_MODES: ReadonlySet<string> = new Set(Object.values(SKILL_HANDLER_MODES));
const HANDLER_PHASES = Object.freeze(['beforeEffects', 'afterEffect', 'afterEffects'] as const);
const HANDLER_FIELDS = new Set(['mode', 'resolveMode', ...HANDLER_PHASES]);

function assertFields(value: object, handlerId: string): void {
  const unknownFields = Object.keys(value).filter((field) => !HANDLER_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Skill handler ${handlerId} has unsupported field` +
        `${unknownFields.length === 1 ? '' : 's'}: ` +
        unknownFields.join(', ')
    );
  }
}

function assertMode(mode: unknown, handlerId: string): SkillHandlerMode {
  if (typeof mode !== 'string' || !VALID_MODES.has(mode)) {
    throw new TypeError(`Skill handler ${handlerId} has invalid mode "${String(mode)}".`);
  }

  return mode as SkillHandlerMode;
}

/**
 * Creates one immutable handler strategy.
 */
export function skillHandler<TContext extends object = SchedulerRecord>(
  options: SkillHandlerOptions<TContext> = {}
): Readonly<SkillHandlerStrategy<TContext>> {
  assertFields(options, '<unregistered>');
  const { mode, resolveMode = null, beforeEffects = null, afterEffect = null, afterEffects = null } = options;
  assertMode(mode, '<unregistered>');
  if (resolveMode != null && typeof resolveMode !== 'function') {
    throw new TypeError('Skill handler resolveMode must be a function.');
  }

  for (const phase of HANDLER_PHASES) {
    const handler = { beforeEffects, afterEffect, afterEffects }[phase];
    if (handler == null) continue;
    if (typeof handler !== 'function') {
      throw new TypeError(`Skill handler ${phase} must be a function.`);
    }
  }

  const strategy: SkillHandlerStrategy<TContext> = {
    mode: assertMode(mode, '<unregistered>'),
    ...(resolveMode ? { resolveMode } : {}),
    ...(beforeEffects ? { beforeEffects } : {}),
    ...(afterEffect ? { afterEffect } : {}),
    ...(afterEffects ? { afterEffects } : {})
  };
  return Object.freeze(strategy);
}

export function augmentSkillHandler<TContext extends object = SchedulerRecord>(
  beforeEffects: SkillHandlerPhase<TContext> | null,
  options: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode' | 'beforeEffects'> = {}
): Readonly<SkillHandlerStrategy<TContext>> {
  return skillHandler({
    ...options,
    mode: SKILL_HANDLER_MODES.AUGMENT,
    beforeEffects
  });
}

export function replaceSkillHandler<TContext extends object = SchedulerRecord>(
  beforeEffects: SkillHandlerPhase<TContext> | null,
  options: Omit<Partial<SkillHandlerStrategy<TContext>>, 'mode' | 'beforeEffects'> = {}
): Readonly<SkillHandlerStrategy<TContext>> {
  return skillHandler({
    ...options,
    mode: SKILL_HANDLER_MODES.REPLACE,
    beforeEffects
  });
}

/**
 * Validates a registered strategy while retaining its callable phases.
 */
export function normalizeSkillHandler<TContext extends object = SchedulerRecord>(
  handlerId: string,
  value: unknown
): Readonly<SkillHandlerStrategy<TContext>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Skill handler ${handlerId} must be an explicit strategy object.`);
  }

  assertFields(value, handlerId);
  const candidate = value as Partial<SkillHandlerStrategy<TContext>> & SchedulerRecord;
  const mode = assertMode(candidate.mode, handlerId);
  if (candidate.resolveMode != null && typeof candidate.resolveMode !== 'function') {
    throw new TypeError(`Skill handler ${handlerId} resolveMode must be a function.`);
  }

  for (const phase of HANDLER_PHASES) {
    if (candidate[phase] == null) continue;
    if (typeof candidate[phase] !== 'function') {
      throw new TypeError(`Skill handler ${handlerId} ${phase} must be a function.`);
    }
  }

  const strategy: SkillHandlerStrategy<TContext> = {
    mode,
    ...(candidate.resolveMode ? { resolveMode: candidate.resolveMode } : {}),
    ...(candidate.beforeEffects ? { beforeEffects: candidate.beforeEffects } : {}),
    ...(candidate.afterEffect ? { afterEffect: candidate.afterEffect } : {}),
    ...(candidate.afterEffects ? { afterEffects: candidate.afterEffects } : {})
  };
  return Object.freeze(strategy);
}

export function resolveSkillHandlerMode<TContext extends object = SchedulerRecord>(
  strategy: SkillHandlerStrategy<TContext> | null | undefined,
  context: TContext,
  skill: Skill
): SkillHandlerMode {
  if (!strategy) return SKILL_HANDLER_MODES.AUGMENT;
  const selected = strategy.resolveMode ? strategy.resolveMode(context, skill) : strategy.mode;
  return assertMode(selected, skill?.handlerId || '<unregistered>');
}
