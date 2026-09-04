import { skillBreakdownRows } from '#gw2/app/results/model.js';
import { escapeHtml } from '#gw2/app/presentation/shared/html.js';
import type { PatchComparison } from '#gw2/app/simulation/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { PatchOverviewEntry } from '#gw2/integrations/patches/authoring/patches.js';

function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function signed(value: number, digits = 0): string {
  const normalized = Math.abs(value) < 10 ** -digits / 2 ? 0 : value;
  return `${normalized > 0 ? '+' : ''}${normalized.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`;
}

function skillDeltas(comparison: PatchComparison) {
  const rows = new Map<string, { name: string; current: number; preview: number }>();
  for (const [version, result] of [
    ['current', comparison.current],
    ['preview', comparison.preview]
  ] as const) {
    for (const row of skillBreakdownRows(result)) {
      const key = `${row.group}|${row.name}`;
      const entry = rows.get(key) || {
        name: row.name,
        current: 0,
        preview: 0
      };
      entry[version] = row.dps;
      rows.set(key, entry);
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, delta: row.preview - row.current }))
    .filter((row) => Math.abs(row.delta) >= 0.05)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

function overviewRows(entries: readonly PatchOverviewEntry[]): string {
  if (!entries.length) {
    return '<p class="patch-preview-empty">No skill or trait modifier changes are authored for this profession.</p>';
  }

  return `<ul class="patch-note-list">${entries
    .map(
      (entry) => `<li>
        <span class="patch-note-status">changed</span>
        <span><strong>${escapeHtml(entry.subject)}</strong> ${escapeHtml(entry.text)}</span>
      </li>`
    )
    .join('')}</ul>`;
}

export function mountPatchPreviewControls(app: ProfessionAppState): void {
  const preview = app.profession.preview;
  const header = document.querySelector('body[data-profession] #app > header');
  const brand = header?.querySelector('.header-brand');
  if (!preview || !header || !brand || header.querySelector('.patch-preview-picker')) {
    return;
  }

  const control = document.createElement('div');
  control.className = 'patch-preview-picker';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Game data version');

  const caption = document.createElement('span');
  caption.className = 'patch-preview-picker-label';
  caption.textContent = 'Game data';
  control.append(caption);

  const options = document.createElement('div');
  options.className = 'patch-preview-options';
  for (const [patchId, label] of [
    ['current', 'Live'],
    [preview.id, preview.label]
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'patch-preview-option';
    button.textContent = label;
    button.dataset.patchId = patchId;
    const active = patchId === app.patchId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.addEventListener('click', () => {
      app.selectPatch(patchId);
      for (const option of options.querySelectorAll('button')) {
        const selected = option.dataset.patchId === patchId;
        option.classList.toggle('active', selected);
        option.setAttribute('aria-pressed', String(selected));
      }
    });
    options.append(button);
  }

  control.append(options);
  // Keep the version picker in the brand flow so the sticky header reserves space for it.
  brand.append(control);
}

export function renderPatchComparison(container: HTMLElement, app: ProfessionAppState): void {
  const preview = app.profession.preview;
  const comparison = app.patchComparison;
  if (!preview || !comparison) return;
  const currentDps = Number(comparison.current.dps || 0);
  const previewDps = Number(comparison.preview.dps || 0);
  const delta = previewDps - currentDps;
  const percent = currentDps === 0 ? 0 : (delta / currentDps) * 100;
  const deltas = skillDeltas(comparison);
  const overview = preview.professions?.[app.profession.id]?.overview || [];
  const selectedLabel = app.patchId === preview.id ? preview.label : 'Live game data';
  const sourceUrl = httpUrl(preview.sourceUrl);
  const section = document.createElement('section');
  section.className = 'patch-comparison';
  section.setAttribute('aria-label', 'Patch preview comparison');
  section.innerHTML = `
    <div class="patch-comparison-header">
      <div>
        <span class="patch-comparison-eyebrow">Patch comparison</span>
        <h3>Live vs ${escapeHtml(preview.label)}</h3>
      </div>
      <div class="patch-comparison-actions">
        <span class="patch-selected-badge">Showing ${escapeHtml(selectedLabel)}</span>
        ${
          sourceUrl
            ? `<a class="patch-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Official patch notes <span aria-hidden="true">↗</span></a>`
            : ''
        }
      </div>
    </div>
    <div class="patch-comparison-metrics">
      <div><span>Live DPS</span><strong>${Math.round(currentDps).toLocaleString()}</strong></div>
      <div><span>Preview DPS</span><strong>${Math.round(previewDps).toLocaleString()}</strong></div>
      <div class="${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">
        <span>Difference</span><strong>${signed(delta)} <small>(${signed(percent, 2)}%)</small></strong>
      </div>
    </div>
    <details class="patch-skill-deltas"${deltas.length ? ' open' : ''}>
      <summary>Per-skill DPS changes (${deltas.length})</summary>
      ${
        deltas.length
          ? `<div class="patch-delta-table">${deltas
              .map(
                (row) => `<div>
                  <span>${escapeHtml(row.name)}</span>
                  <span>${Math.round(row.current).toLocaleString()} &rarr; ${Math.round(row.preview).toLocaleString()}</span>
                  <strong class="${row.delta > 0 ? 'positive' : 'negative'}">${signed(row.delta)}</strong>
                </div>`
              )
              .join('')}</div>`
          : '<p class="patch-preview-empty">This rotation is unaffected by the applied preview edits.</p>'
      }
    </details>
    <details class="patch-note-ledger">
      <summary>Change overview (${overview.length})</summary>
      ${overviewRows(overview)}
    </details>`;
  container.prepend(section);
}
