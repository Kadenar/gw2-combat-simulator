import type { ProfessionAppState } from '../types.js';
import { renderRotationHistoryControls } from './editing/history.js';
import { mountRotationHotkeys } from './input/hotkeys.js';
import { renderPalette } from './palette/view.js';
import { renderStartResource } from './palette/resource-view.js';
import { renderEventLog } from './result/event-log.js';
import { renderWarnings } from './result/warnings.js';
import { renderRotationStateSnapshot } from './state-snapshot/view.js';
import { renderTimeline } from './timeline/view.js';

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
  // Cooldowns, ammo, autoattack chains, and state-gated skills all come from the newly committed end state.
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
