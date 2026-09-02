import { useEffect, useMemo, useState } from 'react';
import { renderReact } from '#ui/react-root.js';

export interface EventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly className?: string;
  readonly order?: number;
  readonly flags?: string[];
}

export interface NormalizedEventLogDescriptor extends EventLogDescriptor {
  readonly className: string;
  readonly order: number;
  readonly flags: string[];
}

export interface EventLogRow extends EventLogDescriptor {
  readonly at: number;
  readonly rowClassName?: string;
  readonly phantasmClone?: boolean;
}

export interface EventLogFilter {
  readonly id: string;
  readonly label: string;
  readonly predicate?: (row: EventLogRow) => boolean;
}

export interface EventLogMountOptions {
  readonly filters?: readonly EventLogFilter[];
  readonly initiallyOpen?: boolean;
  readonly title?: string;
  readonly filename?: string;
}

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

export function eventLogCsv(rows: readonly EventLogRow[]): string {
  // Quote every cell and use CRLF so spreadsheet programs parse the download consistently across platforms.
  const cell = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    ['Time (s)', 'Type', 'Event'].map(cell).join(','),
    ...rows.map((row) => [Number(row.at || 0).toFixed(3), row.type, row.description].map(cell).join(','))
  ].join('\r\n');
}

function safeClassNames(value: unknown): string {
  return String(value || '')
    .split(/\s+/)
    .filter((name) => /^[a-zA-Z0-9_-]+$/.test(name))
    .join(' ');
}

function downloadCsv(rows: readonly EventLogRow[], filename: string): void {
  // Stay safe in SSR/test environments where browser download APIs are absent.
  if (typeof Blob === 'undefined' || !globalThis.URL?.createObjectURL || !globalThis.document?.createElement) return;
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

/** Keeps disclosure, search, and filters local while rows are refreshed by new simulation results. */
function EventLog({
  rows,
  options
}: {
  readonly rows: readonly EventLogRow[];
  readonly options: EventLogMountOptions;
}) {
  const filters = useMemo(() => options.filters || [], [options.filters]);
  const [open, setOpen] = useState(Boolean(options.initiallyOpen));
  const [activeFilters, setActiveFilters] = useState<ReadonlySet<string>>(() => new Set());
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchDraft), 200);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!query || String(row.description).toLowerCase().includes(query)) &&
        filters.every((filter) => !activeFilters.has(String(filter.id)) || Boolean(filter.predicate?.(row)))
    );
  }, [activeFilters, filters, rows, searchQuery]);

  const title = options.title || 'Event Log';
  const filename = options.filename || 'event-log.csv';
  return (
    <details
      className='res-log-wrap'
      data-role='event-log-details'
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {title} ({rows.length} events)
      </summary>
      <div className='log-controls'>
        <button
          type='button'
          className='btn-csv-export'
          data-role='event-log-download'
          data-filename={filename}
          onClick={() => downloadCsv(rows, filename)}
        >
          Download CSV Log
        </button>
        <input
          type='search'
          className='log-search'
          data-role='event-log-search'
          placeholder='Filter events…'
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.currentTarget.value)}
        />
        {filters.map((filter) => {
          const id = String(filter.id);
          return (
            <label className='log-filter-label' key={id}>
              <input
                type='checkbox'
                className={`log-filter-${id}`}
                data-role='event-log-filter'
                data-filter-id={id}
                checked={activeFilters.has(id)}
                onChange={(event) => {
                  const next = new Set(activeFilters);
                  if (event.currentTarget.checked) next.add(id);
                  else next.delete(id);
                  setActiveFilters(next);
                }}
              />
              {filter.label}
            </label>
          );
        })}
      </div>
      <div className='res-log' data-role='event-log-rows' data-rendered={open ? 'true' : undefined}>
        {open
          ? filteredRows.map((row, index) => {
              const rowClasses = safeClassNames(row.rowClassName);
              const descriptionClasses = safeClassNames(row.className);
              return (
                <div className={`log-line${rowClasses ? ` ${rowClasses}` : ''}`} key={`${row.at}:${index}`}>
                  <span className='log-time'>{Number(row.at || 0).toFixed(3)}s</span>
                  <span className={`log-desc${descriptionClasses ? ` ${descriptionClasses}` : ''}`}>
                    {row.description}
                  </span>
                </div>
              );
            })
          : null}
      </div>
    </details>
  );
}

/** Renders the searchable event log into its stable React-owned container. */
export function mountEventLog(
  container: HTMLElement | null | undefined,
  rows: readonly EventLogRow[],
  options: EventLogMountOptions = {}
): void {
  if (container) renderReact(container, <EventLog rows={rows || []} options={options} />);
}
