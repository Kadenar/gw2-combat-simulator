import { professionRegistry } from '#gw2/profession-registry.js';
import { escapeHtml as html } from '#ui/shared/html.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import type { Benchmark } from '#gw2/app/page/benchmarks.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';

export interface PatchBenchmark {
  readonly build: Benchmark;
  readonly previewDps: number;
  readonly difference: number;
  readonly percent: number;
  readonly outcome: 'up' | 'down' | 'same';
}

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
export function patchBenchmarks(rows: readonly Benchmark[], patchId: string | undefined): PatchBenchmark[] {
  if (!patchId) return [];
  return rows.flatMap((build) => {
    const preview = build.patchPreview;
    if (
      !build.rotation ||
      !preview ||
      preview.patchId !== patchId ||
      !Number.isFinite(preview.benchmarkDps) ||
      preview.benchmarkDps < 0 ||
      !Number.isFinite(build.benchmarkDps) ||
      build.benchmarkDps <= 0 ||
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
  largestGain: PatchBenchmark | undefined;
  largestLoss: PatchBenchmark | undefined;
} {
  const gains = rows.filter((row) => row.outcome === 'up').sort((a, b) => b.percent - a.percent);
  const losses = rows.filter((row) => row.outcome === 'down').sort((a, b) => a.percent - b.percent);
  return {
    winners: gains.length,
    losers: losses.length,
    unchanged: rows.filter((row) => row.outcome === 'same').length,
    largestGain: gains[0],
    largestLoss: losses[0]
  };
}

/** Group alphabetically, then rank changes within a specialization without splitting its build rows. */
export function sortPatchBenchmarks(rows: readonly PatchBenchmark[], sort: string): PatchBenchmark[] {
  return [...rows].sort(
    (a, b) =>
      a.build.professionName.localeCompare(b.build.professionName) ||
      a.build.specialization.localeCompare(b.build.specialization) ||
      (sort === 'gains'
        ? b.percent - a.percent
        : sort === 'losses'
          ? a.percent - b.percent
          : sort === 'dps'
            ? b.previewDps - a.previewDps
            : Math.abs(b.percent) - Math.abs(a.percent)) ||
      a.build.label.localeCompare(b.build.label) ||
      a.build.build.localeCompare(b.build.build) ||
      (a.build.rotation || '').localeCompare(b.build.rotation || '')
  );
}

/** Render captured results only; the lightweight preview panel never starts a simulation. */
export function mountBenchmarkPatchPreview(
  panel: HTMLElement,
  preview: Pick<PatchPreview, 'id'> | null,
  selectProfession: (id: string) => void
): { update: (rows: readonly Benchmark[], profession: string) => void; reset: () => void } {
  // Start with comparison controls; profession headers carry the relevant change summaries.
  panel.innerHTML = `    <div class="benchmark-section-heading health-heading"><div class="benchmark-health-controls">
      <label class="benchmark-sort">Show <select data-patch-outcome><option value="all">All changes</option><option value="up">Winners</option><option value="down">Losers</option><option value="same">Unchanged</option></select></label>
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
        if (collapsed) button.setAttribute('aria-describedby', summary.id);
        else button.removeAttribute('aria-describedby');
      }
    });
    panel.querySelectorAll<HTMLElement>('[data-patch-group]').forEach((group) => {
      const professionClosed = collapsedGroups.has(JSON.stringify(['profession', group.dataset.patchGroup]));
      group.querySelectorAll<HTMLElement>('[data-patch-section-key]').forEach((row) => {
        row.hidden =
          professionClosed || (row.hasAttribute('data-patch-row') && collapsedGroups.has(row.dataset.patchSectionKey!));
      });
    });
  }

  /** Highlight both directions independently so a profession with mixed results is not labeled a single winner or loser. */
  function professionSummaryMarkup(builds: readonly PatchBenchmark[], id: string): string {
    const summary = patchProfessionSummary(builds);
    const highlight = (row: PatchBenchmark, label: string): string =>
      `<span>${label}: ${html(row.build.specialization)} · ${html(row.build.label)} <strong class="patch-${row.outcome}">${html(patchPercent(row.percent))} (${row.difference > 0 ? '+' : '−'}${number.format(Math.abs(row.difference))} DPS)</strong></span>`;
    const counts =
      summary.winners || summary.losers
        ? `<span>Matching builds: <span class="patch-up">${summary.winners} higher</span> · <span class="patch-down">${summary.losers} lower</span> · ${summary.unchanged} unchanged</span>`
        : `<span>No DPS changes in ${summary.unchanged} matching build${summary.unchanged === 1 ? '' : 's'}.</span>`;
    return `<span class="benchmark-patch-profession-summary" id="patch-summary-${html(id)}" data-patch-profession-summary>${counts}${summary.largestGain ? highlight(summary.largestGain, 'Largest gain') : ''}${summary.largestLoss ? highlight(summary.largestLoss, 'Largest loss') : ''}</span>`;
  }

  function render(): void {
    const comparisons = patchBenchmarks(population, preview?.id);
    const rows = sortPatchBenchmarks(
      comparisons.filter((row) => outcome.value === 'all' || row.outcome === outcome.value),
      sort.value
    );
    const groups = groupRows(rows, (row) => row.build.profession);
    panel.querySelector('[data-patch-table]')!.innerHTML = rows.length
      ? `<div class="benchmark-patch-scroll" role="region" aria-label="Patch DPS changes" tabindex="0"><table class="benchmark-patch-table"><thead><tr><th scope="col">Build</th><th scope="col">Live DPS</th><th scope="col">Preview DPS</th><th scope="col">DPS change</th><th scope="col">Change %</th><th scope="col">Outcome</th></tr></thead>${[
          ...groups
        ]
          .map(([id, builds]) => {
            const specializations = groupRows(builds, (row) => row.build.specialization);
            const professionKey = html(JSON.stringify(['profession', id]));
            return `<tbody class="profession-card-${html(id)}" data-patch-group="${html(id)}"><tr class="benchmark-patch-profession"><th colspan="6" scope="rowgroup"><button type="button" class="benchmark-patch-toggle" data-patch-toggle="${professionKey}" aria-expanded="false" aria-label="${html(builds[0]!.build.professionName)}">${disclosureIcon}<span class="benchmark-patch-profession-heading">${html(builds[0]!.build.professionName)}${professionSummaryMarkup(builds, id)}</span></button></th></tr>${[
              ...specializations
            ]
              .map(([specialization, entries], index) => {
                const headingId = `patch-${id}-${index}`;
                const sectionKey = html(JSON.stringify(['specialization', id, specialization]));
                return `<tr class="benchmark-patch-specialization" data-patch-section-key="${sectionKey}"><th colspan="6" id="${headingId}"><button type="button" class="benchmark-patch-toggle" data-patch-toggle="${sectionKey}" aria-expanded="true">${disclosureIcon}<span>${html(specialization)}</span></button></th></tr>${entries.map((row) => `<tr data-patch-row data-patch-section-key="${sectionKey}"><th scope="row" headers="${headingId}">${html(row.build.label)}</th><td>${number.format(row.build.benchmarkDps)}</td><td>${number.format(row.previewDps)}</td><td class="patch-${row.outcome}">${row.difference > 0 ? '+' : row.difference < 0 ? '−' : ''}${number.format(Math.abs(row.difference))}</td><td class="patch-${row.outcome}">${html(patchPercent(row.percent))}</td><td class="patch-${row.outcome}">${row.outcome === 'up' ? 'Winner' : row.outcome === 'down' ? 'Loser' : 'Unchanged'}</td></tr>`).join('')}`;
              })
              .join('')}</tbody>`;
          })
          .join('')}</table></div>`
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
