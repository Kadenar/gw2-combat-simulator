import { bindRelicComparisonChartHover, relicComparisonChartSvg } from '#gw2/app/optimizer/relic-comparison/chart.js';
import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import { relicOptionLabel } from '#gw2/app/shared/equipment/labels.js';
import { enhanceDetailedSelect } from '#gw2/app/shared/equipment/picker.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { RELIC_GROUPS } from '#gw2/platform/equipment/relics/catalog.js';
import { escapeHtml } from '#ui/shared/html.js';
import { groupedOptionsHtml } from '#ui/shared/select-options.js';

export interface RelicComparisonPanelModel {
  readonly relicComparison?: RelicComparisonModel | null;
  readonly relicComparisonAvailable?: boolean;
  readonly relicComparisonError?: string;
  readonly relicComparisonOpponent?: string;
  readonly relicComparisonTarget?: string;
  readonly relicComparisonTargets?: readonly string[];
  readonly relicComparisonInitialStacks?: number;
}

/** Owns relic selection, simulation status and chart interaction independently of rotation results. */
export function mountRelicComparison(
  container: HTMLElement,
  model: RelicComparisonPanelModel,
  onRunRelicComparison?: (comparisonRelic: string, initialStacks: number) => unknown,
  onSelect?: (comparisonRelic: string, initialStacks: number) => boolean
): void {
  const relicComparison = model.relicComparison || null;
  const relicComparisonAvailable = model.relicComparisonAvailable === true;
  const relicComparisonError = String(model.relicComparisonError || '');
  const relicComparisonOpponent = String(model.relicComparisonOpponent || '');
  const relicComparisonTargets = model.relicComparisonTargets || [];
  // Match the gear selector's categories while keeping only available comparison relics.
  const relicComparisonGroups = RELIC_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((name) => relicComparisonTargets.includes(name))
  })).filter((group) => group.items.length);
  const requestedRelicComparisonTarget = String(model.relicComparisonTarget || '');
  const relicComparisonTarget = relicComparisonTargets.includes(requestedRelicComparisonTarget)
    ? requestedRelicComparisonTarget
    : String(relicComparisonTargets[0] || '');
  const relicComparisonInitialStacks = Math.min(
    10,
    Math.max(0, Math.trunc(Number(model.relicComparisonInitialStacks) || 0))
  );
  // Keep the closed selector compact; full relic descriptions remain searchable inside its menu.
  const relicComparisonAction = `<label class="relic-cmp-control">
          Compare with
          <span class="gear-select-display">
          <select id="relic-comparison-target" class="gear-select" data-role="relic-comparison-target" aria-label="Comparison relic">
            ${groupedOptionsHtml(relicComparisonGroups, relicComparisonTarget, relicOptionLabel)}
          </select>
          <button type="button" class="gear-select-trigger">${escapeHtml(relicComparisonTarget)}</button>
          </span>
        </label>
        <label class="relic-cmp-control" data-role="relic-comparison-stacks-control"${relicComparisonTarget === 'Thorns' ? '' : ' hidden'}>
          Starting stacks
          <input type="number" min="0" max="10" step="1" value="${relicComparisonInitialStacks}" data-role="relic-comparison-stacks" aria-label="Starting Thorns stacks" />
        </label>
        <button type="button" class="relic-cmp-run-button" data-role="relic-comparison-run">
          ${relicComparisonError ? 'Retry' : relicComparison ? 'Run again' : 'Run comparison'}
        </button>`;
  container.innerHTML = `${
    relicComparisonAvailable
      ? `<section class="relic-cmp">
    <div class="relic-cmp-heading">
      <div>
        <h4>Relic break-even comparison</h4>
        <p>Choose a relic to compare against ${escapeHtml(relicComparisonOpponent ? `Relic of ${relicComparisonOpponent}` : 'your equipped relic')} across fight durations.</p>
      </div>
    </div>
    <div class="relic-cmp-manual">${relicComparisonAction}</div>
    <div data-role="relic-comparison-output">${
      relicComparisonError
        ? `<div class="relic-cmp-status relic-cmp-error">${escapeHtml(relicComparisonError)}</div>`
        : relicComparison
          ? relicComparisonChartSvg(relicComparison, {
              opponentLabel: relicComparisonOpponent ? `Relic of ${relicComparisonOpponent}` : undefined
            })
          : ''
    }</div>
  </section>`
      : ''
  }`;

  if (relicComparison) bindRelicComparisonChartHover(container, relicComparison);

  const runRelicComparison = container.querySelector<HTMLElement>('[data-role="relic-comparison-run"]');
  const relicComparisonTargetInput = container.querySelector<HTMLSelectElement>(
    '[data-role="relic-comparison-target"]'
  );
  const relicComparisonStacksControl = container.querySelector<HTMLElement>(
    '[data-role="relic-comparison-stacks-control"]'
  );
  const stackInput = container.querySelector<HTMLInputElement>('[data-role="relic-comparison-stacks"]');
  // Commit control edits to the shared owner before a tab switch or baseline refresh can replace this panel.
  const selectionChanged = () => {
    if (!onSelect?.(relicComparisonTargetInput?.value || relicComparisonTarget, Number(stackInput?.value || 0))) return;

    // Remove stale output without replacing the focused picker or numeric input.
    container.querySelector('[data-role="relic-comparison-output"]')?.replaceChildren();

    if (runRelicComparison) runRelicComparison.textContent = 'Run comparison';
  };

  if (stackInput) stackInput.oninput = selectionChanged;

  if (relicComparisonTargetInput) {
    // Show only the selected relic's assumption controls.
    relicComparisonTargetInput.onchange = () => {
      if (relicComparisonStacksControl)
        relicComparisonStacksControl.hidden = relicComparisonTargetInput.value !== 'Thorns';

      selectionChanged();
    };
  }

  // Use the workspace's grouped, searchable equipment menu while keeping comparison values and handlers local.
  container.querySelectorAll<HTMLSelectElement>('select.gear-select').forEach((select) => {
    enhanceDetailedSelect(select, select.id);
  });

  if (runRelicComparison && typeof onRunRelicComparison === 'function') {
    runRelicComparison.onclick = () => {
      const initialStacks = container.querySelector<HTMLInputElement>('[data-role="relic-comparison-stacks"]');
      onRunRelicComparison?.(
        relicComparisonTargetInput?.value || relicComparisonTarget,
        Number(initialStacks?.value || 0)
      );
    };
  }
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
      relicComparisonError: runner.error,
      relicComparisonOpponent: app.build.relic,
      relicComparisonTarget: runner.comparisonRelic,
      relicComparisonTargets: app.relicNames.filter((name) => name !== app.build.relic),
      relicComparisonInitialStacks: runner.initialStacks
    },
    (relic, stacks) => app.runRelicComparison(relic, stacks),
    (relic, stacks) => runner.select(relic, stacks)
  );
  // A queued baseline must finish before its output can be used as the comparison opponent.
  const button = container.querySelector<HTMLButtonElement>('[data-role="relic-comparison-run"]');

  if (button && (app.simulationStatus !== 'idle' || app.resultRevision !== app.buildRevision)) button.disabled = true;
}
