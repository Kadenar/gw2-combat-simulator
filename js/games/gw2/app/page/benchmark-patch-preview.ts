import { professionRegistry } from '#gw2/profession-registry.js';
import { templateCategory } from '#gw2/app/build/library/model.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';

interface MeasuredPatchBenchmark {
  readonly build: Benchmark;
  readonly previewDps: number;
  readonly difference: number;
  readonly percent: number;
  readonly outcome: 'up' | 'down' | 'same';
}

/** TBD rows deliberately carry no preview measurement, so they cannot enter numerical rankings. */
export type PatchBenchmark =
  | MeasuredPatchBenchmark
  | {
      readonly build: Benchmark;
      readonly outcome: 'tbd';
      readonly reason: string;
    };

type BenchmarkPreview = Pick<PatchPreview, 'id' | 'pendingBenchmarks'>;

/** Preserve the sorted rows while collecting contiguous profession or specialization groups. */
function groupRows(
  rows: readonly PatchBenchmark[],
  key: (row: PatchBenchmark) => string
): Map<string, PatchBenchmark[]> {
  const groups = new Map<string, PatchBenchmark[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }

  return groups;
}

/** Exclude unavailable or different-patch measurements without hiding the underlying live benchmark. */
export function patchBenchmarks(
  rows: readonly Benchmark[],
  patch: BenchmarkPreview | null | undefined
): PatchBenchmark[] {
  if (!patch) return [];
  return rows.flatMap<PatchBenchmark>((build) => {
    if (!build.rotation || !Number.isFinite(build.benchmarkDps) || build.benchmarkDps <= 0) return [];
    // Reworks remain discoverable before capture; exact build selectors keep weapon-specific flags narrowly scoped.
    const pending = patch.pendingBenchmarks?.find(
      (entry) =>
        entry.profession === build.profession &&
        entry.specialization === build.specialization &&
        (!entry.damage || entry.damage === templateCategory(build)) &&
        (!entry.build || entry.build === build.build)
    );
    if (pending) return [{ build, outcome: 'tbd', reason: pending.reason }];
    const preview = build.patchPreview;
    if (
      !preview ||
      preview.patchId !== patch.id ||
      !Number.isFinite(preview.benchmarkDps) ||
      preview.benchmarkDps < 0 ||
      !preview.benchmarkDpsByHealth ||
      Object.keys(preview.benchmarkDpsByHealth).length !== TARGET_HEALTH_BANDS.length ||
      !TARGET_HEALTH_BANDS.every(({ id }) => {
        const band = preview.benchmarkDpsByHealth[id];
        return (
          band &&
          Object.keys(band).length === 2 &&
          ['cumulative', 'phase'].every((mode) => {
            const value = band[mode as 'cumulative' | 'phase'];
            return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
          })
        );
      })
    )
      return [];
    const difference = preview.benchmarkDps - build.benchmarkDps;
    return [
      {
        build,
        previewDps: preview.benchmarkDps,
        difference,
        percent: (difference / build.benchmarkDps) * 100,
        outcome: difference > 0 ? ('up' as const) : difference < 0 ? ('down' as const) : ('same' as const)
      }
    ];
  });
}

/** Keep small nonzero changes readable instead of rounding them to an apparently unchanged result. */
export function patchPercent(value: number): string {
  if (!value) return '0.00%';
  return `${value > 0 ? '+' : '−'}${Math.abs(value) < 0.01 ? '<0.01' : Math.abs(value).toFixed(2)}%`;
}

/** Describe measured changes among the matching builds, without inferring which patch edits caused them. */
export function patchProfessionSummary(rows: readonly PatchBenchmark[]): {
  winners: number;
  losers: number;
  unchanged: number;
  pending: number;
  largestGain: MeasuredPatchBenchmark | undefined;
  largestLoss: MeasuredPatchBenchmark | undefined;
} {
  const measured = rows.filter((row) => row.outcome !== 'tbd');
  const gains = measured.filter((row) => row.outcome === 'up').sort((a, b) => b.percent - a.percent);
  const losses = measured.filter((row) => row.outcome === 'down').sort((a, b) => a.percent - b.percent);
  return {
    winners: gains.length,
    losers: losses.length,
    unchanged: rows.filter((row) => row.outcome === 'same').length,
    pending: rows.length - measured.length,
    largestGain: gains[0],
    largestLoss: losses[0]
  };
}

/** Group alphabetically, then rank changes within a specialization without splitting its build rows. */
export function sortPatchBenchmarks(rows: readonly PatchBenchmark[], sort: string): PatchBenchmark[] {
  // Pending builds stay after measured builds within their specialization, regardless of sort direction.
  const compareMeasurements = (a: PatchBenchmark, b: PatchBenchmark): number => {
    if (a.outcome === 'tbd' || b.outcome === 'tbd') return Number(a.outcome === 'tbd') - Number(b.outcome === 'tbd');
    return sort === 'gains'
      ? b.percent - a.percent
      : sort === 'losses'
        ? a.percent - b.percent
        : sort === 'dps'
          ? b.previewDps - a.previewDps
          : Math.abs(b.percent) - Math.abs(a.percent);
  };

  return [...rows].sort(
    (a, b) =>
      a.build.professionName.localeCompare(b.build.professionName) ||
      a.build.specialization.localeCompare(b.build.specialization) ||
      compareMeasurements(a, b) ||
      a.build.label.localeCompare(b.build.label) ||
      a.build.build.localeCompare(b.build.build) ||
      (a.build.rotation || '').localeCompare(b.build.rotation || '')
  );
}

/** Render captured results only; the lightweight preview panel never starts a simulation. */
export function mountBenchmarkPatchPreview(
  panel: HTMLElement,
  preview: BenchmarkPreview | null,
  selectProfession: (id: string) => void,
  workspaceHref: (build: Benchmark) => string
): { update: (rows: readonly Benchmark[], profession: string) => void; reset: () => void } {
  // Describe the direction of DPS changes without treating small differences as wins or losses.
  panel.innerHTML = `    <div class="benchmark-section-heading health-heading"><div class="benchmark-health-controls">
      <label class="benchmark-sort">Show <select data-patch-outcome><option value="all">All results</option><option value="up">DPS increases</option><option value="down">DPS decreases</option><option value="same">Unchanged</option><option value="tbd">Pending</option></select></label>
      <label class="benchmark-sort">Profession <select data-patch-profession><option value="all">All professions</option><option value="custom" disabled>Selected professions</option>${professionRegistry.map(({ id, name }) => `<option value="${id}">${name}</option>`).join('')}</select></label>
      <label class="benchmark-sort">Sort by <select data-patch-sort><option value="change">Largest changes</option><option value="gains">Biggest gains</option><option value="losses">Biggest losses</option><option value="dps">Highest preview DPS</option></select></label>
    </div></div><div data-patch-table></div>`;
  const outcome = panel.querySelector<HTMLSelectElement>('[data-patch-outcome]')!;
  const profession = panel.querySelector<HTMLSelectElement>('[data-patch-profession]')!;
  const sort = panel.querySelector<HTMLSelectElement>('[data-patch-sort]')!;
  // Begin with a compact profession overview; specialization groups remain expanded inside each profession.
  const collapsedGroups = new Set(professionRegistry.map(({ id }) => JSON.stringify(['profession', id])));
  let population: readonly Benchmark[] = [];
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const disclosureIcon =
    '<svg class="benchmark-patch-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';

  /** Keep each group's disclosure state independent of filtering, and preserve child choices while a parent is closed. */
  function applyCollapsedGroups(): void {
    panel.querySelectorAll<HTMLButtonElement>('[data-patch-toggle]').forEach((button) => {
      const collapsed = collapsedGroups.has(button.dataset.patchToggle!);
      button.setAttribute('aria-expanded', String(!collapsed));
      const summary = button.querySelector<HTMLElement>('[data-patch-profession-summary]');
      if (summary) {
        summary.hidden = !collapsed;
        const meta = button.querySelector<HTMLElement>('.benchmark-patch-profession-meta')!;
        button.setAttribute('aria-describedby', collapsed ? `${meta.id} ${summary.id}` : meta.id);
      }
    });
    panel.querySelectorAll<HTMLElement>('[data-patch-group]').forEach((group) => {
      const professionClosed = collapsedGroups.has(JSON.stringify(['profession', group.dataset.patchGroup]));
      group.querySelector<HTMLElement>('[data-patch-details]')!.hidden = professionClosed;
      group.querySelectorAll<HTMLElement>('[data-patch-section-key]').forEach((row) => {
        row.hidden =
          professionClosed || (row.hasAttribute('data-patch-row') && collapsedGroups.has(row.dataset.patchSectionKey!));
      });
    });
  }

  /** Spread outcomes and extremes across the row; pending reworks are counted separately from measured results. */
  function professionSummaryMarkup(builds: readonly PatchBenchmark[], id: string): string {
    const summary = patchProfessionSummary(builds);
    const highlight = (row: MeasuredPatchBenchmark | undefined, label: string): string =>
      `<span class="benchmark-patch-highlight"><span class="benchmark-patch-summary-label">${label}</span>${row ? `<span class="benchmark-patch-highlight-value"><strong class="patch-${row.outcome}">${html(patchPercent(row.percent))}</strong></span><span>${html(row.build.specialization)} · ${html(row.build.label)}</span><span class="patch-${row.outcome}">${row.difference > 0 ? '+' : '−'}${number.format(Math.abs(row.difference))} DPS</span>` : '<span class="benchmark-patch-no-change">None</span>'}</span>`;
    const counts = [
      { count: summary.winners, outcome: 'up', label: 'higher' },
      { count: summary.losers, outcome: 'down', label: 'lower' },
      { count: summary.unchanged, outcome: 'same', label: 'unchanged' },
      { count: summary.pending, outcome: 'tbd', label: 'TBD' }
    ];
    const outcomes =
      summary.winners || summary.losers || summary.pending
        ? `<span class="benchmark-patch-outcomes"><span class="benchmark-patch-summary-label">Build outcomes</span><span class="benchmark-patch-outcome-counts">${counts
            .filter(({ count, outcome }) => count || outcome !== 'tbd')
            .map(({ count, outcome, label }) => `<span class="patch-${outcome}">${count} ${label}</span>`)
            .join(
              ''
            )}</span>${summary.pending ? '<span class="patch-tbd">Rework pending · excluded from comparisons</span>' : ''}</span>`
        : '<span class="benchmark-patch-no-change">No DPS changes</span>';
    return `<span class="benchmark-patch-profession-heading"><span>${html(builds[0]!.build.professionName)}</span><span class="benchmark-patch-profession-meta" id="patch-meta-${html(id)}"><span>${builds.length} matching build${builds.length === 1 ? '' : 's'}</span>${summary.pending ? `<span class="benchmark-patch-badge patch-tbd">${summary.pending} TBD</span>` : ''}</span></span><span class="benchmark-patch-profession-summary" id="patch-summary-${html(id)}" data-patch-profession-summary>${outcomes}${summary.winners || summary.losers ? highlight(summary.largestGain, 'Largest gain') + highlight(summary.largestLoss, 'Largest loss') : ''}</span>`;
  }

  /** Share the dashboard's saved-build route so measured and pending rows open their exact build and rotation. */
  function workspaceLink(build: Benchmark): string {
    return `<a class="benchmark-workspace-link benchmark-patch-workspace-link" href="${html(workspaceHref(build))}" aria-label="Open in workspace: ${html(`${build.professionName} · ${build.specialization} · ${build.label}`)}">Open in workspace</a>`;
  }

  function render(): void {
    const comparisons = patchBenchmarks(population, preview);
    const rows = sortPatchBenchmarks(
      comparisons.filter((row) => outcome.value === 'all' || row.outcome === outcome.value),
      sort.value
    );
    const groups = groupRows(rows, (row) => row.build.profession);
    panel.querySelector('[data-patch-table]')!.innerHTML = rows.length
      ? `${[...groups]
          .map(([id, builds]) => {
            const specializations = groupRows(builds, (row) => row.build.specialization);
            const professionKey = html(JSON.stringify(['profession', id]));
            // Each disclosure owns its table so column headings and horizontal scrolling only appear when expanded.
            return `<section class="profession-card-${html(id)}" data-patch-group="${html(id)}"><div class="benchmark-patch-profession"><button type="button" class="benchmark-patch-toggle" data-patch-toggle="${professionKey}" aria-expanded="false" aria-controls="patch-details-${html(id)}" aria-label="${html(builds[0]!.build.professionName)}">${disclosureIcon}${professionSummaryMarkup(builds, id)}</button></div><div class="benchmark-patch-scroll" data-patch-details id="patch-details-${html(id)}" role="region" aria-label="${html(builds[0]!.build.professionName)} patch DPS changes" tabindex="0"><table class="benchmark-patch-table"><thead><tr><th scope="col">Build</th><th scope="col">Live DPS</th><th scope="col">Preview DPS</th><th scope="col">DPS change</th><th scope="col">Change %</th><th scope="col">Outcome</th></tr></thead>${[
              ...specializations
            ]
              .map(([specialization, entries], index) => {
                const headingId = `patch-${id}-${index}`;
                const sectionKey = html(JSON.stringify(['specialization', id, specialization]));
                return `<tbody><tr class="benchmark-patch-specialization" data-patch-section-key="${sectionKey}"><th colspan="6" id="${headingId}"><button type="button" class="benchmark-patch-toggle" data-patch-toggle="${sectionKey}" aria-expanded="true">${disclosureIcon}<span>${html(specialization)}</span></button></th></tr>${entries.map((row) => `<tr data-patch-row data-patch-section-key="${sectionKey}"><th scope="row" headers="${headingId}">${html(row.build.label)}${row.outcome === 'tbd' ? `<span class="benchmark-patch-pending-reason patch-tbd">${html(row.reason)}</span>` : ''}${workspaceLink(row.build)}</th><td>${number.format(row.build.benchmarkDps)}</td>${row.outcome === 'tbd' ? '<td class="patch-tbd">TBD</td><td class="patch-tbd">—</td><td class="patch-tbd">—</td><td class="patch-tbd">Pending</td>' : `<td>${number.format(row.previewDps)}</td><td class="patch-${row.outcome}">${row.difference > 0 ? '+' : row.difference < 0 ? '−' : ''}${number.format(Math.abs(row.difference))}</td><td class="patch-${row.outcome}">${html(patchPercent(row.percent))}</td><td class="patch-${row.outcome}">${row.outcome === 'up' ? 'Higher DPS' : row.outcome === 'down' ? 'Lower DPS' : 'Unchanged'}</td>`}</tr>`).join('')}</tbody>`;
              })
              .join('')}</table></div></section>`;
          })
          .join('')}`
      : '<p class="benchmark-empty">No preview benchmarks match these filters.</p>';
    applyCollapsedGroups();
  }

  // Toggle existing rows in place so mouse and keyboard activation retain focus on the same header button.
  panel.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-patch-toggle]');
    if (!button) return;
    const key = button.dataset.patchToggle!;
    if (collapsedGroups.has(key)) collapsedGroups.delete(key);
    else collapsedGroups.add(key);
    applyCollapsedGroups();
  });
  outcome.addEventListener('change', render);
  sort.addEventListener('change', render);
  profession.addEventListener('change', () => selectProfession(profession.value));
  return {
    update(rows, scope) {
      population = rows;
      profession.value = scope;
      render();
    },
    reset() {
      outcome.value = 'all';
      sort.value = 'change';
      collapsedGroups.clear();
      professionRegistry.forEach(({ id }) => collapsedGroups.add(JSON.stringify(['profession', id])));
    }
  };
}
