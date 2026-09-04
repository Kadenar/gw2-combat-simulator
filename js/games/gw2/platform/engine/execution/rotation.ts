/**
 * Rotation normalization utilities keep legacy files and shorthand inputs at
 * the boundary while the scheduler and application use canonical commands.
 */
import type { CatalogLookup } from '#gw2/platform/engine/skills/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/aliases.js';

function finiteMilliseconds(
  value: unknown,
  field: string,
  { allowNegative = false }: { readonly allowNegative?: boolean } = {}
): number {
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowNegative && number < 0)) {
    throw new TypeError(`${field} must be ${allowNegative ? 'a finite' : 'a non-negative'} number.`);
  }

  return number;
}

function positiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new TypeError(`${field} must be a positive whole number.`);
  }

  return number;
}

/**
 * Converts one rotation entry into the canonical scheduler command shape.
 */
export function normalizeRotationCommand(entry: unknown, catalog: CatalogLookup | null = null): RotationCommand {
  if (typeof entry === 'number') return { type: 'cast', skillId: canonicalGw2SkillId(entry) };
  if (typeof entry === 'string') {
    if (entry === '__combat_start') return { type: 'combat-start' };
    if (entry === '__cooldown_reset') return { type: 'cooldown-reset' };
    if (entry === '__wait') return { type: 'wait', durationMs: 0 };
    const skill = catalog?.skillsByName?.get(entry);
    return skill ? { type: 'cast', skillId: canonicalGw2SkillId(skill.id) } : { type: 'cast', skillId: entry };
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError('Rotation command must be a skill, wait, cooldown-reset, ' + 'or combat-start entry.');
  }

  const candidate = entry as Record<string, unknown>;

  if (candidate.type === 'cooldown-reset' || candidate.name === '__cooldown_reset') {
    return { type: 'cooldown-reset' };
  }

  if (candidate.type === 'combat-start' || candidate.name === '__combat_start') {
    const concurrent = candidate.concurrentOffsetMs ?? candidate.offset;
    return concurrent == null
      ? { type: 'combat-start' }
      : {
          type: 'combat-start',
          concurrentOffsetMs: finiteMilliseconds(concurrent, 'Concurrent offset', { allowNegative: true })
        };
  }

  if (candidate.type === 'wait' || candidate.name === '__wait') {
    return {
      type: 'wait',
      durationMs: finiteMilliseconds(candidate.durationMs ?? candidate.waitMs ?? 0, 'Wait duration')
    };
  }

  const skillId =
    candidate.skillId ??
    candidate.id ??
    (typeof candidate.name === 'string' ? catalog?.skillsByName?.get(candidate.name)?.id : undefined) ??
    candidate.name;
  if (skillId === undefined || skillId === null || skillId === '') {
    throw new TypeError('Cast command requires skillId.');
  }

  if (typeof skillId !== 'number' && typeof skillId !== 'string') {
    throw new TypeError('Cast command skillId must be a string or number.');
  }

  const concurrent = candidate.concurrentOffsetMs ?? candidate.offset;
  const interrupt = candidate.interruptAfterMs ?? candidate.interruptMs;
  const initialStateDuration = candidate.initialStateDurationMs;
  const releaseAtCharges = candidate.releaseAtCharges;
  const doubleEdgeOutcome = candidate.doubleEdgeOutcome;
  const offTarget = candidate.offTarget;
  if (doubleEdgeOutcome != null && doubleEdgeOutcome !== 'success' && doubleEdgeOutcome !== 'backfire') {
    throw new TypeError('Double Edge outcome must be either success or backfire.');
  }

  if (offTarget != null && typeof offTarget !== 'boolean') {
    throw new TypeError('Off-target cast must be a boolean.');
  }

  return {
    type: 'cast',
    skillId: canonicalGw2SkillId(skillId),
    ...(offTarget === true ? { offTarget: true } : {}),
    ...(concurrent == null
      ? {}
      : {
          concurrentOffsetMs: finiteMilliseconds(concurrent, 'Concurrent offset')
        }),
    ...(interrupt == null
      ? {}
      : {
          interruptAfterMs: finiteMilliseconds(interrupt, 'Interrupt duration')
        }),
    ...(initialStateDuration == null
      ? {}
      : {
          initialStateDurationMs: finiteMilliseconds(initialStateDuration, 'Initial-state duration')
        }),
    ...(releaseAtCharges == null
      ? {}
      : {
          releaseAtCharges: positiveInteger(releaseAtCharges, 'Release-at charge count')
        }),
    ...(doubleEdgeOutcome == null ? {} : { doubleEdgeOutcome })
  };
}

/**
 * Normalizes an entire rotation, optionally dropping malformed entries when the
 * caller is doing best-effort migration instead of strict scheduling.
 */
export function normalizeRotation(
  rotation: unknown,
  catalog: CatalogLookup | null = null,
  { strict = false }: { readonly strict?: boolean } = {}
): RotationCommand[] {
  if (!Array.isArray(rotation)) {
    if (strict) throw new TypeError('Rotation must be an array.');
    return [];
  }

  const commands: RotationCommand[] = [];
  for (const entry of rotation) {
    try {
      commands.push(normalizeRotationCommand(entry, catalog));
    } catch (error) {
      if (strict) throw error;
    }
  }

  return commands;
}
