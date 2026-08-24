import { normalizeRotationInsertionIndex } from '../../../platform/ui/insertion-cursor.js';

import type { RotationCommand } from '../../../platform/engine/types.js';
import type { ProfessionAppState, RotationSelectionRange } from '../../profession/types.js';

export type RotationSelectionClickResult = 'ignored' | 'pending' | 'copied';

function cloneRotationCommands(commands: readonly RotationCommand[]): RotationCommand[] {
  // Clipboard commands are isolated copies so later edits cannot mutate the saved loop.
  return commands.map((command) => ({ ...command }));
}

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

export function clearRotationSelection(app: ProfessionAppState): void {
  app.rotationSelection = null;
  app.rotationSelectionMode = false;
}

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
  app.changed(false);
  return true;
}

export function selectRotationClipboardEntry(app: ProfessionAppState, index: number): RotationSelectionClickResult {
  if (!app.rotationSelectionMode) return 'ignored';
  const selection = rotationSelectionForEntry(app.rotationSelection, index, app.build.rotation.length);
  app.rotationSelection = selection;
  // The second endpoint completes and copies the loop without requiring a separate toolbar action.
  return selection && !selection.awaitingEnd && copyRotationSelection(app) ? 'copied' : 'pending';
}

function shouldIgnoreClipboardShortcut(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], dialog"));
}

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

export function syncRotationClipboardView(app: ProfessionAppState, root: Document = document): void {
  refreshRotationClipboardView(app, root);
}

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
