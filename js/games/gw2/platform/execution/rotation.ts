/**
 * Rotation normalization keeps downloaded legacy rotations and shorthand inputs at
 * the boundary while the runtime and application use canonical commands.
 */
import type { CatalogLookup, SkillId } from '#gw2/platform/skills/types.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/external-skill-ids.js';

/** Canonical rotation commands: saved builds, the application, and the runtime driver share this one schema. */

export interface CastCommand {
  readonly type: 'cast';
  readonly skillId: SkillId;
  /** Casts normally but prevents this activation's hostile packets from reaching the target. */
  readonly offTarget?: boolean;
  /** Casts normally but lands this activation's hostile packets later, as when a precast travels from range. */
  readonly impactDelayMs?: number;
  readonly concurrentOffsetMs?: number;
  readonly interruptAfterMs?: number;
  /** Exact remaining duration carried by a hidden combat-log initial-state action. */
  readonly initialStateDurationMs?: number;
  readonly releaseAtCharges?: number;
  /** Extra hold after the selected Dragon Charge threshold; holding spends no additional Flow. */
  readonly releaseDelayMs?: number;
  readonly doubleEdgeOutcome?: 'success' | 'backfire';
}

/** Detached release intent contains only the facts a charging mechanic needs to decide whether to hold. */
export interface ChargeReleaseIntent {
  readonly skillId: SkillId;
  readonly charges?: number;
}

export interface WaitCommand {
  readonly type: 'wait';
  readonly durationMs: number;
}

interface CombatStartCommand {
  readonly type: 'combat-start';
  readonly concurrentOffsetMs?: number;
}

export interface CooldownResetCommand {
  readonly type: 'cooldown-reset';
}

export type RotationCommand = CastCommand | WaitCommand | CombatStartCommand | CooldownResetCommand;

const MILLISECOND_FIELDS = Object.entries({
  concurrentOffsetMs: 'Concurrent offset',
  interruptAfterMs: 'Interrupt duration',
  initialStateDurationMs: 'Initial-state duration',
  impactDelayMs: 'Impact delay',
  releaseDelayMs: 'Release delay'
});
const CAST_FIELDS = [
  'interruptAfterMs',
  'initialStateDurationMs',
  'releaseAtCharges',
  'doubleEdgeOutcome',
  'impactDelayMs',
  'offTarget'
];

/** Validate decoded command intent before normalization discards zero values or irrelevant payloads. */
export function validateRotationCommand(
  command: unknown,
  catalog: CatalogLookup | null = null,
  { requireKnownSkill = false }: { readonly requireKnownSkill?: boolean } = {}
): string[] {
  if (!command || typeof command !== 'object' || Array.isArray(command))
    return ['rotation contains an invalid canonical command.'];
  const candidate = command as Record<string, unknown>;
  if (
    typeof candidate.type !== 'string' ||
    !['cast', 'wait', 'combat-start', 'cooldown-reset'].includes(candidate.type)
  )
    return ['rotation contains an invalid canonical command.'];

  const errors: string[] = [];
  for (const [field, label] of MILLISECOND_FIELDS) {
    if (candidate[field] == null) continue;
    const value = Number(candidate[field]);
    const signed = field === 'concurrentOffsetMs' && candidate.type === 'combat-start';
    if (!Number.isFinite(value) || (!signed && value < 0))
      errors.push(`${label} must be ${signed ? 'a finite' : 'a non-negative'} number.`);
  }

  if (
    candidate.releaseAtCharges != null &&
    (!Number.isInteger(Number(candidate.releaseAtCharges)) || Number(candidate.releaseAtCharges) < 1)
  )
    errors.push('releaseAtCharges must be a positive whole number.');
  if (
    candidate.doubleEdgeOutcome != null &&
    candidate.doubleEdgeOutcome !== 'success' &&
    candidate.doubleEdgeOutcome !== 'backfire'
  )
    errors.push('Double Edge outcome must be either success or backfire.');
  if (candidate.offTarget != null && typeof candidate.offTarget !== 'boolean')
    errors.push('Off-target cast must be a boolean.');

  if (candidate.type !== 'cast') {
    for (const field of CAST_FIELDS)
      if (candidate[field] != null) errors.push(`only cast commands may contain ${field}.`);
  }

  // Even a zero hold must belong to Dragon Slash before normalization can omit it.
  if (
    candidate.releaseDelayMs != null &&
    (candidate.type !== 'cast' || !catalog?.skillsById?.get(candidate.skillId as SkillId)?.dragonSlash)
  )
    errors.push('only Dragon Slash casts may contain releaseDelayMs.');

  if (candidate.offTarget === true && Number(candidate.impactDelayMs) > 0)
    errors.push('off-target casts cannot contain impactDelayMs.');

  if (candidate.type === 'wait') {
    if (
      candidate.durationMs == null ||
      !Number.isFinite(Number(candidate.durationMs)) ||
      Number(candidate.durationMs) < 0
    )
      errors.push('wait commands require a non-negative durationMs.');
    if (candidate.concurrentOffsetMs != null) errors.push('wait commands cannot contain concurrentOffsetMs.');
  }

  if (candidate.type === 'cast') {
    const id = candidate.skillId;
    if (id == null || id === '') errors.push('Cast command requires skillId.');
    else if (typeof id !== 'number' && typeof id !== 'string')
      errors.push('Cast command skillId must be a string or number.');
    // Saved builds require catalog membership; live execution resolves transformed skills at each command boundary.
    else if (requireKnownSkill && !catalog?.skillsById?.has(id)) errors.push(`rotation contains unknown skill ${id}.`);
  }

  return errors;
}

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
