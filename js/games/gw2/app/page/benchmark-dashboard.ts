import { professionRegistry } from '#gw2/profession-registry.js';
import { navigationRoute } from '#browser/page/embed.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import { benchmarkBuildPreview } from '#gw2/app/page/benchmark-build-preview.js';
import { templateBoon, templateCategory } from '#gw2/app/build/library/model.js';
import {
  benchmarkColors,
  benchmarkScale,
  benchmarkApmScale,
  benchmarkComparisonAxis,
  hasBenchmarkApm,
  filterBenchmarks,
  readBenchmarks,
  type Benchmark
} from '#gw2/app/page/benchmarks.js';

/** Mount the optional benchmark tool once so chart filters survive navigation back to the workspace. */
export function mountBenchmarks(root: HTMLElement): void {
  if (root.dataset.benchmarkDashboard) return;
  root.dataset.benchmarkDashboard = 'mounted';
  root.dataset.benchmarkActivePanel = 'builds';
  root.dataset.buildView = 'cards';
  // Start build charts with all professions; profession cards can still open a narrower comparison.
  root.innerHTML = `
  <div class="benchmark-toolbar" role="group" aria-label="Benchmark charts">
    <button type="button" data-benchmark-panel="builds" aria-pressed="true">Build benchmarks</button>
    <button type="button" data-benchmark-panel="profession" aria-pressed="false">DPS / APM by Build</button>
    <button type="button" data-benchmark-panel="apm" aria-pressed="false">DPS vs APM</button>
    <button type="button" data-benchmark-panel="health" aria-pressed="false">DPS by health</button>
    <div class="benchmark-view-switch" role="group" aria-label="Build benchmark view"><button type="button" data-build-view="cards" aria-pressed="true">Cards</button><button type="button" data-build-view="table" aria-pressed="false">Table</button></div>
  </div>
  <div class="benchmark-dashboard">
    <aside class="benchmark-sidebar" aria-label="Benchmark filters">
      <div class="filter-heading"><h2>Professions</h2><button type="button" data-reset-filters>Reset</button></div>
      <label class="filter-field" for="benchmark-search"><span>Search benchmarks</span><svg class="benchmark-search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/></svg><input id="benchmark-search" type="search" placeholder="Search builds…" autocomplete="off"></label>
      <label class="benchmark-overview-profession filter-field"><span class="benchmark-filter-label">Profession</span><select data-overview-profession><option value="all">All</option><option value="custom" disabled>Selected professions</option>${professionRegistry.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join('')}</select></label>
      <fieldset class="profession-filters"><legend>Include professions</legend><div data-profession-filters></div></fieldset>
      <label class="filter-field" for="benchmark-damage"><span class="benchmark-filter-label">Damage type</span><select id="benchmark-damage"><option value="all">All</option><option value="power">Power</option><option value="condi">Condition</option></select></label>
      <label class="filter-field" for="benchmark-role"><span class="benchmark-filter-label">Boon role</span><select id="benchmark-role"><option value="all">All</option><option value="none">DPS</option><option value="quickness">Quickness</option><option value="alacrity">Alacrity</option></select></label>
      <label class="outdated-filter"><input type="checkbox" id="benchmark-outdated">Include outdated</label>
      <div class="benchmark-profession-tabs" role="group" aria-label="Overview professions"><button type="button" data-overview-profession="all" aria-pressed="true">All professions</button>${professionRegistry.map((entry) => `<button type="button" class="profession-card-${entry.id}" data-overview-profession="${entry.id}" aria-pressed="false"><span class="profession-dot" aria-hidden="true"></span>${entry.name}</button>`).join('')}</div>
      <label class="benchmark-sort benchmark-overview-sort"><span class="benchmark-filter-label">Sort by</span><select id="benchmark-sort"><option value="name">Profession</option><option value="dps">Highest DPS</option><option value="apm">Lowest APM</option></select></label>
    </aside>
    <div class="benchmark-main">
      <section data-chart-panel="apm" aria-label="DPS vs APM" hidden>
        <div data-apm-chart></div>
      </section>
      <section data-chart-panel="health" aria-label="DPS by health" hidden>
        <div class="benchmark-section-heading health-heading"><div class="benchmark-health-controls"><label class="benchmark-sort">DPS <select data-health-metric><option value="cumulative">Cumulative</option><option value="phase">Phase</option></select></label><label class="benchmark-sort">Phase <select data-health-phase><option value="all">All phases</option>${TARGET_HEALTH_BANDS.map((band) => `<option value="${band.id}">${band.label}</option>`).join('')}</select></label><label class="benchmark-sort">Builds <select data-health-builds><option value="top">Top DPS build per profession</option><option value="all">All matching builds</option></select></label></div></div>
        <div data-health-chart></div>
      </section>
      <section data-chart-panel="profession" aria-label="DPS / APM by Build" hidden>
        <div class="benchmark-section-heading health-heading"><div class="benchmark-bar-controls"><label class="benchmark-sort">Profession <select data-bar-profession><option value="all">All</option>${professionRegistry.map((entry) => `<option value="${entry.id}">${entry.name}</option>`).join('')}</select></label><label class="benchmark-sort">Specialization <select data-bar-specialization><option value="all">All</option></select></label></div></div>
        <div data-bar-chart></div>
      </section>
      <section data-chart-panel="builds" aria-label="Build benchmarks">

        <div class="benchmark-cards" data-benchmark-cards></div>
        <div class="benchmark-overview-table" data-build-table hidden></div>
      </section>
      <div class="benchmark-status-row"><p role="status" data-benchmark-status>Loading benchmarks…</p><button type="button" data-benchmark-retry hidden>Retry loading</button></div>
    </div>
  </div>`;
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const apmNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  const selected = new Set(professionRegistry.map(({ id }) => id));
  const search = root.querySelector<HTMLInputElement>('#benchmark-search')!;
  const damage = root.querySelector<HTMLSelectElement>('#benchmark-damage')!;
  const role = root.querySelector<HTMLSelectElement>('#benchmark-role')!;
  const outdated = root.querySelector<HTMLInputElement>('#benchmark-outdated')!;
  const sort = root.querySelector<HTMLSelectElement>('#benchmark-sort')!;
  const status = root.querySelector<HTMLElement>('[data-benchmark-status]')!;
  const cards = root.querySelector<HTMLElement>('[data-benchmark-cards]')!;
  const buildTable = root.querySelector<HTMLElement>('[data-build-table]')!;
  let buildSortAscending = true;
  const retry = root.querySelector<HTMLButtonElement>('[data-benchmark-retry]')!;
  let benchmarks: Benchmark[] = [];
  let failures: string[] = [];
  let inspectedBuild: Benchmark | null = null;
  let inspectedMetric = 'dps';
  let colors: ReadonlyMap<Benchmark, string> = new Map();
  const colorStyle = (row: Benchmark): string => `--benchmark-color:${colors.get(row)}`;
  let apmRows: Benchmark[] = [];
  let apmInspectedBuild: Benchmark | null = null;
  let apmInspectorOrigin: 'table' | 'graph' = 'table';
  let apmSort = 'apm';
  let apmAscending = true;
  let healthSort = 'name';
  let healthAscending = true;
  const boonLabel = (row: Benchmark): string => {
    const boon = templateBoon(row);
    return boon === 'none' ? 'DPS' : boon[0]!.toUpperCase() + boon.slice(1);
  };

  /** Native checkboxes keep profession selection keyboard accessible without treating navigation as a filter. */
  root.querySelector('[data-profession-filters]')!.innerHTML = professionRegistry
    .map(
      (entry) => `
  <label class="profession-filter profession-card-${entry.id}">
    <input type="checkbox" value="${entry.id}" checked>
    <span class="profession-dot" aria-hidden="true"></span><span>${entry.name}</span>
  </label>`
    )
    .join('');

  /** Overview links open the exact saved build and rotation, sharing the inspector's workspace route. */
  function benchmarkWorkspaceHref(row: Benchmark): string {
    const entry = professionRegistry.find(({ id }) => id === row.profession)!;
    const params = new URLSearchParams({ benchmark: row.build });
    if (row.rotation) params.set('rotation', row.rotation);
    return navigationRoute(`${entry.route}?${params}#workspace`);
  }

  /** Name the external destination so users know where the benchmark reference opens. */
  function benchmarkSource(row: Benchmark): string {
    return row.snowCrowsUrl && /^https:\/\/snowcrows\.com\//.test(row.snowCrowsUrl)
      ? `<a href="${html(row.snowCrowsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View on Snowcrows: ${html(`${row.specialization} · ${row.label}`)}">View on Snowcrows</a>`
      : '';
  }

  function benchmarkBuildName(row: Benchmark): string {
    return `<strong>${html(row.specialization)}</strong><span>${html(row.label)}</span>${row.upToDate === false ? '<small class="outdated-badge">Outdated</small>' : ''}`;
  }

  /** Compact cards expose aligned numeric fields instead of competing colored metric tracks. */
  function cardRowsMarkup(rows: readonly Benchmark[], professionName: string): string {
    return `<table class="benchmark-card-table" aria-label="${html(professionName)} benchmarks"><thead><tr><th scope="col">Build</th><th scope="col">DPS</th><th scope="col">APM</th></tr></thead><tbody>${rows.map((row) => `<tr class="build-benchmark"><th scope="row"><a class="benchmark-build-name" title="${html(`${row.specialization} \u00b7 ${row.label}`)}" href="${html(benchmarkWorkspaceHref(row))}" aria-label="Open ${html(`${row.specialization} · ${row.label}`)} in workspace">${html(`${row.specialization} \u00b7 ${row.label}`)}</a>${row.upToDate === false ? '<small class="outdated-badge">Outdated</small>' : ''}</th><td data-build-dps>${number.format(row.benchmarkDps)}</td><td data-build-apm>${hasBenchmarkApm(row) ? apmNumber.format(row.benchmarkApm) : '—'}</td></tr>`).join('')}</tbody></table>`;
  }

  /** Both overview presentations use the same sort, with unavailable APM after measured builds. */
  function compareOverviewBuilds(a: Benchmark, b: Benchmark): number {
    if (sort.value === 'name')
      return (
        (buildSortAscending ? 1 : -1) * a.professionName.localeCompare(b.professionName) ||
        b.benchmarkDps - a.benchmarkDps ||
        a.label.localeCompare(b.label)
      );
    if (sort.value === 'apm') {
      if (!hasBenchmarkApm(a)) return hasBenchmarkApm(b) ? 1 : a.label.localeCompare(b.label);
      if (!hasBenchmarkApm(b)) return -1;
    }

    const difference = sort.value === 'apm' ? a.benchmarkApm! - b.benchmarkApm! : a.benchmarkDps - b.benchmarkDps;
    return (
      (buildSortAscending ? 1 : -1) * difference || b.benchmarkDps - a.benchmarkDps || a.label.localeCompare(b.label)
    );
  }

  function renderBuildTable(rows: readonly Benchmark[]): void {
    const sortHeader = (key: string, label: string): string =>
      `<th scope="col" aria-sort="${sort.value === key ? (buildSortAscending ? 'ascending' : 'descending') : 'none'}"><button type="button" data-build-sort="${key}">${label}${sort.value === key ? (buildSortAscending ? ' ↑' : ' ↓') : ''}</button></th>`;
    buildTable.innerHTML = rows.length
      ? `<div class="benchmark-overview-table-scroll" tabindex="0" role="region" aria-label="Build benchmarks table"><table><thead><tr><th scope="col">#</th><th scope="col">Build</th>${sortHeader('name', 'Profession')}<th scope="col">Damage type</th>${sortHeader('dps', 'DPS')}${sortHeader('apm', 'APM')}<th scope="col">Actions</th></tr></thead><tbody>${[
          ...rows
        ]
          .sort(compareOverviewBuilds)
          .map((row, index) => {
            const category = templateCategory(row);
            return `<tr><td>${index + 1}</td><th scope="row"><div class="benchmark-build-name">${benchmarkBuildName(row)}</div></th><td class="profession-card-${row.profession}"><span class="profession-dot" aria-hidden="true"></span> ${html(row.professionName)}</td><td>${category === 'power' ? 'Power' : category === 'condi' ? 'Condition' : '—'}</td><td data-build-dps>${number.format(row.benchmarkDps)}</td><td data-build-apm>${hasBenchmarkApm(row) ? apmNumber.format(row.benchmarkApm) : '—'}</td><td><div class="benchmark-overview-actions"><a href="${html(benchmarkWorkspaceHref(row))}" aria-label="Open ${html(`${row.specialization} · ${row.label}`)} in workspace">Open build</a>${benchmarkSource(row)}</div></td></tr>`;
          })
          .join('')}</tbody></table></div>`
      : '<p class="benchmark-empty">No benchmarks match these filters.</p>';
  }

  /** Recompute all views together so ranking and individual bars always describe the active filters. */
  function render(): void {
    const professionScope =
      selected.size === professionRegistry.length ? 'all' : selected.size === 1 ? [...selected][0]! : 'custom';
    root.querySelector<HTMLSelectElement>('select[data-overview-profession]')!.value = professionScope;
    root.querySelectorAll<HTMLElement>('button[data-overview-profession]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.overviewProfession === professionScope));
    });
    const rows = filterBenchmarks(benchmarks, {
      professions: selected,
      query: search.value,
      damage: damage.value,
      role: role.value,
      includeOutdated: outdated.checked
    });
    const groups = professionRegistry
      .filter(({ id }) => selected.has(id))
      .map((entry) => ({ entry, rows: rows.filter((row) => row.profession === entry.id).sort(compareOverviewBuilds) }))
      .filter(({ entry, rows: builds }) => builds.length || failures.includes(entry.name));
    groups.sort((a, b) => {
      if (!a.rows.length) return b.rows.length ? 1 : a.entry.name.localeCompare(b.entry.name);
      if (!b.rows.length) return -1;
      return compareOverviewBuilds(a.rows[0]!, b.rows[0]!);
    });
    sort.querySelector<HTMLOptionElement>('[value="name"]')!.textContent =
      sort.value === 'name' && !buildSortAscending ? 'Profession Z–A' : 'Profession';
    sort.querySelector<HTMLOptionElement>('[value="dps"]')!.textContent =
      sort.value === 'dps' && buildSortAscending ? 'Lowest DPS' : 'Highest DPS';
    sort.querySelector<HTMLOptionElement>('[value="apm"]')!.textContent =
      sort.value === 'apm' && !buildSortAscending ? 'Highest APM' : 'Lowest APM';

    status.textContent = failures.length ? `Could not load ${failures.join(', ')}.` : '';
    retry.hidden = failures.length === 0;

    // Every profession uses the same fixed-height scrolling list, so all builds are immediately available.
    cards.innerHTML = groups.length
      ? groups
          .map(
            ({
              entry,
              rows: builds
            }) => `<article id="benchmarks-${entry.id}" class="benchmark-card profession-card-${entry.id}">
      <div class="benchmark-card-heading"><h3><button type="button" data-profession-bars="${entry.id}" aria-label="Compare ${entry.name} DPS / APM by build"><span class="profession-dot" aria-hidden="true"></span>${entry.name} <small>(${builds.length})</small></button></h3><a href="${html(navigationRoute(`${entry.route}#workspace`))}" aria-label="Open ${entry.name} workspace">Open workspace</a></div>
      ${builds.length ? `<div class="benchmark-card-scroll" role="region" aria-label="${entry.name} builds" tabindex="0">${cardRowsMarkup(builds, entry.name)}</div>` : '<p class="benchmark-empty">Benchmark data unavailable. Retry loading above.</p>'}
    </article>`
          )
          .join('')
      : '<p class="benchmark-empty">No benchmarks match these filters.</p>';
    renderBuildTable(rows);
    renderApmChart(rows);
    renderHealthChart(rows);
    renderBarChart(rows);
  }

  /** Switch the same build series between cumulative and phase DPS, keeping missing measurements disconnected. */
  function renderHealthChart(rows: readonly Benchmark[]): void {
    // A selected health band narrows points, bounds, and table columns together in either DPS mode.
    const phase = root.querySelector<HTMLSelectElement>('[data-health-phase]')!.value;
    const bands = TARGET_HEALTH_BANDS.filter((band) => phase === 'all' || band.id === phase);
    const xPercent = (index: number): number => ((index + 0.5) / bands.length) * 100;
    if (healthSort !== 'name' && !bands.some((band) => band.id === healthSort)) {
      healthSort = phase;
    }

    const mode = root.querySelector<HTMLSelectElement>('[data-health-metric]')!.value as 'cumulative' | 'phase';
    const bandLabel = (index: number): string =>
      mode === 'phase' ? bands[index]!.label : `${bands[index]!.endHealth}%`;
    const seen = new Set<string>();
    const all = root.querySelector<HTMLSelectElement>('[data-health-builds]')!.value === 'all';
    const series = rows.filter((row) => {
      if (!all && seen.has(row.profession)) return false;
      seen.add(row.profession);
      return true;
    });
    const valueAt = (row: Benchmark, index: number): number | null => {
      const value = row.benchmarkDpsByHealth?.[bands[index]!.id]?.[mode];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    };

    const values = series
      .flatMap((row) => bands.map((_, index) => valueAt(row, index)))
      .filter((value) => value !== null);
    const axis = benchmarkComparisonAxis(values, 50);
    const heightPercent = (value: number): number => ((value - axis.min) / (axis.max - axis.min)) * 100;
    const host = root.querySelector<HTMLElement>('[data-health-chart]')!;
    const tableOpen = host.querySelector<HTMLDetailsElement>('.health-values')?.open ?? false;
    if (!values.length) {
      host.innerHTML = '<p class="benchmark-empty">No completed health bands for matching benchmarks.</p>';
      return;
    }

    const lines = series
      .map((row) =>
        bands
          .slice(1)
          .map((_, index) => {
            const from = valueAt(row, index);
            const to = valueAt(row, index + 1);
            return from === null || to === null
              ? ''
              : `<line class="health-line profession-card-${row.profession}" style="${colorStyle(row)}" x1="${xPercent(index)}" y1="${100 - heightPercent(from)}" x2="${xPercent(index + 1)}" y2="${100 - heightPercent(to)}" vector-effect="non-scaling-stroke"/>`;
          })
          .join('')
      )
      .join('');
    const dots = series
      .map((row) =>
        bands
          .map((_, index) => {
            const value = valueAt(row, index);
            if (value === null) return '';
            const label = `${row.professionName} · ${row.specialization} · ${row.label} · ${bandLabel(index)}: ${number.format(value)} ${mode} DPS`;
            return `<button type="button" class="scatter-point profession-card-${row.profession}" data-health-point style="${colorStyle(row)};left:${xPercent(index)}%;bottom:${heightPercent(value)}%" aria-label="${html(label)}"></button>`;
          })
          .join('')
      )
      .join('');
    /** Sort only the table using the displayed metric; missing measurements stay last in either direction. */
    function healthTableMarkup(): string {
      const buildName = (row: Benchmark): string => `${row.professionName} · ${row.specialization} · ${row.label}`;
      const bandIndex = bands.findIndex((band) => band.id === healthSort);
      const ordered = [...series].sort((a, b) => {
        const nameOrder = buildName(a).localeCompare(buildName(b));
        if (bandIndex < 0) return (healthAscending ? 1 : -1) * nameOrder;
        const left = valueAt(a, bandIndex);
        const right = valueAt(b, bandIndex);
        if (left === null) return right === null ? nameOrder : 1;
        if (right === null) return -1;
        return (healthAscending ? 1 : -1) * (left - right) || nameOrder;
      });
      const columns = [['name', 'Build'], ...bands.map((band, index) => [band.id, bandLabel(index)])];
      return `<thead><tr>${columns.map(([key, label]) => `<th scope="col" aria-sort="${key === healthSort ? (healthAscending ? 'ascending' : 'descending') : 'none'}"><button type="button" data-health-sort="${key}">${label}${key === healthSort ? (healthAscending ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead><tbody>${ordered.map((row) => `<tr><th scope="row">${html(buildName(row))}</th>${bands.map((_, index) => `<td>${valueAt(row, index) === null ? '—' : number.format(valueAt(row, index)!)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    }

    host.innerHTML = `      <div class="scatter-layout"><div class="scatter-y-axis comparison-y-axis">${axis.ticks.map((tick, index) => `<span style="top:${100 - heightPercent(tick)}%">${number.format(tick)}${index === 0 ? ' DPS' : ''}</span>`).join('')}</div>
      <div class="scatter-plot health-plot" aria-label="DPS by target health"><div class="scatter-grid" aria-hidden="true">${axis.ticks.map((tick) => `<i style="top:${100 - heightPercent(tick)}%"></i>`).join('')}</div><svg class="health-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${dots}${inspectionMarkup('data-health-detail')}</div>
      <div class="health-x-axis" style="--health-band-count:${bands.length}">${bands.map((_, index) => `<span>${bandLabel(index)}</span>`).join('')}</div></div>
      <details class="health-values" ${tableOpen ? 'open' : ''}><summary>DPS values (${series.length} builds)</summary><div class="health-table-scroll"><table>${healthTableMarkup()}</table></div></details>`;
    const table = host.querySelector<HTMLTableElement>('.health-values table')!;
    table.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-health-sort]');
      if (!button) return;
      const key = button.dataset.healthSort!;
      healthAscending = key === healthSort ? !healthAscending : key === 'name';
      healthSort = key;
      table.innerHTML = healthTableMarkup();
      table.querySelector<HTMLButtonElement>(`[data-health-sort="${healthSort}"]`)!.focus({ preventScroll: true });
    });
  }

  root.querySelector('[data-health-builds]')!.addEventListener('change', render);
  root.querySelector('[data-health-metric]')!.addEventListener('change', render);
  root.querySelector('[data-health-phase]')!.addEventListener('change', render);
  /** Plot actual DPS/APM pairs; native point buttons provide the same build inspection with mouse, keyboard, or touch. */
  function renderApmChart(rows: readonly Benchmark[]): void {
    const measurable = rows.filter(hasBenchmarkApm);
    // The scatter's horizontal range follows visible APM values instead of reserving unused space down to zero.
    const axis = benchmarkComparisonAxis(
      measurable.map((row) => row.benchmarkApm),
      1
    );
    const widthPercent = (value: number): number => ((value - axis.min) / (axis.max - axis.min)) * 100;
    const dpsAxis = benchmarkComparisonAxis(
      measurable.map((row) => row.benchmarkDps),
      50
    );
    const heightPercent = (value: number): number => ((value - dpsAxis.min) / (dpsAxis.max - dpsAxis.min)) * 100;
    apmRows = measurable;
    if (apmInspectedBuild && !apmRows.includes(apmInspectedBuild)) apmInspectedBuild = null;
    const host = root.querySelector<HTMLElement>('[data-apm-chart]')!;
    host.innerHTML = measurable.length
      ? `<div class="benchmark-apm-layout"><div class="benchmark-apm-content"><div class="scatter-layout"><div class="scatter-y-axis comparison-y-axis">${dpsAxis.ticks.map((tick, index) => `<span style="top:${100 - heightPercent(tick)}%">${number.format(tick)}${index === 0 ? ' DPS' : ''}</span>`).join('')}</div>
    <div class="scatter-plot" aria-label="Build DPS versus APM"><div class="scatter-grid" aria-hidden="true">${dpsAxis.ticks.map((tick) => `<i style="top:${100 - heightPercent(tick)}%"></i>`).join('')}</div>${measurable
      .map((row, index) => {
        const label = `${row.professionName} · ${row.specialization} · ${row.label}: ${number.format(row.benchmarkDps)} DPS, ${apmNumber.format(row.benchmarkApm)} APM`;
        return `<button type="button" class="scatter-point profession-card-${row.profession}" data-point="${index}" aria-expanded="false" aria-controls="benchmark-scatter-inspector" style="${colorStyle(row)};left:${widthPercent(row.benchmarkApm)}%;bottom:${heightPercent(row.benchmarkDps)}%" aria-label="${html(label)}"></button>`;
      })
      .join('')}${inspectionMarkup('data-point-detail')}</div><div class="scatter-x-axis">${[...axis.ticks]
      .reverse()
      .map(
        (tick) =>
          `<span style="left:${widthPercent(tick)}%">${apmNumber.format(tick)}${tick === axis.max ? ' APM' : ''}</span>`
      )
      .join(
        ''
      )}</div></div><div class="benchmark-apm-table" data-apm-table></div></div>${buildInspectorMarkup('benchmark-scatter-inspector')}</div>`
      : '<p class="benchmark-empty">No matching benchmarks with APM data.</p>';
    renderApmTable();
    if (apmInspectedBuild) openApmInspector(apmInspectedBuild, apmInspectorOrigin);
  }

  /** Sort the same population as the scatter plot, retaining original point identities. */
  function orderedApmRows(): Benchmark[] {
    return [...apmRows].sort((a, b) => {
      const difference =
        apmSort === 'apm'
          ? a.benchmarkApm! - b.benchmarkApm!
          : apmSort === 'dps'
            ? a.benchmarkDps - b.benchmarkDps
            : apmSort === 'role'
              ? boonLabel(a).localeCompare(boonLabel(b))
              : a.label.localeCompare(b.label);
      return (apmAscending ? 1 : -1) * difference || a.label.localeCompare(b.label);
    });
  }

  function renderApmTable(): void {
    const host = root.querySelector<HTMLElement>('[data-apm-table]');
    if (!host) return;
    const ordered = orderedApmRows();
    host.innerHTML = `<h3>Benchmarks</h3><div class="benchmark-apm-table-scroll" tabindex="0" role="region" aria-label="Benchmark table"><table><thead><tr>${[
      ['name', 'Build'],
      ['role', 'Role'],
      ['dps', 'DPS'],
      ['apm', 'APM']
    ]
      .map(
        ([key, label]) =>
          `<th scope="col" aria-sort="${key === apmSort ? (apmAscending ? 'ascending' : 'descending') : 'none'}"><button type="button" data-apm-sort="${key}">${label}${key === apmSort ? (apmAscending ? ' ↑' : ' ↓') : ''}</button></th>`
      )
      .join('')}</tr></thead><tbody>${ordered
      .map(
        (row) =>
          `<tr data-apm-row="${apmRows.indexOf(row)}" style="${colorStyle(row)}"><th scope="row"><button type="button" data-inspect-apm aria-expanded="false" aria-controls="benchmark-scatter-inspector"><span class="benchmark-table-dot" aria-hidden="true"></span><span>${html(row.label)}<small>${html(row.specialization)} · ${html(row.professionName)}</small></span></button></th><td>${boonLabel(row)}</td><td>${number.format(row.benchmarkDps)}</td><td>${apmNumber.format(row.benchmarkApm!)}</td></tr>`
      )
      .join('')}</tbody></table></div>`;
    updateApmInspection();
  }

  root.querySelector('[data-apm-chart]')!.addEventListener('click', (event) => {
    const target = event.target as Element;
    const sortButton = target.closest<HTMLButtonElement>('[data-apm-sort]');
    if (!sortButton) return;
    apmAscending = apmSort === sortButton.dataset.apmSort ? !apmAscending : sortButton.dataset.apmSort !== 'dps';
    apmSort = sortButton.dataset.apmSort!;

    renderApmTable();
    root.querySelector<HTMLElement>(`[data-apm-sort="${apmSort}"]`)?.focus({ preventScroll: true });
  });

  const apmChart = root.querySelector<HTMLElement>('[data-apm-chart]')!;

  /** Persistent selection follows the build identity through table sorting and transient hover changes. */
  function updateApmInspection(): void {
    apmChart.querySelectorAll<HTMLElement>('[data-point], [data-apm-row]').forEach((element) => {
      const index = Number(element.dataset.point ?? element.dataset.apmRow);
      const active = apmRows[index] === apmInspectedBuild;
      element.classList.toggle('is-inspected', active);
      const button = element.matches('button') ? element : element.querySelector('button')!;
      button.setAttribute('aria-expanded', String(active));
    });
  }

  function revealApmRow(index: number): void {
    const scroll = apmChart.querySelector<HTMLElement>('.benchmark-apm-table-scroll')!;
    const linkedRow = apmChart.querySelector<HTMLElement>(`[data-apm-row="${index}"]`)!;
    const viewport = scroll.getBoundingClientRect();
    const rowBounds = linkedRow.getBoundingClientRect();
    const headerHeight = scroll.querySelector('thead')!.getBoundingClientRect().height;
    if (rowBounds.top < viewport.top + headerHeight) scroll.scrollTop -= viewport.top + headerHeight - rowBounds.top;
    else if (rowBounds.bottom > viewport.bottom) scroll.scrollTop += rowBounds.bottom - viewport.bottom;
  }

  /** Explicit row or point activation opens a persistent inspector, leaving ordinary hover lightweight. */
  function openApmInspector(row: Benchmark, origin: 'table' | 'graph'): void {
    apmInspectedBuild = row;
    apmInspectorOrigin = origin;
    apmChart.querySelector('.benchmark-apm-layout')!.classList.add('has-build-inspector');
    const inspector = apmChart.querySelector<HTMLElement>('#benchmark-scatter-inspector')!;
    inspector.hidden = false;
    populateBuildInspector(inspector, row, () => apmInspectedBuild === row);
    updateApmInspection();
    revealApmRow(apmRows.indexOf(row));
    apmChart.querySelector('.benchmark-inspection')!.setAttribute('hidden', '');
  }

  function closeApmInspector(): void {
    if (!apmInspectedBuild) return;
    const index = apmRows.indexOf(apmInspectedBuild);
    apmInspectedBuild = null;
    apmChart.querySelector('#benchmark-scatter-inspector')!.setAttribute('hidden', '');
    apmChart.querySelector('.benchmark-apm-layout')!.classList.remove('has-build-inspector');
    updateApmInspection();
    const selector = apmInspectorOrigin === 'table' ? `[data-apm-row="${index}"] button` : `[data-point="${index}"]`;
    apmChart.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    apmChart.querySelector('.benchmark-inspection')!.setAttribute('hidden', '');
  }

  /** Keep DPS and APM bars in matching build order and colors, with separate zero-based scales and inspection. */
  function renderBarChart(rows: readonly Benchmark[]): void {
    const select = root.querySelector<HTMLSelectElement>('[data-bar-profession]')!;
    for (const option of select.options) option.disabled = option.value !== 'all' && !selected.has(option.value);
    if (select.value !== 'all' && !selected.has(select.value)) select.value = 'all';
    const specialization = root.querySelector<HTMLSelectElement>('[data-bar-specialization]')!;
    const previousSpecialization = specialization.value;
    const specializationKey = (row: Benchmark): string => `${row.profession}:${row.specialization}`;
    // Specialization choices follow the profession scope, while search and role filters only narrow the plotted builds.
    const professions = professionRegistry.filter(
      ({ id }) => selected.has(id) && (select.value === 'all' || select.value === id)
    );
    specialization.innerHTML =
      '<option value="all">All</option>' +
      professions
        .map((entry) => {
          const names = [
            ...new Set(benchmarks.filter((row) => row.profession === entry.id).map((row) => row.specialization))
          ].sort();
          const options = names
            .map((name) => `<option value="${html(`${entry.id}:${name}`)}">${html(name)}</option>`)
            .join('');
          return select.value === 'all' ? `<optgroup label="${entry.name}">${options}</optgroup>` : options;
        })
        .join('');
    specialization.value = [...specialization.options].some((option) => option.value === previousSpecialization)
      ? previousSpecialization
      : 'all';
    const builds = rows.filter(
      (row) =>
        (select.value === 'all' || row.profession === select.value) &&
        (specialization.value === 'all' || specializationKey(row) === specialization.value)
    );
    const host = root.querySelector<HTMLElement>('[data-bar-chart]')!;
    if (inspectedBuild && !builds.includes(inspectedBuild)) inspectedBuild = null;
    if (!builds.length) {
      host.innerHTML = '<p class="benchmark-empty">No benchmarks match these filters.</p>';
      return;
    }

    host.innerHTML = ['dps', 'apm']
      .map((metric) => {
        const unit = metric.toUpperCase();
        const scale = metric === 'dps' ? benchmarkScale(builds) : benchmarkApmScale(builds);
        const formatter = metric === 'dps' ? number : apmNumber;
        return `<h3 class="benchmark-bar-heading">${unit} by build</h3><div class="bar-chart-layout" data-bar-metric="${metric}"><div class="scatter-y-axis bar-y-axis"><span>${formatter.format(scale)} ${unit}</span><span>${formatter.format(scale / 2)}</span><span>0</span></div>
      <div class="bar-chart-frame"><div class="bar-chart-scroll" tabindex="0" role="region" aria-label="${html(select.value === 'all' ? 'All professions' : builds[0]!.professionName)} build ${unit} chart"><div class="benchmark-bars" style="--bar-count:${builds.length}">
      ${builds
        .map((row) => {
          const value = metric === 'dps' ? row.benchmarkDps : hasBenchmarkApm(row) ? row.benchmarkApm : null;
          const label = `${row.professionName} · ${row.specialization} · ${row.label}: ${number.format(row.benchmarkDps)} DPS, ${hasBenchmarkApm(row) ? `${apmNumber.format(row.benchmarkApm)} APM` : 'APM unavailable'}`;
          const bar =
            value === null
              ? '<span class="benchmark-bar-missing">—</span>'
              : `<span class="benchmark-bar-fill"><span class="benchmark-bar-value">${formatter.format(value)}</span></span>`;
          return `<button type="button" class="benchmark-bar" data-bar-point="${benchmarks.indexOf(row)}" aria-expanded="false" aria-controls="benchmark-build-inspector-${metric}" style="${colorStyle(row)};--bar-height:${value === null ? 0 : (value / scale) * 100}%" aria-label="${html(label)}"><span class="benchmark-bar-column">${bar}</span><span class="benchmark-bar-label"><strong>${html(select.value === 'all' ? `${row.professionName} · ${row.specialization}` : row.specialization)}</strong><span>${html(row.label)}</span></span></button>`;
        })
        .join(
          ''
        )}</div></div>${inspectionMarkup('data-bar-detail')}</div>${buildInspectorMarkup(`benchmark-build-inspector-${metric}`)}</div>`;
      })
      .join('');
    if (inspectedBuild) openBuildInspector(inspectedBuild);
  }

  /** Use the same saved-build preview and workspace action from either chart surface. */
  function buildInspectorMarkup(id: string): string {
    return `<aside id="${id}" class="benchmark-build-inspector" aria-label="Build inspector" hidden><div class="benchmark-inspector-heading"><h3 data-inspector-title></h3><button type="button" data-close-build-inspector aria-label="Close build inspector">&#215;</button></div><p data-inspector-metrics></p><a class="benchmark-workspace-link" data-open-benchmark>Open in workspace</a><div class="benchmark-build-preview" data-build-preview aria-live="polite"></div></aside>`;
  }

  /** Inspect a hovered or focused benchmark inside the canvas, clearing details when inspection ends. */
  function inspectionMarkup(attribute: string): string {
    return `<div class="benchmark-inspection" hidden><span class="benchmark-inspection-dot" aria-hidden="true"></span><p ${attribute} role="status"></p><button type="button" data-dismiss-inspection aria-label="Close benchmark details">×</button></div>`;
  }

  for (const host of root.querySelectorAll<HTMLElement>('[data-apm-chart], [data-health-chart]')) {
    let pendingHide: ReturnType<typeof setTimeout> | undefined;
    const hide = (): void => {
      clearTimeout(pendingHide);
      host.querySelector<HTMLElement>('.benchmark-inspection')?.setAttribute('hidden', '');
      host.querySelectorAll('.is-selected').forEach((element) => element.classList.remove('is-selected'));
    };

    const dismiss = (): void => {
      const point = host.querySelector<HTMLButtonElement>('.is-selected');
      point?.focus({ preventScroll: true });
      hide();
    };

    // Real pointer movement changes inspection; DOM updates beneath a stationary cursor must not steal focus selection.
    for (const eventName of ['pointermove', 'focusin', 'click']) {
      host.addEventListener(eventName, (event) => {
        if ((event.target as Element).closest('.benchmark-inspection')) {
          clearTimeout(pendingHide);
          return;
        }

        const tableRow = (event.target as Element).closest<HTMLElement>('[data-apm-row]');
        const point = tableRow
          ? host.querySelector<HTMLButtonElement>(`[data-point="${tableRow.dataset.apmRow}"]`)
          : (event.target as Element).closest<HTMLButtonElement>('[data-point], [data-health-point]');
        if (!point) return;
        clearTimeout(pendingHide);
        if (event.type === 'pointermove' && point.classList.contains('is-selected')) return;

        host.querySelectorAll('.is-selected').forEach((element) => element.classList.remove('is-selected'));
        point.classList.add('is-selected');
        if (point.dataset.point !== undefined) {
          const index = Number(point.dataset.point);
          const linkedRow = host.querySelector<HTMLElement>(`[data-apm-row="${index}"]`)!;
          linkedRow.classList.add('is-selected');
          // Graph inspection reveals its row inside the table without scrolling the surrounding page.
          if (!tableRow) revealApmRow(index);
        }

        const inspection = host.querySelector<HTMLElement>('.benchmark-inspection')!;
        inspection.style.setProperty('--benchmark-color', point.style.getPropertyValue('--benchmark-color'));
        inspection.querySelector('p')!.textContent = point.getAttribute('aria-label');
        inspection.hidden = false;
      });
    }

    host.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('[data-dismiss-inspection]')) return;
      dismiss();
    });
    host.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dismiss();
    });
    // Leaving a mark must not pin its badge or move keyboard focus back into the chart.
    for (const eventName of ['pointerout', 'focusout'] as const) {
      host.addEventListener(eventName, (event) => {
        const next = event.relatedTarget;
        if (next instanceof Element && host.contains(next) && next.closest('.benchmark-inspection, .is-selected'))
          return;
        // Allow the pointer to cross the small gap into the adjacent preview without dismissing it mid-flight.
        if (event.type === 'pointerout') pendingHide = setTimeout(hide, 150);
        else hide();
      });
    }

    host.addEventListener('pointerleave', hide);
  }

  apmChart.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-close-build-inspector]')) return closeApmInspector();
    const row = target.closest<HTMLElement>('[data-apm-row]');
    const point = target.closest<HTMLElement>('[data-point]');
    if (row || point)
      openApmInspector(apmRows[Number(row?.dataset.apmRow ?? point!.dataset.point)]!, row ? 'table' : 'graph');
  });
  apmChart.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeApmInspector();
  });

  root.querySelector('[data-bar-profession]')!.addEventListener('change', () => {
    root.querySelector<HTMLSelectElement>('[data-bar-specialization]')!.value = 'all';
    render();
  });
  root.querySelector('[data-bar-specialization]')!.addEventListener('change', render);

  const barChart = root.querySelector<HTMLElement>('[data-bar-chart]')!;
  /** Keep hover lightweight and transient; only explicit activation opens or changes the saved-build inspector. */
  function hideBarHover(): void {
    barChart.querySelectorAll('.benchmark-inspection').forEach((hover) => hover.setAttribute('hidden', ''));
    barChart.querySelector('.is-selected')?.classList.remove('is-selected');
  }

  function showBarHover(point: HTMLButtonElement): void {
    hideBarHover();
    point.classList.add('is-selected');
    const hover = point.closest('.bar-chart-layout')!.querySelector<HTMLElement>('.benchmark-inspection')!;
    hover.style.setProperty('--benchmark-color', point.style.getPropertyValue('--benchmark-color'));
    hover.querySelector('p')!.textContent = point.getAttribute('aria-label');
    hover.hidden = false;
  }

  function keepBarVisible(point: HTMLElement): void {
    const scroll = point.closest<HTMLElement>('.bar-chart-scroll')!;
    const viewport = scroll.getBoundingClientRect();
    const bar = point.getBoundingClientRect();
    if (bar.left < viewport.left) scroll.scrollLeft -= viewport.left - bar.left + 8;
    else if (bar.right > viewport.right) scroll.scrollLeft += bar.right - viewport.right + 8;
  }

  function openBuildInspector(row: Benchmark, metric = inspectedMetric): void {
    inspectedBuild = row;
    inspectedMetric = metric;
    const layout = barChart.querySelector<HTMLElement>(`[data-bar-metric="${metric}"]`)!;
    const inspector = layout.querySelector<HTMLElement>('.benchmark-build-inspector')!;
    const point = layout.querySelector<HTMLButtonElement>(`[data-bar-point="${benchmarks.indexOf(row)}"]`)!;
    // Only the activated chart reserves inspector space; opening the other chart restores the previous one's width.
    barChart
      .querySelectorAll('.bar-chart-layout')
      .forEach((chart) => chart.classList.toggle('has-build-inspector', chart === layout));
    barChart.querySelectorAll<HTMLElement>('.benchmark-build-inspector').forEach((panel) => {
      panel.hidden = panel !== inspector;
    });
    barChart.querySelectorAll<HTMLButtonElement>('[data-bar-point]').forEach((bar) => {
      bar.setAttribute('aria-expanded', String(bar === point));
      bar.classList.toggle('is-inspected', bar === point);
    });
    inspector.hidden = false;
    populateBuildInspector(inspector, row, () => inspectedBuild === row && inspectedMetric === metric);
    hideBarHover();
    keepBarVisible(point);
  }

  /** Load details only after activation, sharing the cached preview across charts. */
  function populateBuildInspector(inspector: HTMLElement, row: Benchmark, isCurrent: () => boolean): void {
    inspector.style.setProperty('--benchmark-color', colors.get(row)!);
    inspector.querySelector('[data-inspector-title]')!.textContent = `${row.specialization} · ${row.label}`;
    inspector.querySelector('[data-inspector-metrics]')!.textContent =
      `${number.format(row.benchmarkDps)} DPS · ${hasBenchmarkApm(row) ? `${apmNumber.format(row.benchmarkApm)} APM` : 'APM unavailable'}`;
    inspector.querySelector<HTMLAnchorElement>('[data-open-benchmark]')!.href = benchmarkWorkspaceHref(row);
    const preview = inspector.querySelector<HTMLElement>('[data-build-preview]')!;
    preview.dataset.build = row.build;
    preview.textContent = 'Loading build…';
    // Late requests cannot replace another selection or repopulate a closed inspector.
    void benchmarkBuildPreview(row).then(
      (markup) => {
        if (preview.isConnected && isCurrent()) preview.innerHTML = markup;
      },
      () => {
        if (preview.isConnected && isCurrent()) preview.textContent = 'Build preview unavailable.';
      }
    );
  }

  function closeBuildInspector(): void {
    const point = barChart.querySelector<HTMLButtonElement>('.is-inspected');
    inspectedBuild = null;
    barChart.querySelectorAll('.benchmark-build-inspector').forEach((panel) => panel.setAttribute('hidden', ''));
    barChart.querySelectorAll('.bar-chart-layout').forEach((chart) => chart.classList.remove('has-build-inspector'));
    if (point) {
      point.classList.remove('is-inspected');
      point.setAttribute('aria-expanded', 'false');
      point.focus({ preventScroll: true });
      keepBarVisible(point);
    }

    hideBarHover();
  }

  barChart.addEventListener('pointermove', (event) => {
    const target = event.target as Element;
    const point = target.closest<HTMLButtonElement>('[data-bar-point]');
    if (point && target.closest('.benchmark-bar-fill, .benchmark-bar-label')) showBarHover(point);
    else hideBarHover();
  });
  barChart.addEventListener('pointerleave', hideBarHover);
  /** Translate vertical mouse-wheel input over the overflowing bars, retaining native trackpad and page-edge scrolling. */
  barChart.addEventListener(
    'wheel',
    (event) => {
      const scroll = (event.target as Element).closest<HTMLElement>('.bar-chart-scroll');
      if (!scroll || event.ctrlKey) return;
      hideBarHover();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? scroll.clientWidth
            : 1;
      const next = Math.max(
        0,
        Math.min(scroll.scrollWidth - scroll.clientWidth, scroll.scrollLeft + event.deltaY * unit)
      );
      if (next === scroll.scrollLeft) return;
      event.preventDefault();
      scroll.scrollLeft = next;
      hideBarHover();
    },
    { passive: false }
  );
  barChart.addEventListener('focusin', (event) => {
    const point = (event.target as Element).closest<HTMLButtonElement>('[data-bar-point]');
    if (point) showBarHover(point);
    else hideBarHover();
  });
  barChart.addEventListener('focusout', hideBarHover);
  barChart.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-close-build-inspector]')) return closeBuildInspector();
    if (target.closest('[data-dismiss-inspection]')) return hideBarHover();
    const point = target.closest<HTMLButtonElement>('[data-bar-point]');
    if (point && (event.detail === 0 || target.closest('.benchmark-bar-fill, .benchmark-bar-label'))) {
      openBuildInspector(
        benchmarks[Number(point.dataset.barPoint)]!,
        point.closest<HTMLElement>('[data-bar-metric]')!.dataset.barMetric!
      );
    }
  });
  barChart.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (inspectedBuild) closeBuildInspector();
    else hideBarHover();
  });

  /** Load only lightweight manifests; one unavailable profession must not prevent comparison of the others. */
  async function load(): Promise<void> {
    root.setAttribute('aria-busy', 'true');
    retry.disabled = true;
    status.textContent = 'Loading profession benchmarks…';
    const results = await Promise.allSettled(
      professionRegistry.map(async (entry) => {
        const response = await fetch(`data/gw2/builds/${entry.id}/manifest.json`);
        if (!response.ok) throw new Error(`Could not load ${entry.name}`);
        return readBenchmarks(entry, await response.json());
      })
    );
    benchmarks = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    colors = benchmarkColors(benchmarks);
    failures = results.flatMap((result, index) =>
      result.status === 'rejected' ? [professionRegistry[index]!.name] : []
    );
    root.setAttribute('aria-busy', 'false');
    retry.disabled = false;
    render();
  }

  root.querySelector('[data-profession-filters]')!.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
    render();
  });
  /** The overview uses a compact profession picker or tabs, sharing selection with the chart filters. */
  function selectOverviewProfession(profession: string): void {
    selected.clear();
    professionRegistry.forEach(({ id }) => {
      if (profession === 'all' || profession === id) selected.add(id);
    });
    root.querySelectorAll<HTMLInputElement>('[data-profession-filters] input').forEach((input) => {
      input.checked = selected.has(input.value);
    });
    render();
  }

  root.querySelector<HTMLSelectElement>('select[data-overview-profession]')!.addEventListener('change', (event) => {
    selectOverviewProfession((event.target as HTMLSelectElement).value);
  });
  search.addEventListener('input', render);
  for (const input of [damage, role, outdated]) input.addEventListener('change', render);
  sort.addEventListener('change', () => {
    buildSortAscending = sort.value !== 'dps';
    render();
  });
  root.querySelector('[data-reset-filters]')!.addEventListener('click', () => {
    search.value = '';
    damage.value = role.value = 'all';
    // Reset restores the same alphabetical profession order used on first opening the tool.
    sort.value = 'name';
    buildSortAscending = true;
    root.querySelector<HTMLSelectElement>('[data-health-builds]')!.value = 'top';
    root.querySelector<HTMLSelectElement>('[data-health-metric]')!.value = 'cumulative';
    root.querySelector<HTMLSelectElement>('[data-health-phase]')!.value = 'all';
    healthSort = 'name';
    healthAscending = true;
    root.querySelector<HTMLSelectElement>('[data-bar-profession]')!.value = 'all';
    root.querySelector<HTMLSelectElement>('[data-bar-specialization]')!.value = 'all';
    outdated.checked = false;
    professionRegistry.forEach(({ id }) => selected.add(id));
    root.querySelectorAll<HTMLInputElement>('[data-profession-filters] input').forEach((input) => {
      input.checked = true;
    });
    render();
  });
  retry.addEventListener('click', () => {
    void load();
  });
  // Chart selection stays local to this tool and never overwrites the simulator's view hash.
  function showPanel(name: string): void {
    root.dataset.benchmarkActivePanel = name;
    search.placeholder = name === 'builds' ? 'Search builds…' : 'Find builds';
    root.querySelectorAll<HTMLElement>('[data-chart-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.chartPanel !== name;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-benchmark-panel]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.benchmarkPanel === name));
    });
  }

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const view = target.closest<HTMLElement>('[data-build-view]')?.dataset.buildView;
    if (view) {
      root.dataset.buildView = view;
      cards.hidden = view !== 'cards';
      buildTable.hidden = view !== 'table';
      root.querySelectorAll<HTMLElement>('[data-build-view]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.buildView === view));
      });
    }

    const overviewProfession = target.closest<HTMLButtonElement>('button[data-overview-profession]')?.dataset
      .overviewProfession;
    if (overviewProfession) selectOverviewProfession(overviewProfession);

    const buildSort = target.closest<HTMLElement>('[data-build-sort]')?.dataset.buildSort;
    if (buildSort) {
      buildSortAscending = sort.value === buildSort ? !buildSortAscending : buildSort !== 'dps';
      sort.value = buildSort;
      render();
      buildTable.querySelector<HTMLElement>(`[data-build-sort="${buildSort}"]`)!.focus({ preventScroll: true });
    }

    const panel = target.closest<HTMLElement>('[data-benchmark-panel]')?.dataset.benchmarkPanel;
    if (panel) showPanel(panel);
    const profession = target.closest<HTMLElement>('[data-profession-bars]')?.dataset.professionBars;
    if (profession) {
      root.querySelector<HTMLSelectElement>('[data-bar-profession]')!.value = profession;
      root.querySelector<HTMLSelectElement>('[data-bar-specialization]')!.value = 'all';
      render();
      showPanel('profession');
      root.querySelector<HTMLSelectElement>('[data-bar-profession]')!.focus();
    }
  });
  void load();
}
