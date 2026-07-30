import type {
  ProfessionAppState,
} from "../profession/types.js";
import { renderEventLog } from "./event-log.js";
import { renderPalette } from "./palette-view.js";
import { renderResults } from "./result-view.js";
import { renderStartResource } from "./resource-view.js";
import { renderTimeline } from "./timeline-view.js";
import { renderWarnings } from "./warnings.js";

export function renderRotationBuilder(app: ProfessionAppState): void {
  renderStartResource(app);
  renderPalette(app);
  renderTimeline(app);
  renderWarnings(app);
  renderEventLog(app);
  renderResults(app);
}
