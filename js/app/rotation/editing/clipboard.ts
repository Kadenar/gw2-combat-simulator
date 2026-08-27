import { normalizeRotationInsertionIndex } from '../../../platform/ui/rotation/insertion-cursor.js';

import type { RotationCommand } from '../../../platform/engine/types.js';
import type { ProfessionAppState, RotationSelectionRange } from '../../profession/types.js';

/**
 * Range-selection clipboard for the rotation timeline. Users arm "copy loop"
 * mode, click a first and last entry to capture a contiguous span into
 * `app.rotationClipboard`, then paste it at the insertion cursor. This module
 * owns selection normalization, the copy/paste state transitions, and the
 * toolbar buttons + keyboard shortcuts that drive them.
 */

export type RotationSelectionClickResult = 'ignored' | 'pending' | 'copied';

function cloneRotationCommands(commands: readonly RotationCommand[]): RotationCommand[] {
  // Clipboard commands are isolated copies so later edits cannot mutate the saved loop.
  return commands.map((command) => ({ ...command }));
}

/**
 * Validates and clamps a stored selection against the current rotation length,
 * returning null when it is missing or no longer coherent (out-of-range or
 * empty span). Guards against stale selections after the rotation is edited.
 */
export function normalizeRotationSelection(
  selection: RotationSelectionRange | null | undefined,
  rotationLength: number
): RotationSelectionRange | null {
  const length = Math.max(0, Math.floor(Number(rotationLength) || 0));

  if (!selection || length === 0) return null;
  const anchorIndex = Number(selection.anchorIndex);
  const startIndex = Number(selection.startIndex);
  const endIndex = Number(selection.endIndex);

  if (
    !Number.isInteger(anchorIndex) ||
    !Number.isInteger(startIndex) ||
    !Number.isInteger(endIndex) ||
    anchorIndex < 0 ||
    anchorIndex >= length ||
    startIndex < 0 ||
    startIndex >= length ||
    endIndex <= startIndex
  ) {
    return null;
  }

  return {
    anchorIndex,
    startIndex,
    endIndex: Math.min(endIndex, length),
    awaitingEnd: selection.awaitingEnd === true
  };
}

/**
 * Advances the two-click selection at a clicked entry index. The first click
 * anchors a one-entry span awaiting its endpoint; the second click extends from
 * the anchor to the clicked entry (in either direction) and clears
 * `awaitingEnd`. An out-of-range index just re-normalizes the existing state.
 */
export function rotationSelectionForEntry(
  selection: RotationSelectionRange | null | undefined,
  index: number,
  rotationLength: number
): RotationSelectionRange | null {
  const length = Math.max(0, Math.floor(Number(rotationLength) || 0));

  if (!Number.isInteger(index) || index < 0 || index >= length) return normalizeRotationSelection(selection, length);
  const current = normalizeRotationSelection(selection, length);

  if (!current || !current.awaitingEnd) {
    return {
      anchorIndex: index,
      startIndex: index,
      endIndex: index + 1,
      awaitingEnd: true
    };
  }

  return {
    anchorIndex: current.anchorIndex,
    startIndex: Math.min(current.anchorIndex, index),
    endIndex: Math.max(current.anchorIndex, index) + 1,
    awaitingEnd: false
  };
}

/** Drops any active range selection and exits selection mode. */
export function clearRotationSelection(app: ProfessionAppState): void {
  app.rotationSelection = null;
  app.rotationSelectionMode = false;
}

/**
 * Copies the current selection's span into the clipboard as isolated clones,
 * settles the selection, and arms the insertion cursor just after the copied
 * loop. Returns false when there is no valid selection to copy.
 */
export function copyRotationSelection(app: ProfessionAppState): boolean {
  const selection = normalizeRotationSelection(app.rotationSelection, app.build.rotation.length);

  if (!selection) return false;
  app.rotationSelection = { ...selection, awaitingEnd: false };
  app.rotationSelectionMode = false;
  app.rotationClipboard = cloneRotationCommands(app.build.rotation.slice(selection.startIndex, selection.endIndex));
  // A copied loop defaults to duplicating immediately after itself; users can still choose any other gap.
  app.rotationInsertionIndex = selection.endIndex < app.build.rotation.length ? selection.endIndex : null;
  return app.rotationClipboard.length > 0;
}

/**
 * Pastes clones of the clipboard at the insertion cursor (or the end when
 * unset), selects the pasted span, advances an armed cursor past it, and
 * re-sims. Returns false when the clipboard is empty.
 */
export function pasteRotationClipboard(app: ProfessionAppState): boolean {
  if (!app.rotationClipboard.length) return false;
  const entries = cloneRotationCommands(app.rotationClipboard);
  const activeInsertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length);
  const insertAt = activeInsertionIndex ?? app.build.rotation.length;

  // Advance an armed insertion cursor past the pasted loop so repeated pastes stay in order.
  app.build.rotation.splice(insertAt, 0, ...entries);
  app.rotationInsertionIndex = activeInsertionIndex === null ? null : insertAt + entries.length;
  app.rotationSelection = {
    anchorIndex: insertAt,
    startIndex: insertAt,
    endIndex: insertAt + entries.length,
    awaitingEnd: false
  };
  app.rotationSelectionMode = false;

  // Armed-cursor pastes use the same single-paint path as palette insertions so long timelines
  // do not briefly collapse their result-derived rows while the replacement simulation runs.
  if (activeInsertionIndex === null) app.changed(false);
  else app.changed(false, false, { deferRotationRender: true });
  return true;
}

/**
 * Applies one entry click while in selection mode: 'ignored' when not selecting,
 * 'copied' once the second endpoint completes and captures the loop, otherwise
 * 'pending' while awaiting the closing click.
 */
export function selectRotationClipboardEntry(app: ProfessionAppState, index: number): RotationSelectionClickResult {
  if (!app.rotationSelectionMode) return 'ignored';
  const selection = rotationSelectionForEntry(app.rotationSelection, index, app.build.rotation.length);
  app.rotationSelection = selection;
  // The second endpoint completes and copies the loop without requiring a separate toolbar action.
  return selection && !selection.awaitingEnd && copyRotationSelection(app) ? 'copied' : 'pending';
}

/** True when the keydown originates inside a form field or dialog, where Ctrl+C/V belong to that control. */
function shouldIgnoreClipboardShortcut(event: KeyboardEvent): boolean {
  const target = event.target;

  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], dialog"));
}

/**
 * Re-normalizes selection state and repaints the timeline to match: toggles the
 * range-selecting class, marks selected entries, disables dragging while
 * selecting, and refreshes the toolbar controls.
 */
function refreshRotationClipboardView(app: ProfessionAppState, root: Document = document): void {
  const timeline = root.getElementById('rotation-timeline');
  const selection = normalizeRotationSelection(app.rotationSelection, app.build.rotation.length);
  app.rotationSelection = selection;

  if (!app.build.rotation.length) app.rotationSelectionMode = false;
  timeline?.classList.toggle('rotation-range-selecting', app.rotationSelectionMode);
  timeline?.querySelectorAll<HTMLElement>('.rot-skill[data-idx]:not(.rot-injected)').forEach((entry) => {
    const index = Number(entry.dataset.idx);
    const selected = Boolean(selection && index >= selection.startIndex && index < selection.endIndex);
    entry.classList.toggle('rot-range-selected', selected);
    entry.draggable = !app.rotationSelectionMode;
  });

  renderRotationClipboardControls(app, root);
}

/**
 * Timeline click entry point: applies the selection click and, unless ignored,
 * suppresses the default click and repaints. Returns the click result.
 */
export function handleRotationSelectionClick(
  app: ProfessionAppState,
  index: number,
  event: MouseEvent,
  root: Document = document
): RotationSelectionClickResult {
  const result = selectRotationClipboardEntry(app, index);

  if (result === 'ignored') return result;
  event.preventDefault();
  refreshRotationClipboardView(app, root);
  return result;
}

/**
 * Updates the copy/paste toolbar buttons to reflect current state: the copy
 * button's label/tooltip track selection mode and whether a loop is already
 * captured; the paste button reflects clipboard size and target position.
 */
export function renderRotationClipboardControls(app: ProfessionAppState, root: Document = document): void {
  const selection = normalizeRotationSelection(app.rotationSelection, app.build.rotation.length);
  const copyLoopButton = root.getElementById('btn-sim-copy-loop');
  const pasteButton = root.getElementById('btn-sim-paste-range');
  const clipboardCount = app.rotationClipboard.length;

  if (copyLoopButton instanceof HTMLButtonElement) {
    copyLoopButton.textContent = app.rotationSelectionMode
      ? selection?.awaitingEnd
        ? 'Choose last'
        : 'Choose first'
      : clipboardCount
        ? 'Copy another'
        : 'Copy loop';
    copyLoopButton.setAttribute('aria-pressed', String(app.rotationSelectionMode));
    copyLoopButton.title = app.rotationSelectionMode
      ? 'Cancel loop selection'
      : 'Copy a loop by clicking its first and last rotation entries';
  }

  if (pasteButton instanceof HTMLButtonElement) {
    pasteButton.disabled = clipboardCount === 0;
    pasteButton.textContent = clipboardCount ? `Paste ${clipboardCount}` : 'Paste';
    const insertionIndex =
      normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length) ??
      app.build.rotation.length;
    pasteButton.title = clipboardCount
      ? `Paste ${clipboardCount} entries at position ${insertionIndex + 1} (Ctrl+V)`
      : 'Copy a loop before pasting';
  }
}

/** Public hook for re-syncing clipboard UI after an external rotation change. */
export function syncRotationClipboardView(app: ProfessionAppState, root: Document = document): void {
  refreshRotationClipboardView(app, root);
}

/**
 * One-time setup: injects the copy/paste toolbar group next to undo/redo, wires
 * button clicks and the Ctrl/Cmd+C/V shortcuts, and renders initial controls.
 * No-ops if the toolbar is missing or already mounted.
 */
export function mountRotationClipboard(app: ProfessionAppState, root: Document = document): void {
  const toolbar = root.querySelector<HTMLElement>('.rotation-btns');

  if (!toolbar || root.getElementById('rotation-copy-tools')) return;

  const group = root.createElement('span');
  group.id = 'rotation-copy-tools';
  group.className = 'rotation-copy-tools';

  const copyLoopButton = root.createElement('button');
  copyLoopButton.id = 'btn-sim-copy-loop';
  copyLoopButton.type = 'button';
  copyLoopButton.className = 'btn btn-undo rotation-copy-loop';

  const pasteButton = root.createElement('button');
  pasteButton.id = 'btn-sim-paste-range';
  pasteButton.type = 'button';
  pasteButton.className = 'btn btn-undo';

  group.append(copyLoopButton, pasteButton);
  root.getElementById('btn-sim-redo')?.after(group);

  if (!group.isConnected) toolbar.prepend(group);

  copyLoopButton.addEventListener('click', () => {
    if (app.rotationSelectionMode) {
      clearRotationSelection(app);
    } else {
      app.rotationSelection = null;
      app.rotationSelectionMode = true;
    }

    refreshRotationClipboardView(app, root);
  });
  pasteButton.addEventListener('click', () => pasteRotationClipboard(app));

  // Mirror familiar clipboard shortcuts only while a rotation range or clipboard is active.
  root.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || shouldIgnoreClipboardShortcut(event)) return;
    const key = event.key.toLowerCase();

    if (key === 'c' && root.getSelection()?.toString()) return;

    if (key === 'c' && copyRotationSelection(app)) {
      event.preventDefault();
      app.adapter.renderRotationBuilder(app);
    } else if (key === 'v' && app.rotationClipboard.length) {
      event.preventDefault();
      pasteRotationClipboard(app);
    }
  });

  renderRotationClipboardControls(app, root);
}
