/**
 * Renders the sticky active-state bar from the insertion-aware snapshot model.
 * The view hides empty snapshots so the timeline only reserves space for state
 * that the user can inspect.
 */
import { renderReact } from '#ui/react-root.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { formatResultTimelineTime } from '#gw2/app/rotation/result/model.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';

/** Fills `#rotation-active-buffs` with the current state snapshot when available. */
export function renderRotationStateSnapshot(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-active-buffs');
  if (!element) return;
  if (!app.results || !app.build.rotation.length) {
    element.hidden = true;
    renderReact(element, null);
    return;
  }

  const { items, atInsertion, timeMs } = rotationStateSnapshot(app);
  const visible = items.filter((item) => item.active !== false);
  if (!visible.length) {
    element.hidden = true;
    renderReact(element, null);
    return;
  }

  element.hidden = false;
  // Label the insertion cursor or rotation end by time so the state matches the moment the user is inspecting.
  const time = formatResultTimelineTime(timeMs, app.results);
  const label = atInsertion ? `Active state @ ${time} (insertion point)` : `Active state @ ${time}`;
  renderReact(
    element,
    <>
      <span className='rot-state-label'>{label}:</span>
      {visible.map((item, index) => (
        <span className='rot-state-item' title={item.title || undefined} key={`${item.label}:${index}`}>
          {item.label} <strong>{String(item.value)}</strong>
        </span>
      ))}
    </>
  );
}
