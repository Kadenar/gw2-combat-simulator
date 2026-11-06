/** Renders history availability; editing policy belongs to the headless session. */
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Reflect undo/redo availability on the toolbar buttons. */
export function renderRotationHistoryControls(app: ProfessionAppState): void {
  const undoButton = document.getElementById('btn-sim-undo');
  const redoButton = document.getElementById('btn-sim-redo');

  if (undoButton instanceof HTMLButtonElement) {
    undoButton.disabled = !app._rotationHistory?.undo.length;
  }

  if (redoButton instanceof HTMLButtonElement) {
    redoButton.disabled = !app._rotationHistory?.redo.length;
  }
}
