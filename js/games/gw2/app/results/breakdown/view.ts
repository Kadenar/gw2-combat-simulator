import { escapeHtml } from '#ui/shared/html.js';
import { resultNumber as number } from '#gw2/app/results/formatting.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import { bindConditionInspectors, renderSkillInspector } from '#gw2/app/results/breakdown/inspectors.js';
import {
  prepareDamageBreakdown,
  sortResultRows,
  nextResultSortState,
  type DamageBreakdownModel,
  type ResultRow,
  type ResultColumn,
  type ResultSortState
} from '#gw2/app/results/breakdown/model.js';

export interface DamageBreakdownOptions {
  readonly resolveSkillIcon?: (row: ResultRow) => string;
  readonly placeholderIcon?: string;
  readonly skillBreakdownClassName?: string;
  readonly sortState?: Partial<ResultSortState>;
  readonly onSortStateChange?: (state: ResultSortState) => unknown;
}

function skillCellHtml(row: ResultRow, column: ResultColumn, options: DamageBreakdownOptions): string {
  const value = row[column.key];
  if (column.key === 'name') {
    const icon = options.resolveSkillIcon?.(row) || options.placeholderIcon || '';
    // Keep breakdown skill labels passive so hovering does not open a tooltip over the results.
    return `<span class="res-skill"><img src="${escapeHtml(icon)}" alt="" />${escapeHtml(value)}</span>`;
  }

  const formatted = column.format
    ? column.format(value)
    : value == null
      ? '&mdash;'
      : column.numeric
        ? number(value)
        : escapeHtml(value);
  const classAttr = column.className ? ` class="${escapeHtml(column.className)}"` : '';
  const titleText = column.title ? column.title(value, row) : '';
  const titleAttr = titleText ? ` title="${escapeHtml(titleText)}"` : '';
  // Custom formatters return display text, not trusted HTML.
  return `<span${classAttr}${titleAttr}>${column.format ? escapeHtml(formatted) : formatted}</span>`;
}

function skillRowHtml(row: ResultRow, columns: readonly ResultColumn[], options: DamageBreakdownOptions): string {
  const skillKey = typeof row.key === 'string' ? row.key : '';
  const keyAttr = skillKey ? ` data-skill-key="${escapeHtml(skillKey)}" role="button" tabindex="0"` : '';
  const selectable = skillKey ? ' res-row-selectable' : '';
  return `<div class="res-row${selectable}"${keyAttr}>${columns
    .map((column) => skillCellHtml(row, column, options))
    .join('')}</div>`;
}

function skillRowsHtml(
  rows: readonly ResultRow[],
  columns: readonly ResultColumn[],
  options: DamageBreakdownOptions
): string {
  const hasGroups = rows.some((row) => typeof row.group === 'string' && row.group.trim());
  if (!hasGroups) {
    return rows.map((row) => skillRowHtml(row, columns, options)).join('');
  }

  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const group = typeof row.group === 'string' && row.group.trim() ? row.group.trim() : 'Other';
    const groupRows = grouped.get(group) || [];
    groupRows.push(row);
    grouped.set(group, groupRows);
  }

  const preferredOrder = new Map([
    ['Player', 0],
    ['Entities', 1],
    ['Environment', 2],
    ['Other', 3]
  ]);
  const groupNames = [...grouped.keys()].sort(
    (left, right) => (preferredOrder.get(left) ?? 3) - (preferredOrder.get(right) ?? 3)
  );
  const summaryColumns = new Set(['strike', 'condition', 'total', 'damagePercent', 'dps']);
  return groupNames
    .map((group) => {
      const groupRows = grouped.get(group) || [];
      return `<div class="res-skill-group-heading" data-skill-group="${escapeHtml(group)}">
      ${columns
        .map((column) => {
          if (column.key === 'name') {
            return `<span class="res-skill-group-name">${escapeHtml(group)}</span>`;
          }

          if (!summaryColumns.has(column.key)) {
            return '<span aria-hidden="true"></span>';
          }

          const total = groupRows.reduce((sum, row) => sum + Number(row[column.key] || 0), 0);
          const formatted = column.format ? String(column.format(total)) : number(total);
          const label = column.label || column.key;
          const classAttr = column.className ? ` ${escapeHtml(column.className)}` : '';
          return `<span class="res-skill-group-total${classAttr}" aria-label="${escapeHtml(`${group} ${label}: ${formatted}`)}">${escapeHtml(formatted)}</span>`;
        })
        .join('')}
    </div>${groupRows.map((row) => skillRowHtml(row, columns, options)).join('')}`;
    })
    .join('');
}

function skillHeaderHtml(columns: readonly ResultColumn[], sortState: ResultSortState): string {
  return columns
    .map((column) => {
      const indicator = sortState.column === column.key ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
      return `<span data-sort-col="${escapeHtml(column.key)}">${escapeHtml(column.label || column.key)}${indicator}</span>`;
    })
    .join('');
}

/** Renders an accessible native disclosure beside a metric label when contributor details are available. */

/** Appends the shared skill/condition card and keeps selection stable when its rows are sorted. */
export function mountDamageBreakdown(
  container: HTMLElement | null | undefined,
  model: DamageBreakdownModel,
  options: DamageBreakdownOptions = {}
): void {
  if (!container) return;
  const { skillRows, conditionGroups, conditionTotalShare } = prepareDamageBreakdown(model);
  const { skillColumns, conditions, chartSeries } = model;
  let sortState: ResultSortState = {
    column: options.sortState?.column || null,
    direction: options.sortState?.direction || null
  };
  const breakdownClassName = options.skillBreakdownClassName || 'skill-breakdown';
  const initialSkillRows = sortResultRows(skillRows, skillColumns, sortState.column, sortState.direction);

  container.insertAdjacentHTML(
    'beforeend',
    skillColumns.length || conditions.length
      ? `<section class="res-breakdown-section">
    <div class="res-breakdown">
      ${
        skillColumns.length
          ? `<div class="res-breakdown-part res-damage-breakdown">
      <div class="res-section-title">Damage Breakdown</div>
      <div class="${escapeHtml(breakdownClassName)}" data-role="skill-breakdown">
        <div class="res-hdr res-hdr-sortable" data-role="skill-header">
          ${skillHeaderHtml(skillColumns, sortState)}
        </div>
        <div class="res-skill-rows" data-role="skill-rows">${skillRowsHtml(initialSkillRows, skillColumns, options)}</div>
      </div>
    </div>`
          : ''
      }
      ${
        conditions.length
          ? `<div class="res-breakdown-part res-condition-breakdown">
      <div class="res-section-title">Conditions</div>
      <div class="cond-breakdown">
        ${conditionGroups
          .map(
            (group) => `<div class="res-condition-group${group.damaging ? '' : ' res-condition-group-utility'}">
          <div class="res-condition-group-title">${group.label}</div>
          <div class="res-hdr cond-hdr">
            <span>Condition</span>${group.damaging ? '<span>Damage</span><span>Share</span><span>DPS</span>' : ''}<span>Avg Stacks</span>${group.damaging ? '<span title="DPS divided by average stacks: average damage per second from one stack">Avg dmg / stack</span>' : ''}
          </div>
          ${group.conditions
            .map((condition) => {
              const selectable = Boolean(chartSeries?.conditionDamage?.[condition.name]?.length);
              // Keep condition labels tooltip-free while retaining the row's keyboard-accessible tick inspector.
              const icon = MODIFIER_EFFECT_ICONS[condition.name];
              return `<div class="res-row${selectable ? ' res-row-selectable' : ''}"${selectable ? ` role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-label="Inspect ${escapeHtml(condition.name)} ticks" data-condition-name="${escapeHtml(condition.name)}"` : ''}>
          <span class="res-skill condi">${icon ? `<img src="${escapeHtml(icon)}" alt="" />` : ''}${escapeHtml(condition.name)}</span>
          ${
            group.damaging
              ? `<span class="condi">${number(condition.damage)}</span>
          <span>${condition.damagePercent.toFixed(2)}%</span>
          <span class="dps">${number(condition.dps)}</span>`
              : ''
          }
          <span>${Number(condition.averageStacks || 0).toFixed(2)}</span>
          ${group.damaging ? `<span>${condition.averageDamagePerStack.toFixed(2)}</span>` : ''}
        </div>`;
            })
            .join('')}
        </div>`
          )
          .join('')}
        ${
          model.conditionTotal
            ? `<div class="res-row res-total">
          <span class="res-skill"><b>${escapeHtml(model.conditionTotal.label || 'Total Conditions')}</b></span>
          <span class="condi"><b>${number(model.conditionTotal.damage)}</b></span>
          <span><b>${conditionTotalShare.toFixed(2)}%</b></span>
          <span class="dps"><b>${number(model.conditionTotal.dps)}</b></span>
          <span></span>
          <span></span>
        </div>`
            : ''
        }
      </div>
    </div>`
          : ''
      }
    </div>
  </section>`
      : ''
  );

  const renderSortedRows = (): void => {
    const sorted = sortResultRows(skillRows, skillColumns, sortState.column, sortState.direction);
    const rowsElement = container.querySelector<HTMLElement>('[data-role="skill-rows"]');
    if (rowsElement) {
      rowsElement.innerHTML = skillRowsHtml(sorted, skillColumns, options);
      // Re-rendering discards row handlers; rebind selection and reapply it.
      bindSkillSelection();
    }

    const header = container.querySelector<HTMLElement>('[data-role="skill-header"]');
    if (header) {
      header.innerHTML = skillHeaderHtml(skillColumns, sortState);
      // Replacing header markup discards its handlers, so bind the new cells.
      bindSort();
    }
  };

  const bindSort = (): void => {
    const header = container.querySelector<HTMLElement>('[data-role="skill-header"]');
    for (const cell of header?.querySelectorAll<HTMLElement>('[data-sort-col]') || []) {
      cell.onclick = () => {
        sortState = nextResultSortState(sortState.column, sortState.direction, cell.dataset.sortCol || '');
        options.onSortStateChange?.({ ...sortState });
        renderSortedRows();
      };
    }
  };

  let selectedSkillKey: string | null = null;
  const applySkillRowSelection = (): void => {
    for (const rowElement of container.querySelectorAll<HTMLElement>('[data-role="skill-rows"] .res-row-selectable')) {
      const active = rowElement.dataset.skillKey === selectedSkillKey;
      rowElement.classList.toggle('res-row-selected', active);
      rowElement.setAttribute('aria-pressed', String(active));
    }
  };

  const selectSkill = (key: string | null): void => {
    // Keep hit inspection local to the expanded row; clicking it again clears the selection.
    selectedSkillKey = key && key === selectedSkillKey ? null : key;
    applySkillRowSelection();
    renderSkillInspector(container, selectedSkillKey, model);
  };

  const bindSkillSelection = (): void => {
    for (const rowElement of container.querySelectorAll<HTMLElement>('[data-role="skill-rows"] .res-row-selectable')) {
      rowElement.onclick = () => selectSkill(rowElement.dataset.skillKey || null);
      rowElement.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSkill(rowElement.dataset.skillKey || null);
        }
      };
    }

    applySkillRowSelection();
    renderSkillInspector(container, selectedSkillKey, model);
  };

  bindSort();
  bindSkillSelection();
  bindConditionInspectors(container, chartSeries);
}
