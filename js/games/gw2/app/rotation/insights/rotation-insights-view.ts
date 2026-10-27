import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { bindRotationImportDialog } from '#gw2/app/import-export/rotation-import-dialog.js';
import type { RotationComparisonState, ComparisonWindowMode } from '#gw2/app/rotation/comparison-state.js';
import { analyzeRotationInsights } from '#gw2/app/rotation/insights/rotation-insights.js';
import type {
  RotationFinding,
  RotationInsights,
  ComparisonMetric
} from '#gw2/app/rotation/insights/rotation-insights-types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import { effectName } from '#gw2/app/results/model.js';

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function number(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function metricValue(metric: ComparisonMetric, amount: number): string {
  if (metric.unit === 'ratio') return `${number(amount * 100)}%`;

  return `${number(amount)}${metric.unit === 'seconds' ? 's' : ''}`;
}

const METRICS: Record<string, string> = {
  gap: 'Idle between skills',
  wait: 'Explicit waits',
  'failed-cast': 'Failed casts',
  uptime: 'Uptime',
  'average-stacks': 'Average stacks',
  'recorded-activations': 'Procs',
  'entry-delay': 'Delay before first damage',
  'unresolved-output': 'Interruptions without recorded output'
};

/** Keep the outline focused on deficits and their useful metrics, never internal component IDs or event packets. */
export function rotationLossOutline(report: RotationInsights) {
  const losses = report.findings.filter(
    (finding) => finding.category === 'skill-output' && finding.material && (finding.damageDifference ?? 0) < 0
  );
  const gains = report.findings.filter(
    (finding) => finding.category === 'skill-output' && finding.material && (finding.damageDifference ?? 0) > 0
  );
  const execution = report.findings
    .filter((finding) => finding.material && finding.category !== 'skill-output')
    .flatMap((finding) => {
      const effect = finding.effect;

      // Party projections and damaging-condition output do not explain the player's execution loss.
      if (
        effect &&
        (effect.origin === 'party-projection' ||
          (effect.recipient !== 'self' && effect.kind.toLowerCase() !== 'vulnerability'))
      )
        return [];

      const metric = finding.metrics.find(
        (metric) =>
          METRICS[metric.id] && (['buff', 'proc'].includes(finding.category) ? metric.delta < 0 : metric.delta > 0)
      );

      if (!metric) return [];

      const subject = effect ? (effect.name ?? effectName(effect.kind)) : finding.label;
      const label = ['buff', 'proc', 'cancellation'].includes(finding.category)
        ? `${subject}: ${METRICS[metric.id].toLowerCase()}`
        : METRICS[metric.id];
      return [
        {
          label,
          current: metricValue(metric, metric.current),
          reference: metricValue(metric, metric.reference),
          difference: `${metric.delta > 0 ? '+' : ''}${metric.unit === 'ratio' ? `${number(metric.delta * 100)} pp` : metricValue(metric, metric.delta)}`
        }
      ];
    });
  return { losses, gains, execution };
}

/** Describe extra or missing uses and hits in the same direction as the measured output change. */
export function rotationSkillDetail(finding: RotationFinding): string {
  const details: string[] = [];
  const gain = (finding.damageDifference ?? 0) > 0;
  for (const [id, name] of [
    ['uses', 'Uses'],
    ['strike-hits', 'Hits']
  ] as const) {
    const metric = finding.metrics.find((metric) => metric.id === id);

    if (!metric || (gain ? metric.delta <= 0 : metric.delta >= 0)) continue;

    details.push(
      `${name}: You ${number(metric.current)} / Reference ${number(metric.reference)} (${metric.delta > 0 ? '+' : ''}${number(metric.delta)})`
    );
  }

  return details.join(' · ') || (gain ? 'Higher damage; no extra uses or hits recorded.' : '');
}

function skillList(findings: readonly RotationFinding[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'insights-loss-list';
  for (const finding of findings) {
    const row = document.createElement('li');
    const name = text('span', finding.label);
    name.className = 'insights-skill-name';
    const delta = finding.damageDifference!;
    // A signed value in the damage column avoids repeating the same sentence for every skill.
    const amount = text('strong', `${delta > 0 ? '+' : ''}${number(delta)}`);
    amount.className = delta < 0 ? 'insights-loss' : 'insights-gain';
    amount.setAttribute('aria-label', `${number(Math.abs(delta))} ${delta < 0 ? 'less' : 'more'} damage`);
    const heading = document.createElement('div');
    heading.append(name, amount);
    row.append(heading);
    const detail = rotationSkillDetail(finding);

    if (detail) row.append(text('small', detail));

    list.append(row);
  }

  return list;
}

let reportDialog: {
  app: ProfessionAppState;
  session: RotationComparisonState;
  dialog: HTMLDialogElement;
  importDialog: HTMLDialogElement;
  content: HTMLElement;
  windowSelect: HTMLSelectElement;
  toolbar: HTMLElement;
  placeholder: HTMLElement;
  cached?: {
    current: Gw2SimulationResult;
    reference: Gw2SimulationResult;
    descriptor: object | null;
    patch: string;
    windowMode: ComparisonWindowMode;
  };
} | null = null;

/** Dispose both dialogs together when their owning comparison session ends. */
function disposeInsights(): void {
  reportDialog?.dialog.close();
  reportDialog?.dialog.remove();
  reportDialog?.importDialog.close();
  reportDialog?.importDialog.remove();
  reportDialog = null;
}

/** Insights UI is independent of the timeline layout and keeps its reference when dismissed. */
export function openRotationInsights(app: ProfessionAppState, refresh: () => void): void {
  const session = app.rotationComparison;

  if (!session) return;

  if (reportDialog?.session !== session || reportDialog.app !== app) {
    disposeInsights();
    const dialog = document.createElement('dialog');
    dialog.id = 'rotation-insights';
    dialog.setAttribute('aria-labelledby', 'rotation-insights-title');
    dialog.innerHTML = `<div class="rotation-insights-header">
      <h3 id="rotation-insights-title">Rotation insights</h3>
      <button type="button" class="btn" data-dialog-close aria-label="Close rotation insights">Close</button>
    </div>
    <div class="rotation-insights-toolbar">
      <button type="button" class="btn btn-io" data-insights-load>Load reference</button>
      <label>Compare <select data-insights-window aria-label="Comparison window">
        <option value="shared">Shared duration</option>
        <option value="full">Full runs</option>
      </select></label>
    </div>
    <input type="file" data-insights-file hidden>
    <div class="rotation-insights-placeholder">
      <svg class="insights-placeholder-icon" viewBox="0 0 80 64" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="78" height="62" rx="12"/>
        <path d="M16 18h48M16 46h48"/>
        <path class="insights-placeholder-current" d="M17 27h30"/>
        <path class="insights-placeholder-reference" d="M17 37h45"/>
      </svg>
      <p>Load a saved rotation or combat log to compare skill damage,<br class="insights-wide-break"> idle time, and buff uptime with your current rotation.</p>
      <button type="button" class="btn btn-io insights-load-primary" data-insights-start>Load reference</button>
    </div>
    <div class="rotation-insights-content"></div>`;
    document.body.append(dialog);
    bindDialog(dialog);
    const load = dialog.querySelector<HTMLButtonElement>('[data-insights-load]')!;
    const file = dialog.querySelector<HTMLInputElement>('[data-insights-file]')!;
    const windowSelect = dialog.querySelector<HTMLSelectElement>('[data-insights-window]')!;
    const importDialog = bindRotationImportDialog(app, load, file, 'reference');
    const content = dialog.querySelector<HTMLElement>('.rotation-insights-content')!;
    const toolbar = dialog.querySelector<HTMLElement>('.rotation-insights-toolbar')!;
    const placeholder = dialog.querySelector<HTMLElement>('.rotation-insights-placeholder')!;
    dialog.querySelector<HTMLButtonElement>('[data-insights-start]')!.onclick = () => load.click();
    reportDialog = { app, session, dialog, importDialog, content, windowSelect, toolbar, placeholder };
    // Native toggle also refreshes embedded dialogs whose opening waits for viewport positioning.
    dialog.addEventListener('toggle', () => {
      if (dialog.open) refresh();
    });
    // Window changes reanalyze existing results and never edit rotations or schedule another simulation.
    windowSelect.onchange = () => {
      session.windowMode = windowSelect.value === 'full' ? 'full' : 'shared';
      refresh();
    };
  }

  showDialog(reportDialog.dialog);
  refresh();
}

/** Refresh an existing report without opening it; tab changes and comparison exit dispose its stale reference UI. */
export function renderRotationInsights(app: ProfessionAppState, fresh: boolean): void {
  if (!reportDialog) return;

  const comparison = app.rotationComparison;

  if (reportDialog.app !== app || reportDialog.session !== comparison) {
    disposeInsights();
    return;
  }

  const { dialog: root, content, windowSelect, toolbar, placeholder } = reportDialog;

  // Dismissed insights keep their reference, but do no analysis or DOM work until reopened.
  if (!root.open) return;

  windowSelect.value = comparison.windowMode;
  const current = app.results,
    reference = comparison.referenceResult,
    descriptor = comparison.reference;
  const hasReference = comparison.referenceRotation.length > 0;
  placeholder.hidden = hasReference;
  toolbar.hidden = !hasReference;
  content.hidden = !hasReference;
  windowSelect.disabled = !fresh;

  if (!fresh || !current || !reference) {
    reportDialog.cached = undefined;
    const message =
      comparison?.referenceStatus === 'error'
        ? `Reference error: ${comparison.referenceError}`
        : app.simulationStatus === 'error'
          ? `Current error: ${app.simulationError}`
          : !hasReference
            ? 'Load a reference rotation to compare damage.'
            : 'Updating comparison...';
    const status = text('p', message);
    status.setAttribute('role', 'status');
    content.replaceChildren(status);
    return;
  }

  const cached = reportDialog.cached;

  if (
    cached?.current === current &&
    cached.reference === reference &&
    cached.descriptor === descriptor &&
    cached.patch === app.patch.id &&
    cached.windowMode === comparison.windowMode
  )
    return;

  try {
    const report = analyzeRotationInsights(current, reference, comparison.windowMode);
    const difference = report.runs.current.windowDamage - report.runs.reference.windowDamage;
    const overview = document.createElement('div');
    overview.className = 'rotation-insights-overview';
    const total = text(
      'strong',
      difference === 0
        ? 'Same damage as reference'
        : `${number(Math.abs(difference))} ${difference < 0 ? 'less' : 'more'} damage than reference`
    );
    total.className = difference < 0 ? 'insights-loss' : difference > 0 ? 'insights-gain' : '';
    overview.append(
      total,
      text(
        'p',
        `${descriptor?.label ?? 'Reference rotation'} · ${report.window.mode === 'full' ? `Full runs: You ${number(report.window.currentDuration)}s / Reference ${number(report.window.referenceDuration)}s` : `First ${number(report.window.currentDuration)}s of damage on both rotations`}`
      )
    );
    content.replaceChildren(overview);

    if (report.status !== 'ready') {
      content.append(
        text(
          'p',
          report.status === 'incompatible'
            ? 'Some skills could not execute with this build. Fix the invalid casts before comparing losses.'
            : 'No shared combat window to compare.'
        )
      );
    } else {
      const outline = rotationLossOutline(report);
      // Place the two short outlines together so skill losses and execution metrics can be scanned side by side.
      const columns = document.createElement('div');
      columns.className = 'rotation-insights-columns';
      const losses = document.createElement('section');
      losses.className = 'rotation-insights-section';
      losses.setAttribute('aria-label', 'Damage losses');
      losses.append(text('h4', 'Damage losses'));
      const labels = document.createElement('div');
      labels.className = 'insights-loss-labels';
      labels.append(text('span', 'Skill'), text('span', 'Damage change'));

      if (outline.losses.length) losses.append(labels);

      if (!outline.losses.length) losses.append(text('p', 'No significant damage losses.'));
      else losses.append(skillList(outline.losses.slice(0, 5)));

      if (outline.losses.length > 5) {
        const more = document.createElement('details');
        more.append(text('summary', `${outline.losses.length - 5} more skills`), skillList(outline.losses.slice(5)));
        losses.append(more);
      }

      columns.append(losses);

      if (outline.execution.length) {
        const execution = document.createElement('section');
        execution.className = 'rotation-insights-section';
        execution.setAttribute('aria-label', 'Execution differences');
        execution.append(text('h4', 'Execution differences'));
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const body = document.createElement('tbody');
        const header = document.createElement('tr');
        for (const label of ['Metric', 'You', 'Reference', 'Change']) {
          const cell = text('th', label);
          cell.scope = 'col';
          header.append(cell);
        }

        head.append(header);
        for (const metric of outline.execution) {
          const row = document.createElement('tr');
          for (const label of [metric.label, metric.current, metric.reference, metric.difference])
            row.append(text('td', label));
          body.append(row);
        }

        table.append(head, body);
        execution.append(table);
        columns.append(execution);
      }

      content.append(columns);

      if (outline.gains.length) {
        const gains = document.createElement('details');
        const gainedDamage = outline.gains.reduce((total, finding) => total + finding.damageDifference!, 0);
        gains.append(
          text('summary', `Offsetting gains: +${number(gainedDamage)} damage (${outline.gains.length} skills)`),
          text('p', 'Extra output from these skills offsets losses elsewhere.'),
          skillList(outline.gains)
        );
        content.append(gains);
      }
    }

    const warnings = [
      ...(descriptor?.warnings ?? []),
      ...report.runs.current.warnings.map((warning) => `Current: ${warning.message}`),
      ...report.runs.reference.warnings.map((warning) => `Reference: ${warning.message}`)
    ];

    if (warnings.length) {
      const notes = document.createElement('details');
      notes.append(text('summary', `Warnings (${warnings.length})`));
      for (const warning of warnings) notes.append(text('p', warning));
      content.append(notes);
    }

    const published = descriptor?.publishedBenchmarks?.[app.patch.id];

    if (published != null)
      content.append(
        text('small', `Published benchmark: ${number(published)} DPS. Losses above compare the simulated rotations.`)
      );

    reportDialog.cached = { current, reference, descriptor, patch: app.patch.id, windowMode: comparison.windowMode };
  } catch (error) {
    reportDialog.cached = undefined;
    content.replaceChildren(text('p', `Comparison error: ${error instanceof Error ? error.message : String(error)}`));
  }
}
