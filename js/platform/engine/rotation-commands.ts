// Rotation normalization utilities. They keep the scheduler focused on one
// canonical command format while the app layer and importers continue to feed
// legacy names and convenience shorthands.
import type { CatalogLookup, LegacyRotationEntry, RotationCommand } from './types.js';

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
 *
 * @param {unknown} entry
 * @param {CatalogLookup|null} [catalog]
 * @returns {RotationCommand}
 */
export function normalizeRotationCommand(entry: unknown, catalog: CatalogLookup | null = null): RotationCommand {
  if (typeof entry === 'number') return { type: 'cast', skillId: entry };
  if (typeof entry === 'string') {
    if (entry === '__combat_start') return { type: 'combat-start' };
    if (entry === '__cooldown_reset') return { type: 'cooldown-reset' };
    if (entry === '__wait') return { type: 'wait', durationMs: 0 };
    const skill = catalog?.skillsByName?.get(entry);
    return skill ? { type: 'cast', skillId: skill.id } : { type: 'cast', skillId: entry };
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
  const releaseAtCharges = candidate.releaseAtCharges;
  const doubleEdgeOutcome = candidate.doubleEdgeOutcome;
  if (doubleEdgeOutcome != null && doubleEdgeOutcome !== 'success' && doubleEdgeOutcome !== 'backfire') {
    throw new TypeError('Double Edge outcome must be either success or backfire.');
  }

  return {
    type: 'cast',
    skillId,
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
 *
 * @param {unknown} rotation
 * @param {CatalogLookup|null} [catalog]
 * @param {{strict?: boolean}} [options]
 * @returns {RotationCommand[]}
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

/**
 * Converts a canonical command back into the app's legacy persisted shape.
 *
 * @param {RotationCommand} command
 * @param {CatalogLookup|null} catalog
 * @returns {LegacyRotationEntry}
 */
export function toLegacyRotationEntry(command: RotationCommand, catalog: CatalogLookup | null): LegacyRotationEntry {
  if (command.type === 'cooldown-reset') {
    return { name: '__cooldown_reset' };
  }

  if (command.type === 'combat-start') {
    const entry: LegacyRotationEntry = { name: '__combat_start' };
    if (command.concurrentOffsetMs != null) {
      entry.offset = command.concurrentOffsetMs;
    }

    return entry;
  }

  if (command.type === 'wait') {
    return { name: '__wait', waitMs: command.durationMs };
  }

  const skill = catalog?.skillsById?.get(command.skillId);
  const entry: LegacyRotationEntry = {
    name: skill?.name ?? command.skillId
  };
  if (skill && catalog?.skills?.some((candidate) => candidate.id !== skill.id && candidate.name === skill.name)) {
    entry.skillId = command.skillId;
  }

  if (command.concurrentOffsetMs != null) entry.offset = command.concurrentOffsetMs;
  if (command.interruptAfterMs != null) entry.interruptMs = command.interruptAfterMs;
  if (command.releaseAtCharges != null) entry.releaseAtCharges = command.releaseAtCharges;
  if (command.doubleEdgeOutcome != null) entry.doubleEdgeOutcome = command.doubleEdgeOutcome;
  return entry;
}
