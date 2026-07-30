import { mountTimeSeriesCharts } from "./charts.js";
import { escapeHtml } from "./html.js";

// Default column schema shared by the renderer and profession adapters.
export const SKILL_COLS = [
  { key: "name", label: "Skill", numeric: false },
  { key: "strike", label: "Strike", numeric: true },
  { key: "condition", label: "Condition", numeric: true, className: "condi" },
  { key: "total", label: "Total", numeric: true, className: "total" },
  { key: "dps", label: "DPS", numeric: true, className: "dps" },
  { key: "average", label: "Avg/Cast", numeric: true },
  { key: "dct", label: "DCT", numeric: true },
  { key: "casts", label: "Casts", numeric: true },
  { key: "hits", label: "Hits", numeric: true },
];

export function nextResultSortState(currentColumn, currentDirection, column) {
  // Repeated clicks cycle descending -> ascending -> default total ordering.
  if (currentColumn !== column) {
    return { column, direction: "desc" };
  }
  const direction = currentDirection === "desc"
    ? "asc"
    : currentDirection === "asc" ? null : "desc";
  return {
    column: direction ? column : null,
    direction,
  };
}

export function sortResultRows(rows, columns, column, direction) {
  // Never mutate the model supplied by the simulation/result transformer.
  const sorted = [...(rows || [])];
  if (!column || !direction) {
    // "Unsorted" means the useful default of highest total damage first.
    return sorted.sort((left, right) =>
      Number(right.total || 0) - Number(left.total || 0));
  }

  const definition = (columns || []).find(candidate => candidate.key === column);
  if (definition?.numeric) {
    return sorted.sort((left, right) => {
      const leftValue = left[column] ?? -Infinity;
      const rightValue = right[column] ?? -Infinity;
      return direction === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    });
  }
  return sorted.sort((left, right) => direction === "asc"
    ? String(left[column] ?? "").localeCompare(String(right[column] ?? ""))
    : String(right[column] ?? "").localeCompare(String(left[column] ?? "")));
}

export function mountRotationWarnings(
  container,
  warnings = [],
  { open = false } = {},
) {
  if (!container) return null;
  const items = (warnings || [])
    .filter(warning => warning != null)
    .map(warning => typeof warning === "object"
      ? {
          message: String(warning.message ?? warning.text ?? ""),
          time: warning.time == null ? "" : String(warning.time),
        }
      : { message: String(warning), time: "" });
  if (!items.length) {
    container.innerHTML = "";
    return null;
  }

  container.innerHTML = `<details class="rotation-warnings-wrap"${open ? " open" : ""}>
    <summary>Warnings (${items.length})</summary>
    <ul class="rotation-warnings-content">
      ${items.map(warning => `<li>${
        warning.time
          ? `<span class="rotation-warning-time">${escapeHtml(warning.time)}</span>`
          : ""
      }<span class="rotation-warning-message">${escapeHtml(warning.message)}</span></li>`).join("")}
    </ul>
  </details>`;
  return container.querySelector?.(".rotation-warnings-wrap") || null;
}

const number = value => Math.round(Number(value || 0)).toLocaleString();

function signedInteger(value) {
  const rounded = Math.round(Number(value || 0));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return `${normalized > 0 ? "+" : ""}${normalized.toLocaleString()}`;
}

function signedFixed(value, digits = 2) {
  const numeric = Number(value || 0);
  const threshold = 0.5 / (10 ** digits);
  const normalized = Math.abs(numeric) < threshold ? 0 : numeric;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(digits)}`;
}

function skillCellHtml(row, column, options) {
  const value = row[column.key];
  if (column.key === "name") {
    const icon = options.resolveSkillIcon?.(row) || options.placeholderIcon || "";
    return `<span class="res-skill"><img src="${escapeHtml(icon)}" alt="" />${escapeHtml(value)}</span>`;
  }
  const formatted = column.format
    ? column.format(value, row)
    : value == null ? "&mdash;" : column.numeric ? number(value) : escapeHtml(value);
  // Custom formatters return display text, not trusted HTML.
  return `<span${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.format ? escapeHtml(formatted) : formatted}</span>`;
}

function skillRowHtml(row, columns, options) {
  return `<div class="res-row">${columns.map(column =>
    skillCellHtml(row, column, options)
  ).join("")}</div>`;
}

function skillHeaderHtml(columns, sortState) {
  return columns.map(column => {
    const indicator = sortState.column === column.key
      ? (sortState.direction === "asc" ? " ▲" : " ▼")
      : "";
    return `<span data-sort-col="${escapeHtml(column.key)}">${escapeHtml(column.label)}${indicator}</span>`;
  }).join("");
}

export function mountRotationResults(container, model = {}, options = {}) {
  if (!container) return null;
  const metrics = model.metrics || [];
  const breakpoints = model.breakpoints || [];
  const skillRows = model.skillRows || [];
  const skillColumns = model.skillColumns || [];
  const conditions = model.conditions || [];
  const contributions = model.contributions || [];
  const contributionsStale = model.contributionsStale === true;
  const randomDistribution = model.randomDistribution || null;
  const randomDistributionRequested =
    model.randomDistributionRequested === true;
  const randomDistributionStale = model.randomDistributionStale === true;
  const randomDistributionTrials = Number(
    randomDistribution?.trials || model.randomDistributionTrials || 0,
  );
  const randomDistributionProgress = model.randomDistributionProgress || {};
  const randomDistributionCompleted = Math.max(
    0,
    Math.min(
      randomDistributionTrials,
      Number(randomDistributionProgress.completed || 0),
    ),
  );
  const randomDistributionPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        randomDistributionProgress.percent
        ?? (
          randomDistributionTrials > 0
            ? (randomDistributionCompleted / randomDistributionTrials) * 100
            : 0
        ),
      ),
    ),
  );
  const randomDistributionError = String(
    model.randomDistributionError || "",
  );
  let sortState = {
    column: options.sortState?.column || null,
    direction: options.sortState?.direction || null,
  };
  const breakdownClassName = options.skillBreakdownClassName || "skill-breakdown";
  const initialSkillRows = sortResultRows(
    skillRows,
    skillColumns,
    sortState.column,
    sortState.direction,
  );

  // Replacing the subtree gives every mount a clean DOM/event-handler slate.
  container.innerHTML = `<div class="res-summary">
    ${metrics.map(metric => `<div class="res-stat">
      <span class="res-label">${escapeHtml(metric.label)}</span>
      <span class="res-val${metric.className ? ` ${escapeHtml(metric.className)}` : ""}">${escapeHtml(metric.value)}</span>
    </div>`).join("")}
  </div>
  ${breakpoints.length ? `<details class="res-breakpoints">
    <summary>
      <span class="res-breakpoints-heading">DPS snapshots</span>
      <span class="res-breakpoints-description">Average DPS at 20% target-health intervals</span>
    </summary>
    <div class="res-breakpoint-grid">
      ${breakpoints.map(breakpoint => `<div class="res-breakpoint">
        <div class="res-breakpoint-meta">
          <span class="res-breakpoint-label">
            <b>${number(breakpoint.healthPercent)}%</b> target health
          </span>
          <span class="res-breakpoint-time">at ${Number(breakpoint.elapsed || 0).toFixed(2)}s</span>
        </div>
        <div class="res-breakpoint-value">
          <strong>${number(breakpoint.dps)}</strong>
          <span>DPS</span>
        </div>
      </div>`).join("")}
    </div>
  </details>` : ""}
  ${randomDistributionRequested ? `<section class="rng-distribution">
    <div class="rng-distribution-heading">
      <div>
        <h4>Trait-proc RNG distribution</h4>
        <p>Use Expected for planning. P1 and P99 show rare unlucky and lucky outcomes. Other result panels use the deterministic baseline.</p>
      </div>
      ${randomDistributionTrials
        ? `<span>${number(randomDistributionTrials)} simulated rotations</span>`
        : ""}
    </div>
    ${randomDistributionStale
      ? `<div class="rng-distribution-progress"
          data-role="rng-progress"
          role="progressbar"
          aria-label="Calculating RNG outcomes"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(randomDistributionPercent)}">
          <div class="rng-distribution-progress-track">
            <span data-role="rng-progress-bar" style="width: ${randomDistributionPercent}%"></span>
          </div>
          <span data-role="rng-progress-label">${
            number(randomDistributionCompleted)
          } / ${number(randomDistributionTrials)} outcomes (${
            Math.round(randomDistributionPercent)
          }%)</span>
        </div>`
      : randomDistributionError
        ? `<div class="rng-distribution-status rng-distribution-error">${escapeHtml(randomDistributionError)}</div>`
        : randomDistribution
          ? `<div class="rng-distribution-grid">
            <div class="rng-distribution-stat">
              <span>Expected</span>
              <strong>${number(randomDistribution.mean)}</strong>
              <small>Mean DPS</small>
            </div>
            <div class="rng-distribution-stat">
              <span>Typical</span>
              <strong>${number(randomDistribution.p50)}</strong>
              <small>P50 DPS</small>
            </div>
            <div class="rng-distribution-stat rng-distribution-range">
              <span>Likely range</span>
              <strong>${number(randomDistribution.p10)}&ndash;${number(randomDistribution.p90)}</strong>
              <small>P10&ndash;P90 DPS</small>
            </div>
            <div class="rng-distribution-stat rng-unlucky">
              <span>Very unlucky</span>
              <strong>${number(randomDistribution.p01)}</strong>
              <small>P1 DPS</small>
            </div>
            <div class="rng-distribution-stat rng-lucky">
              <span>Very lucky</span>
              <strong>${number(randomDistribution.p99)}</strong>
              <small>P99 DPS</small>
            </div>
          </div>`
          : '<div class="rng-distribution-status">No RNG outcomes available.</div>'}
  </section>` : ""}
  ${skillColumns.length ? `<div class="res-breakdown ${escapeHtml(breakdownClassName)}" data-role="skill-breakdown">
    <div class="res-hdr res-hdr-sortable" data-role="skill-header">
      ${skillHeaderHtml(skillColumns, sortState)}
    </div>
    <div class="res-skill-rows" data-role="skill-rows">${initialSkillRows.map(row =>
      skillRowHtml(row, skillColumns, options)).join("")}</div>
  </div>` : ""}
  ${conditions.length ? `<div class="res-breakdown cond-breakdown">
    <div class="res-hdr cond-hdr">
      <span>Condition</span><span>Damage</span><span>DPS</span><span>Avg Stacks</span>
    </div>
    ${conditions.map(condition => `<div class="res-row">
      <span class="res-skill condi">${escapeHtml(condition.name)}</span>
      <span class="condi">${number(condition.damage)}</span>
      <span class="dps">${number(condition.dps)}</span>
      <span>${Number(condition.averageStacks || 0).toFixed(2)}</span>
    </div>`).join("")}
    ${model.conditionTotal ? `<div class="res-row res-total">
      <span class="res-skill"><b>${escapeHtml(model.conditionTotal.label || "Total Conditions")}</b></span>
      <span class="condi"><b>${number(model.conditionTotal.damage)}</b></span>
      <span class="dps"><b>${number(model.conditionTotal.dps)}</b></span>
      <span></span>
    </div>` : ""}
  </div>` : ""}
  ${model.chartSeries ? '<div data-role="result-charts"></div>' : ""}
  ${contributions.length || contributionsStale ? `<div class="res-contributions">
    <h4>
      <span>Modifier Contributions</span>
      ${contributionsStale
        ? '<span class="contrib-status">Recalculating</span>'
        : ""}
    </h4>
    ${contributions.length ? `<div class="contrib-table">
      <div class="contrib-hdr">
        <span>Modifier</span><span>DPS Increase</span><span>% Increase</span>
      </div>
      ${contributions.map(contribution => {
        return `<div class="contrib-row">
          <span class="contrib-name">${
            contribution.icon
              ? `<img src="${escapeHtml(contribution.icon)}" alt="" />`
              : ""
          }${escapeHtml(contribution.name)}</span>
          <span class="contrib-val">${signedInteger(contribution.dpsIncrease)}</span>
          <span class="contrib-pct">${signedFixed(contribution.pctIncrease)}%</span>
        </div>`;
      }).join("")}
    </div>` : '<div class="contrib-pending">Calculating modifier contributions…</div>'}
  </div>` : ""}`;

  const renderSortedRows = () => {
    const sorted = sortResultRows(
      skillRows,
      skillColumns,
      sortState.column,
      sortState.direction,
    );
    const rowsElement = container.querySelector?.('[data-role="skill-rows"]');
    if (rowsElement) {
      rowsElement.innerHTML = sorted.map(row =>
        skillRowHtml(row, skillColumns, options)).join("");
    }
    const header = container.querySelector?.('[data-role="skill-header"]');
    if (header) {
      header.innerHTML = skillHeaderHtml(skillColumns, sortState);
      // Replacing header markup discards its handlers, so bind the new cells.
      bindSort();
    }
  };
  const bindSort = () => {
    const header = container.querySelector?.('[data-role="skill-header"]');
    for (const cell of header?.querySelectorAll?.("[data-sort-col]") || []) {
      cell.onclick = () => {
        sortState = nextResultSortState(
          sortState.column,
          sortState.direction,
          cell.dataset.sortCol,
        );
        options.onSortStateChange?.({ ...sortState });
        renderSortedRows();
      };
    }
  };

  bindSort();
  const chartContainer = container.querySelector?.('[data-role="result-charts"]');
  if (chartContainer) {
    // Charts mount only when the transformed model supplies sampled series.
    mountTimeSeriesCharts(
      chartContainer,
      model.chartSeries,
      options.chartOptions || {},
    );
  }
  return { getSortState: () => ({ ...sortState }), renderSortedRows };
}
