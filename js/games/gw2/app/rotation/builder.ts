import { renderEventLog } from '#gw2/app/results/event-log.js';
import { renderRotationComparison } from '#gw2/app/rotation/comparison.js';
import { mountRotationHotkeys } from '#gw2/app/rotation/hotkeys.js';
import { renderStartResource } from '#gw2/app/rotation/palette/resource-view.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';
import { renderWarnings } from '#gw2/app/rotation/warnings.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export function renderRotationBuilder(app: ProfessionAppState): void {
  renderRotationEditor(app);
  renderRotationComparison(app);
  renderSimulationDetails(app);
}

/** Refreshes authoring controls immediately without waiting for a new simulation result. */
export function renderRotationEditor(app: ProfessionAppState): void {
  renderStartResource(app);
  renderPalette(app);
  mountRotationHotkeys(document.getElementById('rotation-palette'));
  renderTimeline(app);
  renderRotationStateSnapshot(app);
  renderRotationHistoryControls(app);
}

/** Refreshes views whose data is produced by the baseline simulation. */
export function renderSimulationOutput(app: ProfessionAppState): void {
  // Resource limits and skill availability all come from the newly committed end state.
  renderStartResource(app);
  renderPalette(app);
  mountRotationHotkeys(document.getElementById('rotation-palette'));
  renderTimeline(app);
  renderRotationComparison(app);
  renderRotationStateSnapshot(app);
  renderSimulationDetails(app);
}

/** Refreshes analysis output without repainting the unchanged rotation editor. */
function renderSimulationDetails(app: ProfessionAppState): void {
  renderWarnings(app);
  renderEventLog(app);
  const viewModel = app.adapter.presentation.createViewModel(app);
  app.adapter.presentation.render(app, viewModel);
}

/** Reflect undo/redo availability on the toolbar buttons. */
function renderRotationHistoryControls(app: ProfessionAppState): void {
  const undoButton = document.getElementById('btn-sim-undo');
  const redoButton = document.getElementById('btn-sim-redo');

  if (undoButton instanceof HTMLButtonElement) {
    undoButton.disabled = !app._rotationHistory?.undo.length;
  }

  if (redoButton instanceof HTMLButtonElement) {
    redoButton.disabled = !app._rotationHistory?.redo.length;
  }
}
