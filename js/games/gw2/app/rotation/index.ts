import type { ProfessionAppState } from '#gw2/app/types.js';
import { renderRotationHistoryControls } from '#gw2/app/rotation/editing/history.js';
import { mountRotationHotkeys } from '#gw2/app/rotation/input/hotkeys.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { renderStartResource } from '#gw2/app/rotation/palette/resource-view.js';
import { renderEventLog } from '#gw2/app/rotation/result/event-log.js';
import { renderWarnings } from '#gw2/app/rotation/result/warnings.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';
import { renderTimeline } from '#gw2/app/rotation/timeline/view.js';

export function renderRotationBuilder(app: ProfessionAppState): void {
  renderRotationEditor(app);
  renderSimulationDetails(app);
}

/** Refreshes authoring controls immediately without waiting for a new simulation result. */
export function renderRotationEditor(app: ProfessionAppState): void {
  renderStartResource(app);
  renderPalette(app);
  mountRotationHotkeys(document.getElementById('rotation-palette'), app.adapter.capabilities.keybindImport);
  renderTimeline(app);
  renderRotationStateSnapshot(app);
  renderRotationHistoryControls(app);
}

/** Refreshes views whose data is produced by the baseline simulation. */
export function renderSimulationOutput(app: ProfessionAppState): void {
  // Resource limits and skill availability all come from the newly committed end state.
  renderStartResource(app);
  renderPalette(app);
  mountRotationHotkeys(document.getElementById('rotation-palette'), app.adapter.capabilities.keybindImport);
  renderTimeline(app);
  renderRotationStateSnapshot(app);
  renderSimulationDetails(app);
}

/** Refreshes analysis-only output without repainting the already-current authoring surface. */
function renderSimulationDetails(app: ProfessionAppState): void {
  renderWarnings(app);
  renderEventLog(app);
  const viewModel = app.adapter.presentation.createViewModel(app);
  app.adapter.presentation.render(app, viewModel);
}
