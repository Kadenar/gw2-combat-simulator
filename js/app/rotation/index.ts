import type { ProfessionAppState } from '../profession/types.js';
import { renderRotationClipboardControls } from './editing/clipboard.js';
import { renderRotationHistoryControls } from './editing/history.js';
import { mountRotationHotkeys } from './input/hotkeys.js';
import { renderPalette } from './palette/view.js';
import { renderStartResource } from './palette/resource-view.js';
import { renderEventLog } from './result/event-log.js';
import { renderResults } from './result/view.js';
import { renderWarnings } from './result/warnings.js';
import { renderRotationStateSnapshot } from './state-snapshot/view.js';
import { renderTimeline } from './timeline/view.js';

export function renderRotationBuilder(app: ProfessionAppState): void {
  renderStartResource(app);
  renderPalette(app);
  renderRotationClipboardControls(app);
  mountRotationHotkeys(document.getElementById('rotation-palette'));
  renderTimeline(app);
  renderRotationStateSnapshot(app);
  renderRotationHistoryControls(app);
  renderWarnings(app);
  renderEventLog(app);
  renderResults(app);
}
