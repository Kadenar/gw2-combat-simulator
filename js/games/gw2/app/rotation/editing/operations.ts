import type { RotationCommand, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';

/**
 * Owns mutations of the user-authored rotation so shared timeline renderers
 * can request edits without owning application state changes.
 *
 * Moves the entry at `fromIndex` to `toIndex`, mutating `rotation` in place.
 * Returns false (no mutation) on invalid indices or a no-op move.
 */
export function moveRotationEntry(rotation: RotationCommand[], fromIndex: number, toIndex: number): boolean {
  // Reject non-arrays, non-integer indices, and a source outside current bounds.
  if (
    !Array.isArray(rotation) ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= rotation.length
  ) {
    return false;
  }

  // Clamp the requested target into [0, length] so callers can pass "end" freely.
  const boundedTarget = Math.max(0, Math.min(toIndex, rotation.length));
  // Removing an earlier entry shifts a forward insertion target left by one.
  const insertAt = fromIndex < boundedTarget ? boundedTarget - 1 : boundedTarget;
  if (insertAt === fromIndex) return false;

  // Pull the entry out, then re-insert at the adjusted slot.
  const [entry] = rotation.splice(fromIndex, 1);
  if (entry === undefined) return false;
  rotation.splice(insertAt, 0, entry);
  return true;
}

/**
 * Returns a new command with `changes` applied. Keys mapped to a defined value
 * are set/overwritten; keys mapped to undefined are deleted. Does not mutate
 * the input `entry`.
 */
export function updateRotationEntry(entry: RotationCommand, changes: SchedulerRecord = {}): RotationCommand {
  // Canonical commands always remain objects; undefined changes remove optional command settings.
  const updated: SchedulerRecord = { ...entry };
  for (const [key, value] of Object.entries(changes || {})) {
    if (value === undefined) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
  }

  return updated as unknown as RotationCommand;
}

/**
 * Inserts multiple entries at `index`, preserving their order, mutating
 * `rotation` in place. Rejects empty batches or any null/undefined entry so a
 * partial insert never happens. Returns false (no mutation) on invalid inputs.
 */
export function insertRotationEntries(
  rotation: RotationCommand[],
  entries: readonly RotationCommand[],
  index: number
): boolean {
  if (
    !Array.isArray(rotation) ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.some((entry) => entry == null) ||
    !Number.isInteger(index)
  ) {
    return false;
  }

  const boundedIndex = Math.max(0, Math.min(index, rotation.length));
  rotation.splice(boundedIndex, 0, ...entries);
  return true;
}
