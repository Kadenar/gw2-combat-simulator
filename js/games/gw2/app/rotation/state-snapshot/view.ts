/**
 * Renders the sticky active-state bar from the insertion-aware snapshot model.
 * The view hides empty snapshots so the timeline only reserves space for state
 * that the user can inspect.
 */
import { cursorPreviewReady } from '#gw2/app/rotation/cursor-preview.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { activeStateIconsEnabled } from '#gw2/app/rotation/timeline/preferences.js';
import { catalogSkillIcon, MODIFIER_EFFECT_ICONS, resolveRelicIcon } from '#gw2/app/shared/icons.js';
import { formatResultTimelineTime } from '#gw2/app/shared/result-clock.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

/** Fills `#rotation-active-buffs` with the current state snapshot when available. */
export function renderRotationStateSnapshot(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-active-buffs');

  if (!element) return;

  // Explicit renders clear unavailable state; deferred rotation rendering owns preservation during edits.
  if (!cursorPreviewReady(app.analysis.state) || !app.build.rotation.length) {
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
  const time = formatResultTimelineTime(timeMs, app.analysis.state.results);
  const label = atInsertion ? `Active state @ ${time} (insertion point)` : `Active state @ ${time}`;
  const useIcons = activeStateIconsEnabled(document);
  element.innerHTML =
    `<span class="rot-state-label">${esc(label)}:</span>` +
    visible
      .map((item) => {
        // Keep a readable name for effects without artwork and for assistive technology. Boon and modifier names
        // resolve before catalog names so a skill sharing that name cannot replace the effect's artwork.
        const icon =
          useIcons &&
          (item.icon ||
            (item.id === 'critical-chance' && MODIFIER_EFFECT_ICONS.Precision) ||
            (item.id.startsWith('relic:') && resolveRelicIcon(item.label)) ||
            MODIFIER_EFFECT_ICONS[item.label] ||
            catalogSkillIcon(app.activeCatalog, item.label) ||
            app.activeCatalog.traits.find((trait) => trait.name === item.label)?.icon);
        const title = icon ? [item.label, item.title].filter(Boolean).join('\n') : item.title;
        const name = icon ? `<img src="${esc(icon)}" alt="${esc(item.label)}">` : esc(item.label);
        return `<span class="rot-state-item"${title ? ` title="${esc(title)}"` : ''}>${name} <strong>${esc(item.value)}</strong></span>`;
      })
      .join('');
  for (const image of element.querySelectorAll('img')) {
    image.addEventListener('error', () => image.replaceWith(image.alt), { once: true });
  }
}
