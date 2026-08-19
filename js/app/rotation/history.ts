import type { LegacyRotationItem } from '../../platform/engine/types.js';
import type { ProfessionAppState } from '../profession/types.js';

/**
 * Undo/redo history for the rotation timeline.
 *
 * Every rotation mutation (palette click, drag, remove, truncate, offset edit,
 * clear, import, …) funnels through `app.changed()`. Rather than instrument
 * each call site, we snapshot the rotation inside `changed()` and diff it
 * against the last recorded state. A structural change pushes the previous
 * snapshot onto the undo stack; `undo`/`redo` restore a snapshot and re-run the
 * simulation via `changed(false)` — which is a no-op for the history because the
 * restored rotation already matches `current`.
 */

const HISTORY_LIMIT = 100;

interface RotationHistory {
  undo: LegacyRotationItem[][];
  redo: LegacyRotationItem[][];
  current: LegacyRotationItem[];
}

function cloneRotation(rotation: readonly LegacyRotationItem[]): LegacyRotationItem[] {
  return rotation.map((item) => (item !== null && typeof item === 'object' ? { ...item } : item));
}

function sameRotation(left: readonly LegacyRotationItem[], right: readonly LegacyRotationItem[]): boolean {
  return left.length === right.length && JSON.stringify(left) === JSON.stringify(right);
}

function ensureHistory(app: ProfessionAppState): RotationHistory {
  if (!app._rotationHistory) {
    app._rotationHistory = {
      undo: [],
      redo: [],
      current: cloneRotation(app.build.rotation)
    };
  }

  return app._rotationHistory;
}

/** Snapshot the current rotation if it changed since the last record. */
export function recordRotationHistory(app: ProfessionAppState): void {
  const history = ensureHistory(app);
  if (sameRotation(app.build.rotation, history.current)) return;
  history.undo.push(history.current);
  if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  history.redo = [];
  history.current = cloneRotation(app.build.rotation);
}

export function canUndoRotation(app: ProfessionAppState): boolean {
  return ensureHistory(app).undo.length > 0;
}

export function canRedoRotation(app: ProfessionAppState): boolean {
  return ensureHistory(app).redo.length > 0;
}

export function undoRotation(app: ProfessionAppState): void {
  const history = ensureHistory(app);
  const previous = history.undo.pop();
  if (!previous) return;
  history.redo.push(history.current);
  history.current = previous;
  app.build.rotation = cloneRotation(previous);
  app.changed(false);
}

export function redoRotation(app: ProfessionAppState): void {
  const history = ensureHistory(app);
  const next = history.redo.pop();
  if (!next) return;
  history.undo.push(history.current);
  history.current = next;
  app.build.rotation = cloneRotation(next);
  app.changed(false);
}

/** Reflect undo/redo availability on the toolbar buttons. */
export function renderRotationHistoryControls(app: ProfessionAppState): void {
  const undoButton = document.getElementById('btn-sim-undo');
  const redoButton = document.getElementById('btn-sim-redo');
  if (undoButton instanceof HTMLButtonElement) {
    undoButton.disabled = !canUndoRotation(app);
  }

  if (redoButton instanceof HTMLButtonElement) {
    redoButton.disabled = !canRedoRotation(app);
  }
}
