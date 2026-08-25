import type { SimulationEvent } from '../engine/types.js';
import type { Gw2ResolverResult } from '../gw2/resolver/types.js';
import type { EventLogMountOptions, EventLogRow, NormalizedEventLogDescriptor } from './types.js';
import { escapeHtml } from './html.js';

export const EVENT_LOG_ORDER: Readonly<Record<string, number>> = Object.freeze({
  combat_start: 5,
  action: 10,
  cast: 10,
  resource: 30,
  marker: 40,
  proc: 50,
  trigger: 55,
  damage: 60,
  condition: 70,
  cast_end: 90
});

/**
 * Converts a profession presenter result into the one canonical descriptor
 * shape used by both platform and application event logs.
 *
 * `null` is an explicit suppression. `undefined` means no presenter exists.
 */
export function normalizeEventLogDescriptor(descriptor: unknown): NormalizedEventLogDescriptor | null | undefined {
  if (descriptor === null) return null;
  if (!descriptor || typeof descriptor !== 'object') return undefined;
  const value = descriptor as Record<string, unknown>;
  const type = String(value.type || '').trim();
  const description = String(value.description || '').trim();
  if (!type || !description) return undefined;
  const flags = Array.isArray(value.flags) ? value.flags.map(String) : [];
  return {
    type,
    description,
    className: String(value.className || ''),
    order: Number.isFinite(Number(value.order)) ? Number(value.order) : (EVENT_LOG_ORDER[type] ?? 80),
    flags
  };
}

export function eventLogRows(
  result: Gw2ResolverResult,
  adapters: Readonly<Record<string, (event: SimulationEvent, result: Gw2ResolverResult) => unknown>> = {}
): EventLogRow[] {
  const rows: Array<EventLogRow & { order: number; flags: string[] }> = [];
  for (const event of result?.events || []) {
    const adapter = adapters[event.type];
    const presented = adapter?.(event, result);
    const fallbackDescription =
      event.type === 'action'
        ? `CAST ${event.skillName || event.name || event.sourceId}`
        : event.type === 'proc'
          ? `PROC ${event.name || event.sourceId}`
          : null;
    const descriptor =
      typeof presented === 'string'
        ? normalizeEventLogDescriptor({
            type: event.type,
            description: presented
          })
        : normalizeEventLogDescriptor(
            presented === undefined && fallbackDescription
              ? {
                  type: event.type,
                  description: fallbackDescription
                }
              : presented
          );
    if (!descriptor) continue;
    rows.push({
      at: Number(event.at || 0),
      ...descriptor
    });
  }

  return (
    rows
      // Type order makes same-timestamp rows read as cause before consequence.
      .sort(
        (left, right) =>
          left.at - right.at || left.order - right.order || left.description.localeCompare(right.description)
      )
      .map(({ order: _order, flags: _flags, ...row }) => row)
  );
}

export function eventLogCsv(rows: readonly EventLogRow[]): string {
  // Quote every cell and use CRLF so spreadsheet programs parse the download
  // consistently across platforms.
  const cell = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    ['Time (s)', 'Type', 'Event'].map(cell).join(','),
    ...rows.map((row) => [Number(row.at || 0).toFixed(3), row.type, row.description].map(cell).join(','))
  ].join('\r\n');
}

function safeClassNames(value: unknown): string {
  // Class names are interpolated into markup, so allow identifiers only.
  return String(value || '')
    .split(/\s+/)
    .filter((name) => /^[a-zA-Z0-9_-]+$/.test(name))
    .join(' ');
}

function eventLogLinesHtml(rows: readonly EventLogRow[]): string {
  return rows
    .map((row) => {
      const rowClasses = safeClassNames(row.rowClassName);
      const descriptionClasses = safeClassNames(row.className);
      return `<div class="log-line${rowClasses ? ` ${rowClasses}` : ''}">
      <span class="log-time">${Number(row.at || 0).toFixed(3)}s</span>
      <span class="log-desc${descriptionClasses ? ` ${descriptionClasses}` : ''}">${escapeHtml(row.description)}</span>
    </div>`;
    })
    .join('');
}

function downloadCsv(rows: readonly EventLogRow[], filename: string): void {
  // Stay safe in SSR/test environments where browser download APIs are absent.
  if (typeof Blob === 'undefined' || !globalThis.URL?.createObjectURL || !globalThis.document?.createElement) {
    return;
  }

  const blob = new Blob([eventLogCsv(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function mountEventLog(
  container: HTMLElement | null | undefined,
  rows: readonly EventLogRow[],
  options: EventLogMountOptions = {}
): {
  readonly activeFilters: Set<string>;
  readonly render: () => void;
} | null {
  if (!container) return null;
  const resolvedRows = rows || [];
  const filters = options.filters || [];
  const previousDetails = container.querySelector<HTMLDetailsElement>('[data-role="event-log-details"]');
  const wasMounted = Boolean(previousDetails);
  // Preserve disclosure and filter state when simulation results rerender.
  const open = wasMounted ? Boolean(previousDetails?.open) : Boolean(options.initiallyOpen);
  const activeFilters = new Set(
    [...container.querySelectorAll<HTMLInputElement>('[data-role="event-log-filter"]:checked')].flatMap((input) =>
      input.dataset.filterId ? [input.dataset.filterId] : []
    )
  );
  // Preserve the free-text search across result rerenders, mirroring filters.
  const previousSearch = container.querySelector<HTMLInputElement>('[data-role="event-log-search"]');
  let searchQuery = previousSearch?.value || '';
  const title = options.title || 'Event Log';
  const filename = options.filename || 'event-log.csv';

  const filteredRows = (): EventLogRow[] => {
    const query = searchQuery.trim().toLowerCase();
    return resolvedRows.filter(
      (row) =>
        (!query || String(row.description).toLowerCase().includes(query)) &&
        filters.every((filter) => !activeFilters.has(String(filter.id)) || Boolean(filter.predicate?.(row)))
    );
  };

  const initialLines = open ? eventLogLinesHtml(filteredRows()) : '';
  container.innerHTML = `<details class="res-log-wrap" data-role="event-log-details"${open ? ' open' : ''}>
    <summary>${escapeHtml(title)} (${resolvedRows.length} events)</summary>
    <div class="log-controls">
      <button type="button" class="btn-csv-export" data-role="event-log-download"
        data-filename="${escapeHtml(filename)}">Download CSV Log</button>
      <input type="search" class="log-search" data-role="event-log-search"
        placeholder="Filter events…" value="${escapeHtml(searchQuery)}" />
      ${filters
        .map((filter) => {
          const id = String(filter.id);
          const checked = activeFilters.has(id);
          return `<label class="log-filter-label">
          <input type="checkbox" class="log-filter-${escapeHtml(id)}"
            data-role="event-log-filter" data-filter-id="${escapeHtml(id)}"${checked ? ' checked' : ''} />
          ${escapeHtml(filter.label)}
        </label>`;
        })
        .join('')}
    </div>
    <div class="res-log" data-role="event-log-rows"${open ? ' data-rendered="true"' : ''}>${initialLines}</div>
  </details>`;

  const details = container.querySelector<HTMLDetailsElement>('[data-role="event-log-details"]');
  const logElement = container.querySelector<HTMLElement>('[data-role="event-log-rows"]');
  const renderLogLines = (force = false): void => {
    // Large logs are rendered lazily the first time the details element opens.
    if (!logElement || (!force && logElement.dataset.rendered === 'true')) {
      return;
    }

    logElement.innerHTML = eventLogLinesHtml(filteredRows());
    logElement.dataset.rendered = 'true';
  };

  if (details?.open) renderLogLines();
  if (details) {
    details.ontoggle = () => {
      if (details.open) renderLogLines();
    };
  }

  for (const checkbox of container.querySelectorAll<HTMLInputElement>('[data-role="event-log-filter"]')) {
    checkbox.onchange = () => {
      const id = checkbox.dataset.filterId;
      if (!id) return;
      if (checkbox.checked) activeFilters.add(id);
      else activeFilters.delete(id);
      if (details?.open) renderLogLines(true);
    };
  }

  const search = container.querySelector<HTMLInputElement>('[data-role="event-log-search"]');
  if (search) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    search.oninput = () => {
      searchQuery = search.value;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      // Debounce so large logs aren't re-rendered on every keystroke.
      debounceTimer = setTimeout(() => {
        if (details?.open) renderLogLines(true);
      }, 200);
    };
  }

  const download = container.querySelector<HTMLElement>('[data-role="event-log-download"]');
  // Export the complete log, independent of temporary display filters.
  if (download) download.onclick = () => downloadCsv(resolvedRows, filename);
  return { activeFilters, render: () => renderLogLines(true) };
}
