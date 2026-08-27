/**
 * Renders the sticky active-state bar from the insertion-aware snapshot model.
 * The view hides empty snapshots so the timeline only reserves space for state
 * that the user can inspect.
 */
import { escapeHtml as esc } from '../../presentation/shared/html.js';
import type { ProfessionAppState } from '../../types.js';
import { formatResultTimelineTime } from '../result/model.js';
import { rotationStateSnapshot } from './model.js';

/** Fills `#rotation-active-buffs` with the current state snapshot when available. */
export function renderRotationStateSnapshot(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-active-buffs');
  if (!element) return;
  if (!app.results || !app.build.rotation.length) {
    element.innerHTML = '';
    element.hidden = true;
    return;
  }

  const { items, atInsertion, timeMs } = rotationStateSnapshot(app);
  const visible = items.filter((item) => item.active !== false);
  if (!visible.length) {
    element.innerHTML = '';
    element.hidden = true;
    return;
  }

  element.hidden = false;
  // Label the insertion cursor or rotation end by time so the state matches the
  // moment the user is inspecting on the timeline.
  const time = formatResultTimelineTime(timeMs, app.results);
  const label = atInsertion ? `Active state @ ${time} (insertion point)` : `Active state @ ${time}`;
  element.innerHTML =
    `<span class="rot-state-label">${esc(label)}:</span>` +
    visible
      .map(
        (item) =>
          `<span class="rot-state-item"${
            item.title ? ` title="${esc(item.title)}"` : ''
          }>${esc(item.label)} <strong>${esc(item.value)}</strong></span>`
      )
      .join('');
}
