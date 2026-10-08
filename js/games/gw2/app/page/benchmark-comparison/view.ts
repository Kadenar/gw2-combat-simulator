import { escapeHtml as html } from '#ui/shared/html.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { templateCategory, templateTileContent } from '#gw2/app/build/library/model.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import { ComparisonRunner } from '#gw2/app/page/benchmark-comparison/runner.js';
import { createComparisonExecutor } from '#gw2/app/page/benchmark-comparison/execute.js';
import { mountComparisonChart, type ComparisonLine } from '#gw2/app/page/benchmark-comparison/chart.js';
import { assignComparisonSlots, comparisonStyle } from '#gw2/app/page/benchmark-comparison/styles.js';
import {
  comparisonKey,
  comparisonCurve,
  comparisonDamageAt,
  comparisonDpsAt,
  type ComparisonMode,
  type ComparisonResult
} from '#gw2/app/page/benchmark-comparison/model.js';

export interface BenchmarkComparisonView {
  update(rows: readonly Benchmark[], colors: ReadonlyMap<Benchmark, string>): void;
  deactivate(): void;
}

/** Own an isolated comparison workspace; manifest browsing never prepares builds or starts workers. */
export function mountBenchmarkComparison(root: HTMLElement): BenchmarkComparisonView {
  root.classList.add('benchmark-comparison');
  root.innerHTML = `
    <div class="bc-toolbar"><p class="bc-help" id="bc-chart-help">Drag across the chart to zoom · Click to pin a time · Toggle legend entries to hide curves · Completed results stay cached until this page reloads</p><div class="bc-actions"><button type="button" data-bc-cancel hidden>Cancel run</button><button type="button" data-bc-run class="bc-primary" disabled>Run comparison</button></div></div>
    <div class="bc-workspace">
      <aside class="bc-picker" aria-label="Choose builds"><div class="bc-picker-heading"><h3>Choose builds</h3><span data-bc-count>0 selected</span></div>
        <input data-bc-search type="search" aria-label="Search comparison builds" placeholder="Search builds…" autocomplete="off">
        <select data-bc-profession aria-label="Comparison profession"><option value="all">All professions</option>${professionRegistry.map((entry) => `<option value="${html(entry.id)}">${html(entry.name)}</option>`).join('')}</select>
        <div class="bc-filters" role="group" aria-label="Comparison damage type"><button type="button" data-bc-filter="all" aria-pressed="true">All damage</button><button type="button" data-bc-filter="power" aria-pressed="false">Power</button><button type="button" data-bc-filter="condi" aria-pressed="false">Condition</button></div>
        <div class="bc-picker-actions"><label class="bc-outdated"><input type="checkbox" data-bc-outdated> Include outdated</label><button type="button" data-bc-clear class="bc-quiet">Clear selection</button></div>
        <p class="bc-catalog-heading" data-bc-catalog-count></p><div data-bc-catalog class="bc-catalog"></div>
      </aside>
      <div class="bc-analysis">
        <section class="bc-party-settings" data-bc-party-settings aria-label="Allies for selected simulations" hidden>
          <h3>Allies per simulation</h3>
          <div data-bc-parties></div>
        </section>
        <p class="bc-status" data-bc-status role="status" aria-live="polite"></p>
        <div class="bc-chart-section"><div class="bc-chart-heading"><div><h3 data-bc-title>Average DPS over time</h3><p data-bc-description>Total damage divided by time since first damage.</p></div><div class="bc-segmented" role="group" aria-label="DPS measurement"><button type="button" data-bc-mode="average" aria-pressed="true">Average</button><button type="button" data-bc-mode="1" aria-pressed="false">Last 1s</button><button type="button" data-bc-mode="5" aria-pressed="false">Last 5s</button></div></div>
          <div class="bc-chart-controls"><button type="button" data-bc-reset class="bc-quiet" disabled>Reset zoom</button></div>
          <div class="bc-plot"><canvas data-bc-canvas tabindex="0" aria-label="Build DPS comparison. Left and right arrows inspect time; Enter pins time; drag to zoom; Escape resets zoom." aria-describedby="bc-chart-help"></canvas><span class="bc-partial" data-bc-partial hidden title="Some visible runs have ended. Values in this region cover fewer builds.">Partial comparison</span><div class="bc-empty" data-bc-empty><div class="bc-loading" data-bc-loading hidden aria-hidden="true"><svg viewBox="0 0 160 64" fill="none"><path class="bc-loading-grid" d="M8 16H152M8 32H152M8 48H152"/><path class="bc-loading-curve bc-loading-gold" pathLength="1" d="M8 54C20 54 21 8 35 12S50 43 67 34S90 19 107 25S130 30 152 18"/><path class="bc-loading-curve bc-loading-blue" pathLength="1" d="M8 54C22 54 24 38 38 35S55 17 73 24S91 42 110 33S137 22 152 27"/><path class="bc-loading-curve bc-loading-purple" pathLength="1" d="M8 54C27 54 34 48 48 44S68 30 87 35S122 15 152 21"/></svg></div><strong data-bc-empty-title>Choose your builds</strong><p data-bc-empty-copy>Add one or more builds, then run a comparison.</p></div></div>
          <div class="bc-legend" data-bc-legend role="group" aria-label="Visible build curves"></div>
        </div>
        <section class="bc-inspector" aria-label="Values at selected time">
          <div class="bc-table-scroll" role="region" aria-label="Build DPS values at selected time" tabindex="0"><table><thead><tr><th scope="col">Build</th><th scope="col" data-bc-metric>DPS at cursor<small>Average</small></th><th scope="col" title="Average DPS over each build's complete run">Final DPS</th><th scope="col">Damage so far</th><th scope="col">Run ends</th></tr></thead><tbody data-bc-readout></tbody></table></div>
        </section>
      </div>
    </div>
`;
  const get = <T extends HTMLElement = HTMLElement>(name: string): T => root.querySelector<T>(`[data-bc-${name}]`)!;
  const search = get<HTMLInputElement>('search');
  const profession = get<HTMLSelectElement>('profession');
  const outdated = get<HTMLInputElement>('outdated');
  const runButton = get<HTMLButtonElement>('run');
  const selected = new Map<string, Benchmark>();
  const savedParties = new Map<string, { count?: number; error?: string }>();
  const styleSlots = new Map<string, number>();
  const hidden = new Set<string>();
  const presented = new WeakSet<ComparisonResult>();
  const curves = new WeakMap<ComparisonResult, Map<ComparisonMode, ReturnType<typeof comparisonCurve>>>();
  let rows: readonly Benchmark[] = [];
  let colors: ReadonlyMap<Benchmark, string> = new Map();
  let filter = 'all';
  let mode: ComparisonMode = 'average';
  let cursor = 0;
  let pinned = false;
  let cancelled = false;
  let lines: ComparisonLine[] = [];
  const executor = createComparisonExecutor(root.ownerDocument.baseURI);
  const runner = new ComparisonRunner(executor.execute, render);
  const name = (row: Benchmark): string => `${templateTileContent(row).name} ${row.specialization}`;
  const fullName = (row: Benchmark): string => `${row.specialization} · ${row.label}`;
  const index = (row: Benchmark): number => rows.indexOf(row);
  const color = (row: Benchmark): string => {
    const slot = styleSlots.get(comparisonKey(row));
    return slot === undefined ? (colors.get(row) ?? '#d3b690') : comparisonStyle(slot).color;
  };

  const resultFor = (row: Benchmark): ComparisonResult | undefined => runner.entries.get(comparisonKey(row))?.result;
  const duration = (): number =>
    Math.max(1000, ...[...selected.values()].map((row) => resultFor(row)?.durationMs ?? 0));
  const chart = mountComparisonChart(
    get<HTMLCanvasElement>('canvas'),
    get('partial'),
    () => ({ lines, mode, cursor, pinned, durationMs: duration() }),
    (value, pin) => {
      cursor = Math.min(duration(), Math.max(0, value));
      if (pin !== undefined) pinned = pin;
      renderValues();
      chart.draw();
    },
    (_start, _end, zoomed) => {
      // Expose zoom recovery without repeating the chart's time axis in a separate label.
      get<HTMLButtonElement>('reset').disabled = !zoomed;
    }
  );

  function renderCatalog(): void {
    const query = search.value.trim().toLowerCase();
    const matching = rows.filter(
      (row) =>
        (outdated.checked || row.upToDate !== false) &&
        (profession.value === 'all' || row.profession === profession.value) &&
        (filter === 'all' || templateCategory(row) === filter) &&
        `${row.professionName} ${row.specialization} ${row.label}`.toLowerCase().includes(query)
    );
    get('catalog-count').textContent = `${matching.length} presets · Select to compare`;
    // Group filtered builds by specialization so shared identity appears once without changing selection keys.
    const groups = new Map<string, Benchmark[]>();
    for (const row of matching) {
      const key = `${row.profession}:${row.specialization}`;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }

    get('catalog').innerHTML =
      [...groups.values()]
        .map((group) => {
          const first = group[0]!;
          const heading = `<h4 class="bc-group-heading" style="--bc-color:${html(colors.get(first) ?? '#d3b690')}">${html(first.professionName)} · ${html(first.specialization)}</h4>`;
          return (
            heading +
            group
              .map((row) => {
                const details = templateTileContent(row);
                return `<button type="button" class="bc-build ${selected.has(comparisonKey(row)) ? 'is-selected' : ''}" style="--bc-color:${html(color(row))}" data-bc-pick="${index(row)}" aria-label="Select ${html(fullName(row))}" aria-pressed="${selected.has(comparisonKey(row))}" ${runner.running || !row.rotation ? 'disabled' : ''}><span><strong>${html(details.name)}</strong><small>${html(details.weapons || row.label)}${row.upToDate === false ? ' · Outdated' : ''}</small>${!row.rotation ? '<small>No saved rotation</small>' : ''}</span></button>`;
              })
              .join('')
          );
        })
        .join('') || '<p class="bc-no-matches">No builds match your filters.</p>';
  }

  function renderValues(): void {
    // Keep full-run averages separate from cursor values so ended runs never compete at a later time.
    const number = (value: number): string => Math.round(value).toLocaleString('en-US');
    get('readout').innerHTML =
      [...selected.values()]
        .map((row) => {
          const key = comparisonKey(row);
          const entry = runner.entries.get(key);
          const result = entry?.result;
          const value = result ? comparisonDpsAt(result, cursor, mode) : null;
          const state =
            entry?.status === 'error'
              ? entry.error!
              : entry?.status === 'running'
                ? 'Loading / simulating…'
                : entry?.status === 'queued'
                  ? 'Queued'
                  : !result
                    ? 'Waiting to run'
                    : hidden.has(key)
                      ? 'Hidden from chart'
                      : templateTileContent(row).weapons;
          return `<tr class="${hidden.has(key) ? 'bc-hidden-line' : ''}" style="--bc-color:${html(color(row))}"><th scope="row"><span class="bc-row-name"><i class="bc-dot"></i>${html(name(row))}</span><small>${html(row.label)}</small><small ${entry?.status === 'error' ? 'class="bc-error"' : ''}>${html(state)}</small></th><td class="bc-value">${result ? (value === null ? `Ended at ${(result.durationMs / 1000).toFixed(1)}s` : number(value)) : '—'}</td><td data-bc-final>${result ? number(result.dps) : '\u2014'}</td><td>${result ? `${(comparisonDamageAt(result.damage, cursor) / 1000000).toFixed(3)}M` : '—'}</td><td>${result ? `${(result.durationMs / 1000).toFixed(2)}s<small>${result.targetDied ? 'Target defeated' : 'Rotation ended'}</small>` : '—'}</td></tr>`;
        })
        .join('') || '<tr><td colspan="5" class="bc-no-matches">Choose a build to start comparing.</td></tr>';
  }

  /** Load only selected presets; unknown or failed settings stay disabled rather than showing a guessed default. */
  async function loadParty(row: Benchmark): Promise<void> {
    const state: { count?: number; error?: string } = {};
    savedParties.set(comparisonKey(row), state);
    renderParties();
    try {
      state.count = await executor.loadAlliedPlayerCount(row);
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    }

    renderParties();
  }

  /** Keep party controls independent of cursor updates so chart inspection cannot replace a focused checkbox. */
  function renderParties(): void {
    const focused = get('parties').contains(root.ownerDocument.activeElement)
      ? (root.ownerDocument.activeElement as HTMLElement).dataset.bcAllies
      : undefined;
    get('party-settings').hidden = selected.size === 0;
    get('parties').innerHTML = [...selected.values()]
      .map((row) => {
        const saved = savedParties.get(comparisonKey(row));
        const count = runner.alliedPlayerCount(row) ?? saved?.count;
        return `<div class="bc-party" style="--bc-color:${html(color(row))}"><span><i class="bc-dot"></i>${html(fullName(row))}</span><label><input type="checkbox" data-bc-allies="${index(row)}" aria-label="With allies for ${html(fullName(row))}" ${count ? 'checked' : ''} ${runner.running || saved?.count === undefined ? 'disabled' : ''}> With allies${saved?.error ? ' (unavailable)' : count === undefined ? ' (loading…)' : count > 0 ? ` (${count})` : ''}</label>${saved?.error ? `<span class="bc-error">${html(saved.error)} <button type="button" data-bc-retry-allies="${index(row)}" ${runner.running ? 'disabled' : ''}>Retry</button></span>` : ''}</div>`;
      })
      .join('');
    if (focused !== undefined)
      root.querySelector<HTMLInputElement>(`[data-bc-allies="${focused}"]:enabled`)?.focus({ preventScroll: true });
  }

  /** Keep preset warnings visible so problematic simulations cannot appear warning-free. */
  function renderWarnings(): void {
    const completed = [...selected.values()].filter((row) => resultFor(row));
    const warnings = completed.flatMap((row) =>
      resultFor(row)!.warnings.map((warning) => `${fullName(row)}: ${warning}`)
    );
    let warningBox = root.querySelector<HTMLElement>('[data-bc-warnings]');
    if (!warningBox) {
      warningBox = root.ownerDocument.createElement('div');
      warningBox.dataset.bcWarnings = '';
      warningBox.className = 'bc-warnings';
      get('status').after(warningBox);
    }

    warningBox.hidden = !warnings.length;
    warningBox.innerHTML = warnings.map((warning) => `<p>${html(warning)}</p>`).join('');
  }

  function render(): void {
    assignComparisonSlots(selected.keys(), styleSlots);
    const picked = [...selected.values()];
    const finished = picked.filter((row) => runner.entries.get(comparisonKey(row))?.status === 'complete');
    // Result identity survives visibility/selection toggles; only a fresh simulation earns a reveal.
    for (const row of finished) {
      const result = resultFor(row)!;
      if (presented.has(result)) continue;
      presented.add(result);
      if (!hidden.has(comparisonKey(row))) chart.reveal(result);
    }

    const failed = picked.filter((row) => runner.entries.get(comparisonKey(row))?.status === 'error');
    const pending = picked.length - finished.length;
    get('count').textContent = `${picked.length} selected`;
    // Keep preparation within the plot so starting a run does not shift the chart vertically.
    get('status').textContent =
      runner.running || !picked.length
        ? ''
        : cancelled
          ? `Run cancelled · ${finished.length} completed results kept`
          : failed.length
            ? `${failed.length} build${failed.length === 1 ? '' : 's'} failed · Run comparison to retry`
            : '';
    get('status').hidden = !get('status').textContent;
    runButton.disabled = runner.running || !picked.length;
    runButton.textContent = runner.running ? 'Running…' : pending ? `Run comparison (${pending})` : 'Run again';
    get<HTMLButtonElement>('clear').disabled = runner.running || !picked.length;
    get('cancel').hidden = !runner.running;
    root.querySelectorAll<HTMLButtonElement>('[data-bc-pick]').forEach((button) => {
      const row = rows[Number(button.dataset.bcPick)]!;
      const active = selected.has(comparisonKey(row));
      button.setAttribute('aria-pressed', String(active));
      button.disabled = runner.running || !row.rotation;
      button.classList.toggle('is-selected', active);
      button.style.setProperty('--bc-color', color(row));
    });
    get('legend').innerHTML = finished
      .map(
        (row) =>
          `<button type="button" style="--bc-color:${html(color(row))}" data-bc-visible="${index(row)}" aria-pressed="${!hidden.has(comparisonKey(row))}" title="${html(fullName(row))}"><svg viewBox="0 0 32 10" aria-hidden="true"><path d="M0 5H32" fill="none" stroke="currentColor" stroke-width="2.25" stroke-dasharray="${comparisonStyle(styleSlots.get(comparisonKey(row))!).dash.join(' ')}"/></svg>${html(fullName(row))}</button>`
      )
      .join('');
    lines = finished
      .filter((row) => !hidden.has(comparisonKey(row)))
      .map((row) => {
        const result = resultFor(row)!;
        let cached = curves.get(result);
        if (!cached) {
          cached = new Map();
          curves.set(result, cached);
        }

        if (!cached.has(mode)) cached.set(mode, comparisonCurve(result, mode));
        return { ...comparisonStyle(styleSlots.get(comparisonKey(row))!), result, points: cached.get(mode)! };
      });
    cursor = Math.min(cursor, duration());
    get('empty').hidden = lines.length > 0;
    // Animate only initial preparation; completed curves take over as soon as results arrive.
    get('loading').hidden = !runner.running || finished.length > 0;
    get('empty-title').textContent = !picked.length
      ? 'Choose your builds'
      : finished.length
        ? 'All curves are hidden'
        : runner.running
          ? 'Building your comparison…'
          : failed.length
            ? 'Simulation needs attention'
            : '';
    get('empty-title').hidden = !get('empty-title').textContent;
    get('empty-copy').textContent = !picked.length
      ? 'Add one or more builds, then run a comparison.'
      : finished.length
        ? 'Toggle a build in the legend to show its curve again.'
        : runner.running
          ? 'Each completed build appears here as it becomes ready.'
          : failed.length
            ? 'Check the per-build errors below, then retry.'
            : 'Run comparison to see your selected builds on the chart.';
    renderValues();
    renderParties();
    renderWarnings();
    chart.draw();
  }

  for (const input of [search, profession, outdated])
    input.addEventListener(input === search ? 'input' : 'change', renderCatalog);
  // Editing one selected build queues only that build again and leaves all saved presets untouched.
  get('parties').addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const rowIndex = input.dataset.bcAllies;
    if (rowIndex === undefined || runner.running) return;
    cancelled = false;
    const row = rows[Number(rowIndex)]!;
    const savedCount = savedParties.get(comparisonKey(row))?.count;
    if (savedCount === undefined) return;
    const count = input.checked ? savedCount || 4 : 0;
    runner.setAlliedPlayerCount(row, count === savedCount ? null : count);
    chart.reset();
    root.querySelector<HTMLInputElement>(`[data-bc-allies="${rowIndex}"]`)?.focus({ preventScroll: true });
  });
  root.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    const { bcPick, bcFilter, bcMode, bcVisible, bcRetryAllies } = button.dataset;
    if (bcRetryAllies !== undefined && !runner.running) void loadParty(rows[Number(bcRetryAllies)]!);
    // Native row buttons expose selection to keyboard and assistive technology without separate checkboxes.
    if (bcPick !== undefined && !runner.running) {
      const row = rows[Number(bcPick)]!;
      const key = comparisonKey(row);
      if (selected.has(key)) {
        selected.delete(key);
        hidden.delete(key);
      } else {
        selected.set(key, row);
        if (!savedParties.has(key)) void loadParty(row);
      }

      cancelled = false;
      render();
      chart.reset();
    }

    if (bcFilter !== undefined) {
      filter = bcFilter;
      root
        .querySelectorAll('[data-bc-filter]')
        .forEach((element) => element.setAttribute('aria-pressed', String(element === button)));
      renderCatalog();
    }

    if (bcMode !== undefined) {
      mode = bcMode as ComparisonMode;
      root
        .querySelectorAll('[data-bc-mode]')
        .forEach((element) => element.setAttribute('aria-pressed', String(element === button)));
      get('title').textContent = mode === 'average' ? 'Average DPS over time' : `${mode}-second rolling DPS`;
      get('description').textContent =
        mode === 'average'
          ? 'Total damage divided by time since first damage.'
          : `Damage in the last ${mode} second${mode === '1' ? '' : 's'}, divided by the window’s duration.`;
      get('metric').innerHTML = `DPS at cursor<small>${mode === 'average' ? 'Average' : `Last ${mode}s`}</small>`;
      render();
    }

    if (bcVisible !== undefined) {
      const key = comparisonKey(rows[Number(bcVisible)]!);
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
      render();
      root.querySelector<HTMLElement>(`[data-bc-visible="${bcVisible}"]`)?.focus({ preventScroll: true });
    }
  });
  runButton.addEventListener('click', () => {
    cancelled = false;
    const picked = [...selected.values()];
    chart.reset();
    void runner.run(
      picked,
      picked.every((row) => runner.entries.get(comparisonKey(row))?.status === 'complete')
    );
  });
  get('cancel').addEventListener('click', () => {
    cancelled = true;
    runner.cancel();
    runButton.focus();
  });
  get('clear').addEventListener('click', () => {
    selected.clear();
    hidden.clear();
    cancelled = false;
    render();
    chart.reset();
    search.focus();
  });
  get('reset').addEventListener('click', chart.reset);
  root.ownerDocument.defaultView?.addEventListener('pagehide', () => {
    runner.cancel();
    chart.dispose();
    executor.dispose();
  });
  render();
  return {
    update(nextRows, nextColors) {
      rows = nextRows;
      colors = nextColors;
      for (const key of selected.keys()) {
        const row = rows.find((candidate) => comparisonKey(candidate) === key);
        if (row) selected.set(key, row);
        else selected.delete(key);
      }

      renderCatalog();
      render();
    },
    deactivate() {
      if (runner.running) {
        cancelled = true;
        runner.cancel();
      }
    }
  };
}
