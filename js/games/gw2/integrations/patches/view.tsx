import { useState } from 'react';
import { renderReact } from '#ui/react-root.js';
import { skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import type { PatchComparison, ProfessionAppState } from '#gw2/app/types.js';
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
      const entry = rows.get(key) || { name: row.name, current: 0, preview: 0 };
      entry[version] = row.dps;
      rows.set(key, entry);
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, delta: row.preview - row.current }))
    .filter((row) => Math.abs(row.delta) >= 0.05)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

function Overview({ entries }: { readonly entries: readonly PatchOverviewEntry[] }) {
  if (!entries.length) {
    return <p className='patch-preview-empty'>No skill or trait modifier changes are authored for this profession.</p>;
  }

  return (
    <ul className='patch-note-list'>
      {entries.map((entry, index) => (
        <li key={`${entry.subject}:${index}`}>
          <span className='patch-note-status'>changed</span>
          <span>
            <strong>{entry.subject}</strong> {entry.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Keeps the optional patch comparison outside the main result root while React owns its stable sibling container. */
function PatchComparisonView({ app }: { readonly app: ProfessionAppState }) {
  const [deltasOpen, setDeltasOpen] = useState(true);
  const preview = app.profession.preview;
  const comparison = app.patchComparison;
  if (!preview || !comparison) return null;
  const currentDps = Number(comparison.current.dps || 0);
  const previewDps = Number(comparison.preview.dps || 0);
  const delta = previewDps - currentDps;
  const percent = currentDps === 0 ? 0 : (delta / currentDps) * 100;
  const deltas = skillDeltas(comparison);
  const overview = preview.professions?.[app.profession.id]?.overview || [];
  const selectedLabel = app.patchId === preview.id ? preview.label : 'Live game data';
  const sourceUrl = httpUrl(preview.sourceUrl);

  return (
    <section className='patch-comparison' aria-label='Patch preview comparison'>
      <div className='patch-comparison-header'>
        <div>
          <span className='patch-comparison-eyebrow'>Patch comparison</span>
          <h3>Live vs {preview.label}</h3>
        </div>
        <div className='patch-comparison-actions'>
          <span className='patch-selected-badge'>Showing {selectedLabel}</span>
          {sourceUrl ? (
            <a className='patch-source-link' href={sourceUrl} target='_blank' rel='noopener noreferrer'>
              Official patch notes <span aria-hidden='true'>↗</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className='patch-comparison-metrics'>
        <div>
          <span>Live DPS</span>
          <strong>{Math.round(currentDps).toLocaleString()}</strong>
        </div>
        <div>
          <span>Preview DPS</span>
          <strong>{Math.round(previewDps).toLocaleString()}</strong>
        </div>
        <div className={delta > 0 ? 'positive' : delta < 0 ? 'negative' : undefined}>
          <span>Difference</span>
          <strong>
            {signed(delta)} <small>({signed(percent, 2)}%)</small>
          </strong>
        </div>
      </div>
      <details
        className='patch-skill-deltas'
        open={Boolean(deltas.length) && deltasOpen}
        onToggle={(event) => setDeltasOpen(event.currentTarget.open)}
      >
        <summary>Per-skill DPS changes ({deltas.length})</summary>
        {deltas.length ? (
          <div className='patch-delta-table'>
            {deltas.map((row) => (
              <div key={row.name}>
                <span>{row.name}</span>
                <span>
                  {Math.round(row.current).toLocaleString()} → {Math.round(row.preview).toLocaleString()}
                </span>
                <strong className={row.delta > 0 ? 'positive' : 'negative'}>{signed(row.delta)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className='patch-preview-empty'>This rotation is unaffected by the applied preview edits.</p>
        )}
      </details>
      <details className='patch-note-ledger'>
        <summary>Change overview ({overview.length})</summary>
        <Overview entries={overview} />
      </details>
    </section>
  );
}

export function mountPatchPreviewControls(app: ProfessionAppState): void {
  const preview = app.profession.preview;
  const header = document.querySelector('body[data-profession] #app > header');
  const brand = header?.querySelector('.header-brand');
  if (!preview || !header || !brand || header.querySelector('.patch-preview-picker')) return;

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

/** Renders or clears the patch comparison through its dedicated React root. */
export function renderPatchComparison(container: HTMLElement, app: ProfessionAppState): void {
  renderReact(container, <PatchComparisonView app={app} />);
}
