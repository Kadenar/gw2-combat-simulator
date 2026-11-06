/** Applies complete rotation edits so command, cursor, and history rules share one headless owner. */
import { updateRotationEntry, type RotationEntryChanges } from '#gw2/app/rotation/editing/operations.js';
import type { RotationEditingSession, RotationHistory } from '#gw2/app/rotation/editing/state.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

export type RotationEdit =
  | { readonly type: 'insert'; readonly entries: readonly RotationCommand[] }
  | { readonly type: 'drop'; readonly entries: readonly RotationCommand[]; readonly index: number }
  | { readonly type: 'move'; readonly from: number; readonly to: number }
  | { readonly type: 'remove' | 'truncate'; readonly index: number }
  | { readonly type: 'update'; readonly index: number; readonly changes: RotationEntryChanges }
  | { readonly type: 'replace' | 'reset'; readonly rotation: readonly RotationCommand[] }
  | { readonly type: 'clear' | 'undo' | 'redo' }
  | { readonly type: 'select'; readonly index: number | null };

export interface RotationEditResult {
  readonly rotation: RotationCommand[];
  readonly session: RotationEditingSession;
  readonly commandsChanged: boolean;
  readonly cursorChanged: boolean;
}

/** Commands contain scalar settings; detached copies isolate history and imported rotations from later edits. */
export function cloneRotation(rotation: readonly RotationCommand[]): RotationCommand[] {
  return rotation.map((command) => ({ ...command }));
}

function sameRotation(left: readonly RotationCommand[], right: readonly RotationCommand[]): boolean {
  if (left === right) return true;

  return (
    left.length === right.length &&
    left.every((command, index) => {
      const other = right[index];
      return (
        Object.keys(command).length === Object.keys(other).length &&
        Object.entries(command).every(([key, value]) => other[key as keyof RotationCommand] === value)
      );
    })
  );
}

/** Rejected edits return null; accepted edits never mutate the supplied commands or history. */
export function editRotation(
  rotation: RotationCommand[],
  session: RotationEditingSession,
  edit: RotationEdit
): RotationEditResult | null {
  const originalCursor = session.rotationInsertionIndex ?? null;
  let cursor = normalizeRotationInsertionIndex(originalCursor, rotation.length);
  const history = session._rotationHistory ?? { undo: [], redo: [] };
  let nextHistory: RotationHistory = history;
  let next = rotation;
  const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < rotation.length;

  switch (edit.type) {
    case 'select':
      cursor = normalizeRotationInsertionIndex(edit.index, rotation.length);
      break;
    case 'insert':
    case 'drop': {
      if (!edit.entries.length || edit.entries.some((entry) => entry == null)) return null;

      if (edit.type === 'drop' && !Number.isInteger(edit.index)) return null;

      const index =
        edit.type === 'drop' ? Math.max(0, Math.min(rotation.length, edit.index)) : (cursor ?? rotation.length);
      next = [...rotation.slice(0, index), ...cloneRotation(edit.entries), ...rotation.slice(index)];
      cursor = edit.type === 'drop' || cursor === null ? null : index + edit.entries.length;
      break;
    }

    case 'move': {
      if (!validIndex(edit.from) || !Number.isInteger(edit.to)) return null;

      const target = Math.max(0, Math.min(rotation.length, edit.to));
      const index = edit.from < target ? target - 1 : target;

      if (index === edit.from) return null;

      next = [...rotation];
      const [entry] = next.splice(edit.from, 1);
      next.splice(index, 0, entry);
      cursor = null;
      break;
    }

    case 'remove':
    case 'truncate':
      if (!validIndex(edit.index)) return null;

      next = [...rotation];
      next.splice(edit.index, edit.type === 'remove' ? 1 : next.length - edit.index);
      cursor = null;
      break;
    case 'update':
      if (!validIndex(edit.index)) return null;

      next = [...rotation];
      next[edit.index] = updateRotationEntry(rotation[edit.index], edit.changes);
      break;
    case 'replace':
    case 'reset':
      next = cloneRotation(edit.rotation);

      if (edit.type === 'reset') nextHistory = { undo: [], redo: [] };

      break;
    case 'clear':
      next = [];
      break;
    case 'undo': {
      const previous = history.undo.at(-1);

      if (!previous) return null;

      next = cloneRotation(previous);
      nextHistory = { undo: history.undo.slice(0, -1), redo: [...history.redo, cloneRotation(rotation)] };
      break;
    }

    case 'redo': {
      const following = history.redo.at(-1);

      if (!following) return null;

      next = cloneRotation(following);
      nextHistory = { undo: [...history.undo, cloneRotation(rotation)].slice(-100), redo: history.redo.slice(0, -1) };
      break;
    }
  }

  const commandsChanged = !sameRotation(rotation, next);

  if (commandsChanged && !['undo', 'redo', 'reset'].includes(edit.type)) {
    nextHistory = { undo: [...history.undo, cloneRotation(rotation)].slice(-100), redo: [] };
  }

  cursor = normalizeRotationInsertionIndex(cursor, next.length);
  return {
    rotation: commandsChanged || edit.type === 'reset' ? next : rotation,
    session: { rotationInsertionIndex: cursor, _rotationHistory: nextHistory },
    commandsChanged,
    cursorChanged: cursor !== originalCursor
  };
}
