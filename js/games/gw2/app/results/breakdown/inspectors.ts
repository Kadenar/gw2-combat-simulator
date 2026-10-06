import { escapeHtml } from '#ui/shared/html.js';
import { resultNumber as number } from '#gw2/app/results/formatting.js';
import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { mountHitTimeline } from '#gw2/app/results/charts/hit-timeline-view.js';
import type { ChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import type { DamageBreakdownModel } from '#gw2/app/results/breakdown/model.js';

/** Rebuilds the selected row's inspector after sorting, preserving its selected identity and proc attribution. */
export function renderSkillInspector(
  container: HTMLElement,
  selectedSkillKey: string | null,
  model: DamageBreakdownModel
): void {
  const { chartSeries, skillRows } = model;
  const rowsRoot = container.querySelector<HTMLElement>('[data-role="skill-rows"]');
  if (!rowsRoot) return;
  rowsRoot.querySelector('[data-role="skill-timeline"]')?.remove();
  if (!selectedSkillKey || !chartSeries) return;
  const hits = chartSeries.skillDamage?.[selectedSkillKey] || [];
  // List only activations of the selected effect so its count and sources exclude downstream procs.
  const selectedRow = skillRows.find((row) => row.key === selectedSkillKey);
  const skillName = String(selectedRow?.sourceSkill || selectedRow?.name || '');
  const applications = chartSeries.skillApplications?.[skillName] || [];
  const procs = (model.procSteps || [])
    .filter((proc) => selectedRow?.group === 'Player' && proc.skill === selectedRow.sourceSkill)
    .sort((left, right) => left.start - right.start);
  if (!hits.length && !procs.length) return;
  let target: HTMLElement | null = null;
  for (const rowElement of rowsRoot.querySelectorAll<HTMLElement>('.res-row-selectable')) {
    if (rowElement.dataset.skillKey === selectedSkillKey) {
      target = rowElement;
      break;
    }
  }

  const doc = container.ownerDocument;
  if (!target || !doc || typeof target.after !== 'function') return;
  const timeline = doc.createElement('div');
  timeline.className = 'res-skill-timeline';
  timeline.setAttribute('data-role', 'skill-timeline');
  target.after(timeline);
  if (procs.length) {
    // Group activations by their trigger so each skill can disclose its own chronological proc times.
    const timesBySource = new Map<string, number[]>();
    for (const proc of procs) {
      const times = timesBySource.get(proc.sourceSkill) || [];
      times.push(proc.start);
      timesBySource.set(proc.sourceSkill, times);
    }

    // Scroll each timestamp list independently so trigger summaries stay outside the scrolling area.
    timeline.innerHTML = `<div data-role="skill-procs">
        <div class="chart-panel-title">Procs (${procs.length})</div>
        ${[...timesBySource]
          .map(([source, times]) => {
            const damage = selectedRow?.procDamage?.find((entry) => entry.sourceSkill === source);
            // Missing attribution remains unknown rather than estimating damage from activation counts.
            return `<details>
              <summary>${escapeHtml(source || '\u2014')} \u2014 ${times.length} ${times.length === 1 ? 'proc' : 'procs'} \u2014 (${damage ? number(damage.total) : '\u2014'} damage | ${damage ? number(damage.dps) : '\u2014'} DPS)</summary>
              <div class="hit-detail-table">
                <table>
                  <thead><tr><th scope="col">Time</th></tr></thead>
                  <tbody>${times.map((time) => `<tr><td>${(time / 1000).toFixed(3)}s</td></tr>`).join('')}</tbody>
                </table>
              </div>
            </details>`;
          })
          .join('')}
      </div>`;
  }

  if (hits.length) {
    const damageTimeline = doc.createElement('div');
    timeline.append(damageTimeline);
    // Pair strikes with their pulse applications; later condition payouts do not represent pulse empowerment.
    const empowerment = new Map(applications.map((application) => [application.t, application.empowered]));
    const pulseHits = hits.map((hit) =>
      hit.damageType !== 'condition' && empowerment.has(hit.t) ? { ...hit, empowered: empowerment.get(hit.t) } : hit
    );
    mountHitTimeline(damageTimeline, pulseHits, {
      durationMs: chartSeries.durationMs,
      label: 'Damage Events'
    });
  }
}

/** Binds condition dialogs locally so close restores the triggering row's focus and disclosure state. */
export function bindConditionInspectors(container: HTMLElement, chartSeries: ChartSeries | null | undefined): void {
  // A viewport-sized inspector keeps attribution readable independently of the narrow condition column.
  let selectedCondition: string | null = null;
  const conditionRows = container.querySelectorAll<HTMLElement>('[data-condition-name]');
  const selectCondition = (row: HTMLElement): void => {
    const name = row.dataset.conditionName!;
    selectedCondition = selectedCondition === name ? null : name;
    container.querySelector<HTMLDialogElement>('[data-role="condition-inspector"]')?.close();
    for (const conditionRow of conditionRows) {
      const active = conditionRow.dataset.conditionName === selectedCondition;
      conditionRow.classList.toggle('res-row-selected', active);
      conditionRow.setAttribute('aria-expanded', String(active));
    }

    if (!selectedCondition || !chartSeries) return;
    const dialog = container.ownerDocument.createElement('dialog');
    dialog.className = 'condition-inspector';
    dialog.dataset.role = 'condition-inspector';
    dialog.setAttribute('aria-label', `${name} damage inspector`);
    dialog.innerHTML = `<div class="condition-inspector-heading"><div><h2>${escapeHtml(name)} damage</h2></div><button type="button" class="hit-detail-close" data-dialog-close aria-label="Close condition inspector" autofocus>Close</button></div>`;
    const timeline = container.ownerDocument.createElement('div');
    timeline.className = 'condition-inspector-body';
    timeline.dataset.role = 'condition-timeline';
    timeline.setAttribute('role', 'region');
    timeline.setAttribute('aria-label', `${name} damage ticks`);
    dialog.append(timeline);
    container.append(dialog);
    bindDialog(dialog);
    dialog.addEventListener(
      'close',
      () => {
        selectedCondition = null;
        row.classList.remove('res-row-selected');
        row.setAttribute('aria-expanded', 'false');
        dialog.remove();
        row.focus({ preventScroll: true });
      },
      { once: true }
    );
    showDialog(dialog);
    mountHitTimeline(timeline, chartSeries.conditionDamage?.[name] || [], {
      durationMs: chartSeries.durationMs,
      label: `${name} damage · fight time`,
      timeLabel: 'fight time',
      inspectAllTicks: true
    });
  };

  for (const row of conditionRows) {
    row.onclick = () => selectCondition(row);
    row.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCondition(row);
      }
    };
  }
}
