/** Applies optional command settings for both real edits and isolated simulation previews. */
import type { CastCommand, RotationCommand, WaitCommand } from '#gw2/platform/builds/rotation.js';

/**
 * Returns a new command with `changes` applied. Keys mapped to a defined value
 * are set/overwritten; keys mapped to undefined are deleted. Does not mutate
 * the input `entry`.
 */
export type RotationEntryChanges = Partial<Omit<CastCommand, 'type' | 'skillId'> & Pick<WaitCommand, 'durationMs'>>;

export function updateRotationEntry(entry: RotationCommand, changes: RotationEntryChanges = {}): RotationCommand {
  // Canonical commands always remain objects; undefined changes remove optional command settings.
  const updated = { ...entry };
  for (const [key, value] of Object.entries(changes || {}) as Array<
    [keyof RotationEntryChanges, RotationEntryChanges[keyof RotationEntryChanges]]
  >) {
    if (value === undefined) {
      delete (updated as RotationEntryChanges)[key];
    } else {
      (updated as { -readonly [Key in keyof RotationEntryChanges]: RotationEntryChanges[keyof RotationEntryChanges] })[
        key
      ] = value;
    }
  }

  return updated;
}
