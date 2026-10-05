/**
 * Rotation normalization keeps downloaded legacy rotations and shorthand inputs at
 * the boundary while the runtime and application use canonical commands.
 */
import type { CatalogLookup, SkillId } from '#gw2/platform/skills/types.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/external-skill-ids.js';
import { validateRotationCommand } from '#gw2/platform/execution/rotation-validation.js';

/** Decode existing shorthand without dropping fields that the canonical validator must inspect. */
function decodeRotationCommand(entry: unknown, catalog: CatalogLookup | null): unknown {
  if (typeof entry === 'number') return { type: 'cast', skillId: canonicalGw2SkillId(entry) };
  if (typeof entry === 'string') return decodeRotationCommand({ name: entry }, catalog);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;

  const candidate = entry as Record<string, unknown>;
  const type =
    candidate.type ??
    (candidate.name === '__cooldown_reset'
      ? 'cooldown-reset'
      : candidate.name === '__combat_start'
        ? 'combat-start'
        : candidate.name === '__wait'
          ? 'wait'
          : 'cast');
  const skillId =
    candidate.skillId ??
    candidate.id ??
    (typeof candidate.name === 'string' ? catalog?.skillsByName?.get(candidate.name)?.id : undefined) ??
    candidate.name;
  return {
    ...candidate,
    type,
    ...(type === 'cast' ? { skillId: typeof skillId === 'number' ? canonicalGw2SkillId(skillId) : skillId } : {}),
    concurrentOffsetMs: candidate.concurrentOffsetMs ?? candidate.offset,
    interruptAfterMs: candidate.interruptAfterMs ?? candidate.interruptMs,
    ...(type === 'wait'
      ? { durationMs: candidate.durationMs ?? candidate.waitMs ?? (candidate.type == null ? 0 : undefined) }
      : {})
  };
}

/** Shared validation precedes numeric conversion and removal of redundant optional fields. */
function normalizeRotationCommand(entry: unknown, catalog: CatalogLookup | null): RotationCommand {
  const decoded = decodeRotationCommand(entry, catalog);
  const errors = validateRotationCommand(decoded, catalog);
  if (errors.length) throw new TypeError(errors[0]);
  const candidate = decoded as Record<string, unknown>;
  if (candidate.type === 'cooldown-reset') return { type: 'cooldown-reset' };
  if (candidate.type === 'combat-start')
    return {
      type: 'combat-start',
      ...(candidate.concurrentOffsetMs == null ? {} : { concurrentOffsetMs: Number(candidate.concurrentOffsetMs) })
    };
  if (candidate.type === 'wait') return { type: 'wait', durationMs: Number(candidate.durationMs) };

  return {
    type: 'cast',
    skillId: candidate.skillId as SkillId,
    ...(candidate.offTarget === true ? { offTarget: true } : {}),
    ...(Number(candidate.impactDelayMs) > 0 ? { impactDelayMs: Number(candidate.impactDelayMs) } : {}),
    ...(candidate.concurrentOffsetMs == null ? {} : { concurrentOffsetMs: Number(candidate.concurrentOffsetMs) }),
    ...(candidate.interruptAfterMs == null ? {} : { interruptAfterMs: Number(candidate.interruptAfterMs) }),
    ...(candidate.initialStateDurationMs == null
      ? {}
      : { initialStateDurationMs: Number(candidate.initialStateDurationMs) }),
    ...(candidate.releaseAtCharges == null ? {} : { releaseAtCharges: Number(candidate.releaseAtCharges) }),
    ...(candidate.doubleEdgeOutcome == null
      ? {}
      : { doubleEdgeOutcome: candidate.doubleEdgeOutcome as 'success' | 'backfire' }),
    ...(Number(candidate.releaseDelayMs) > 0 ? { releaseDelayMs: Number(candidate.releaseDelayMs) } : {})
  };
}

/** Normalize rotations, dropping malformed entries only during best-effort migration. */
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
