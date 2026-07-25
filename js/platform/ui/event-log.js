import { escapeHtml } from "./html.js";

const ORDER = {
  action: 10,
  resource: 30,
  marker: 40,
  proc: 50,
  damage: 60,
  condition: 70,
};

export function eventLogRows(result, adapters = {}) {
  const rows = [];
  for (const event of result?.events || []) {
    const adapter = adapters[event.type];
    const description = adapter?.(event, result)
      ?? (event.type === "action"
        ? `CAST ${event.skillName || event.name || event.sourceId}`
        : event.type === "proc"
          ? `PROC ${event.name || event.sourceId}`
          : null);
    if (!description) continue;
    rows.push({
      at: Number(event.at || 0),
      type: event.type,
      description,
      order: ORDER[event.type] ?? 80,
    });
  }
  return rows
    .sort((left, right) =>
      left.at - right.at
      || left.order - right.order
      || left.description.localeCompare(right.description))
    .map(({ order, ...row }) => row);
}

export function eventLogCsv(rows) {
  const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Time (s)", "Type", "Event"].map(cell).join(","),
    ...rows.map(row => [
      Number(row.at || 0).toFixed(3),
      row.type,
      row.description,
    ].map(cell).join(",")),
  ].join("\r\n");
}

function safeClassNames(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(name => /^[a-zA-Z0-9_-]+$/.test(name))
    .join(" ");
}

function eventLogLinesHtml(rows) {
  return rows.map(row => {
    const rowClasses = safeClassNames(row.rowClassName);
    const descriptionClasses = safeClassNames(row.className);
    return `<div class="log-line${rowClasses ? ` ${rowClasses}` : ""}">
      <span class="log-time">${Number(row.at || 0).toFixed(3)}s</span>
      <span class="log-desc${descriptionClasses ? ` ${descriptionClasses}` : ""}">${escapeHtml(row.description)}</span>
    </div>`;
  }).join("");
}

function downloadCsv(rows, filename) {
  if (
    typeof Blob === "undefined"
    || !globalThis.URL?.createObjectURL
    || !globalThis.document?.createElement
  ) {
    return;
  }
  const blob = new Blob([eventLogCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function mountEventLog(container, rows, options = {}) {
  if (!container) return null;
  const resolvedRows = rows || [];
  const filters = options.filters || [];
  const previousDetails = container.querySelector?.(
    '[data-role="event-log-details"]',
  );
  const wasMounted = Boolean(previousDetails);
  const open = wasMounted
    ? previousDetails.open
    : Boolean(options.initiallyOpen);
  const activeFilters = new Set(
    [...(container.querySelectorAll?.(
      '[data-role="event-log-filter"]:checked',
    ) || [])].map(input => input.dataset.filterId),
  );
  const title = options.title || "Event Log";
  const filename = options.filename || "event-log.csv";

  const filteredRows = () => resolvedRows.filter(row =>
    filters.every(filter =>
      !activeFilters.has(String(filter.id)) || filter.predicate?.(row)));
  const initialLines = open ? eventLogLinesHtml(filteredRows()) : "";
  container.innerHTML = `<details class="res-log-wrap" data-role="event-log-details"${open ? " open" : ""}>
    <summary>${escapeHtml(title)} (${resolvedRows.length} events)</summary>
    <div class="log-controls">
      <button type="button" class="btn-csv-export" data-role="event-log-download"
        data-filename="${escapeHtml(filename)}">Download CSV Log</button>
      ${filters.map(filter => {
        const id = String(filter.id);
        const checked = activeFilters.has(id);
        return `<label class="log-filter-label">
          <input type="checkbox" class="log-filter-${escapeHtml(id)}"
            data-role="event-log-filter" data-filter-id="${escapeHtml(id)}"${checked ? " checked" : ""} />
          ${escapeHtml(filter.label)}
        </label>`;
      }).join("")}
    </div>
    <div class="res-log" data-role="event-log-rows"${open ? ' data-rendered="true"' : ""}>${initialLines}</div>
  </details>`;

  const details = container.querySelector?.('[data-role="event-log-details"]');
  const logElement = container.querySelector?.('[data-role="event-log-rows"]');
  const renderLogLines = (force = false) => {
    if (!logElement || (!force && logElement.dataset.rendered === "true")) return;
    logElement.innerHTML = eventLogLinesHtml(filteredRows());
    logElement.dataset.rendered = "true";
  };
  if (details?.open) renderLogLines();
  if (details) {
    details.ontoggle = () => {
      if (details.open) renderLogLines();
    };
  }
  for (const input of container.querySelectorAll?.(
    '[data-role="event-log-filter"]',
  ) || []) {
    input.onchange = () => {
      const id = input.dataset.filterId;
      if (input.checked) activeFilters.add(id);
      else activeFilters.delete(id);
      if (details?.open) renderLogLines(true);
    };
  }
  const download = container.querySelector?.(
    '[data-role="event-log-download"]',
  );
  if (download) download.onclick = () => downloadCsv(resolvedRows, filename);
  return { activeFilters, render: () => renderLogLines(true) };
}
