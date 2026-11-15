/** Select multiple relics through the shared equipment picker and keep edits independent of calculation. */
import { bindRelicComparisonChartHover, relicComparisonChartSvg } from '#gw2/app/optimizer/relic-comparison/chart.js';
import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import { MAX_RELIC_COMPARISON_ALTERNATIVES } from '#gw2/app/optimizer/relic-comparison/types.js';
import { relicOptionLabel } from '#gw2/app/shared/equipment/labels.js';
import { bindCandidatePickers, candidatePicker, updatePicker } from '#gw2/app/shared/equipment/picker.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { RELIC_GROUPS } from '#gw2/platform/equipment/relics/catalog.js';
import { escapeHtml } from '#ui/shared/html.js';

export interface RelicComparisonPanelModel {
  readonly relicComparison?: RelicComparisonModel | null;
  readonly relicComparisonAvailable?: boolean;
  readonly relicComparisonPending?: boolean;
  readonly relicComparisonError?: string;
  readonly relicComparisonOpponent?: string;
  readonly relicComparisonSelected?: readonly string[];
  readonly relicComparisonTargets?: readonly string[];
  readonly relicComparisonInitialStacks?: number;
}

export function mountRelicComparison(
  container: HTMLElement,
  model: RelicComparisonPanelModel,
  onRunRelicComparison?: (relics: readonly string[], initialStacks: number) => unknown,
  onSelect?: (relics: readonly string[], initialStacks: number) => boolean
): void {
  if (!model.relicComparisonAvailable) {
    container.innerHTML = '';
    return;
  }

  const targets = model.relicComparisonTargets ?? [];
  const names = RELIC_GROUPS.flatMap((group) => group.items.filter((name) => targets.includes(name)));
  const selected = [...new Set(model.relicComparisonSelected ?? [])].filter((name) => names.includes(name));
  const stacks = Math.min(10, Math.max(0, Math.trunc(Number(model.relicComparisonInitialStacks) || 0)));
  const comparison = model.relicComparison;
  const error = model.relicComparisonError;
  // Readiness belongs to the rendered baseline, so picker edits cannot enable a stale comparison.
  const pending = model.relicComparisonPending === true;
  container.innerHTML = `<section class="relic-cmp">
    <div class="relic-cmp-heading"><h4>Relic break-even comparison</h4>
      <p>Compare up to ${MAX_RELIC_COMPARISON_ALTERNATIVES} relics against ${escapeHtml(model.relicComparisonOpponent ? `Relic of ${model.relicComparisonOpponent}` : 'your equipped relic')} across fight durations.</p></div>
    <div class="relic-cmp-manual">
      <div class="relic-cmp-picker" data-role="relic-comparison-picker">${candidatePicker(
        'comparison-relics',
        'comparison relic',
        names,
        selected,
        {
          addLabel: '+ Add relic',
          limit: MAX_RELIC_COMPARISON_ALTERNATIVES,
          describe: relicOptionLabel,
          emptyLabel: 'Add relics to compare',
          heading: 'Compare with'
        }
      )}</div>
      <label class="relic-cmp-control" data-role="relic-comparison-stacks-control"${selected.includes('Thorns') ? '' : ' hidden'}>
        Starting Thorns stacks
        <input type="number" min="0" max="10" step="1" value="${stacks}" data-role="relic-comparison-stacks" aria-label="Starting Thorns stacks" />
      </label>
      <button type="button" class="relic-cmp-run-button" data-role="relic-comparison-run"${selected.length && !pending ? '' : ' disabled'}>${error ? 'Retry' : comparison ? 'Run again' : 'Run comparison'}</button>
    </div>
    <div data-role="relic-comparison-output">${error ? `<div class="relic-cmp-status relic-cmp-error">${escapeHtml(error)}</div>` : comparison ? relicComparisonChartSvg(comparison) : ''}</div>
  </section>`;

  if (comparison) bindRelicComparisonChartHover(container, comparison);

  const host = container.querySelector<HTMLElement>('[data-role="relic-comparison-picker"]');
  const button = container.querySelector<HTMLButtonElement>('[data-role="relic-comparison-run"]');
  const stackInput = container.querySelector<HTMLInputElement>('[data-role="relic-comparison-stacks"]');
  const stackControl = container.querySelector<HTMLElement>('[data-role="relic-comparison-stacks-control"]');
  const values = () =>
    host ? [...host.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => input.value) : selected;
  const selectionChanged = () => {
    const relics = values();

    if (stackControl) stackControl.hidden = !relics.includes('Thorns');

    // Clamped stack edits may leave the runner unchanged; retain its chart and button label.
    if (onSelect?.(relics, Number(stackInput?.value || 0)) === false) return;

    container.querySelector('[data-role="relic-comparison-output"]')?.replaceChildren();

    if (button) {
      button.textContent = 'Run comparison';
      button.disabled = pending || !relics.length;
    }
  };

  if (host) {
    bindCandidatePickers(host);
    host.querySelectorAll<HTMLElement>('[data-picker]').forEach(updatePicker);
    host.addEventListener('change', selectionChanged);
  }

  if (stackInput) stackInput.oninput = selectionChanged;

  if (button)
    button.onclick = () => {
      if (!pending && values().length) onRunRelicComparison?.(values(), Number(stackInput?.value || 0));
    };
}

/** Compares relics against the equipped workspace build and waits for its baseline to finish. */
export function renderRelicComparison(app: ProfessionAppState): void {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('optimizer-relic-comparison');

  if (!container || document.body?.dataset.simulatorView !== 'gear-optimizer') return;

  const runner = app.relicComparisonRunner;
  runner.schedule();

  // Keep the comparison UI empty until a rotation exists to compare.
  if (!app.build.rotation.length) {
    container.innerHTML = '';
    return;
  }

  if (!runner.available) {
    container.innerHTML =
      '<p class="optimizer-empty">Add a rotation and equip a relic in the <a href="#workspace">Workspace</a> to run a relic comparison.</p>';
    return;
  }

  mountRelicComparison(
    container,
    {
      relicComparison: runner.comparison,
      relicComparisonAvailable: runner.available,
      relicComparisonPending:
        app.analysis.state.simulationStatus !== 'idle' ||
        app.analysis.state.resultRevision !== app.analysis.state.buildRevision,
      relicComparisonError: runner.error,
      relicComparisonOpponent: app.build.relic,
      relicComparisonSelected: runner.comparisonRelics,
      relicComparisonTargets: app.relicNames.filter((name) => name !== app.build.relic),
      relicComparisonInitialStacks: runner.initialStacks
    },
    (relics, stacks) => app.runRelicComparison(relics, stacks),
    (relics, stacks) => runner.select(relics, stacks)
  );
}
