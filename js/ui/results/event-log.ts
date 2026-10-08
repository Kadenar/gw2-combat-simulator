/** Renders and exports generic event-log rows without simulation-specific knowledge. */
import { escapeHtml } from '#ui/shared/html.js';
import { timeKey } from '#kernel/core/clock.js';

export interface EventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly details?: readonly string[];
  readonly className?: string;
}

/** How a row's owner was established; inferred links are drawn dashed and named when tracing a row. */
export interface EventLogParentLink {
  readonly kind: 'recorded' | 'inferred';
  readonly label: string;
}

/** Origin category of a row, shown as a badge and offered as a visibility toggle. */
export interface EventLogSource {
  readonly id: string;
  readonly label: string;
  /** Primary rows still toggle but skip the badge so reactions stand out. */
  readonly badge?: boolean;
}

/** Short label collected from descendants into a group summary, such as an applied boon. */
export interface EventLogTag {
  readonly label: string;
  readonly className?: string;
}

export interface EventLogRow extends EventLogDescriptor {
  readonly at: number;
  /** Stable identity that child rows reference through `parentId`. */
  readonly id?: string;
  /** Owning row; rows without a resolvable parent are top-level groups. */
  readonly parentId?: string;
  readonly parentLink?: EventLogParentLink;
  readonly source?: EventLogSource;
  /** The row should have an owner but none was found; it stays top level with a marker. */
  readonly orphan?: boolean;
  /** Display number of a group, used as the owner reference in the chronological layout. */
  readonly ordinal?: number;
  /** Duration in seconds; children of a group with a span are marked when they land after it ends. */
  readonly span?: number;
  /** Numeric value summed over a group's descendants. */
  readonly metric?: number;
  readonly tag?: EventLogTag;
  /** Restricts a row to one layout: end markers fold into their group, synthetic groups have no time entry. */
  readonly layout?: 'flat' | 'tree';
}

export interface EventLogMountOptions {
  readonly initiallyOpen?: boolean;
  readonly title?: string;
  readonly filename?: string;
  /** Singular and plural names for the summed metric in group summaries. */
  readonly metricUnit?: readonly [singular: string, plural: string];
}

export function eventLogCsv(rows: readonly EventLogRow[]): string {
  // Quote every cell and use CRLF so spreadsheet programs parse the download
  // consistently across platforms. Id columns let the causal tree survive export.
  const cell = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    ['Time (s)', 'Type', 'Event', 'Id', 'Parent Id'].map(cell).join(','),
    ...rows.map((row) =>
      [Number(row.at || 0).toFixed(3), row.type, row.description, row.id, row.parentId].map(cell).join(',')
    )
  ].join('\r\n');
}

function safeClassNames(value: unknown): string {
  // Class names are interpolated into markup, so allow identifiers only.
  return String(value || '')
    .split(/\s+/)
    .filter((name) => /^[a-zA-Z0-9_-]+$/.test(name))
    .join(' ');
}

interface LogNode<TRow extends EventLogRow> {
  readonly row: TRow;
  readonly key: number;
  parent: LogNode<TRow> | null;
  readonly children: LogNode<TRow>[];
  root: LogNode<TRow> | null;
  depth: number;
}

interface LogModel<TRow extends EventLogRow> {
  readonly nodes: readonly LogNode<TRow>[];
  readonly roots: readonly LogNode<TRow>[];
  readonly hasTree: boolean;
  readonly sources: readonly EventLogSource[];
}

interface LogSummary {
  count: number;
  metricCount: number;
  metricTotal: number;
  readonly tags: Map<string, string>;
}

type LogView = 'tree' | 'flat';
type LogTimeMode = 'offset' | 'absolute';

/** Per-container choices that survive result rerenders, like filters and scroll position. */
interface LogViewState {
  view: LogView;
  timeMode: LogTimeMode;
  readonly hiddenSources: Set<string>;
  readonly collapsed: Set<string>;
}

const viewStates = new WeakMap<object, LogViewState>();

/** Links rows into a forest by `parentId`; rows keep input order so siblings stay chronological. */
function buildLogModel<TRow extends EventLogRow>(rows: readonly TRow[]): LogModel<TRow> {
  const nodes: LogNode<TRow>[] = rows.map((row, key) => ({
    row,
    key,
    parent: null,
    children: [],
    root: null,
    depth: 0
  }));
  const byId = new Map<string, LogNode<TRow>>();
  for (const node of nodes) if (node.row.id && !byId.has(node.row.id)) byId.set(node.row.id, node);
  for (const node of nodes) {
    const parent = node.row.parentId ? byId.get(node.row.parentId) : undefined;
    if (parent && parent !== node) node.parent = parent;
  }

  // Break malformed cycles so every row still reaches a root.
  for (const node of nodes) {
    const seen = new Set<LogNode<TRow>>();
    for (let current = node.parent; current; current = current.parent) {
      if (current === node || seen.has(current)) {
        node.parent = null;
        break;
      }

      seen.add(current);
    }
  }

  const roots: LogNode<TRow>[] = [];
  for (const node of nodes) {
    // Flat-only rows keep their parent for highlighting but never render inside the tree.
    if (node.row.layout === 'flat') continue;
    if (node.parent) node.parent.children.push(node);
    else roots.push(node);
  }

  const place = (node: LogNode<TRow>): void => {
    if (node.root) return;
    if (node.parent) {
      place(node.parent);
      node.root = node.parent.root;
      node.depth = node.parent.depth + 1;
    } else {
      node.root = node;
    }
  };

  nodes.forEach(place);
  const sources = new Map<string, EventLogSource>();
  for (const { row } of nodes) if (row.source && !sources.has(row.source.id)) sources.set(row.source.id, row.source);
  return {
    nodes,
    roots,
    hasTree: nodes.some((node) => node.parent && node.row.layout !== 'flat'),
    sources: [...sources.values()]
  };
}

/** Aggregates a group's descendants once so collapsed and expanded renders share the same totals. */
function summarize<TRow extends EventLogRow>(node: LogNode<TRow>, memo: Map<LogNode<TRow>, LogSummary>): LogSummary {
  const cached = memo.get(node);
  if (cached) return cached;
  const summary: LogSummary = { count: 0, metricCount: 0, metricTotal: 0, tags: new Map() };
  for (const child of node.children) {
    const nested = summarize(child, memo);
    summary.count += 1 + nested.count;
    if (child.row.metric != null) {
      summary.metricCount += 1;
      summary.metricTotal += child.row.metric;
    }

    summary.metricCount += nested.metricCount;
    summary.metricTotal += nested.metricTotal;
    if (child.row.tag && !summary.tags.has(child.row.tag.label)) {
      summary.tags.set(child.row.tag.label, child.row.tag.className || '');
    }

    for (const [label, className] of nested.tags) if (!summary.tags.has(label)) summary.tags.set(label, className);
  }

  memo.set(node, summary);
  return summary;
}

function highlightHtml(text: string, query: string): string {
  const needle = query.trim().toLowerCase();
  const index = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (index < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(text.slice(index, index + needle.length))}</mark>${escapeHtml(text.slice(index + needle.length))}`;
}

function descriptionHtml(row: EventLogRow, query: string): string {
  const descriptionClasses = safeClassNames(row.className);
  const classes = `log-desc${descriptionClasses ? ` ${descriptionClasses}` : ''}`;
  const text = highlightHtml(row.description, query);
  // Native disclosures keep optional calculations keyboard accessible and leave ordinary rows unchanged.
  return row.details?.length
    ? `<details class="${classes}"><summary>${text}</summary><ul>${row.details.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul></details>`
    : `<span class="${classes}">${text}</span>`;
}

function badgesHtml(row: EventLogRow): string {
  const orphan = row.orphan
    ? '<span class="log-badge log-badge-orphan" title="No recorded or inferred owner">No owner</span>'
    : '';
  const sourceClass = row.source ? safeClassNames(row.source.id) : '';
  const source =
    row.source && row.source.badge !== false
      ? `<span class="log-badge${sourceClass ? ` log-badge-${sourceClass}` : ''}">${escapeHtml(row.source.label)}</span>`
      : '';
  return orphan + source;
}

interface TreeRenderContext<TRow extends EventLogRow> {
  readonly matches: (row: TRow) => boolean;
  readonly forceOpen: boolean;
  readonly state: LogViewState;
  readonly query: string;
  readonly memo: Map<LogNode<TRow>, LogSummary>;
  readonly metricUnit: readonly [string, string];
}

function summaryHtml<TRow extends EventLogRow>(
  node: LogNode<TRow>,
  open: boolean,
  context: TreeRenderContext<TRow>
): string {
  if (!node.children.length || (node.depth > 0 && node.row.layout !== 'tree')) return '';
  const summary = summarize(node, context.memo);
  const parts: string[] = [];
  if (!open) parts.push(`<span class="log-summary-hidden">+${summary.count} rows</span>`);
  if (summary.metricCount > 0) {
    const [singular, plural] = context.metricUnit;
    parts.push(
      `<span class="log-summary-metric">${summary.metricCount} ${escapeHtml(summary.metricCount === 1 ? singular : plural)} · ${Math.round(summary.metricTotal).toLocaleString()}</span>`
    );
  }

  const tags = [...summary.tags];
  for (const [label, className] of tags.slice(0, 3)) {
    const classes = safeClassNames(className);
    parts.push(`<span class="log-chip${classes ? ` ${classes}` : ''}">${escapeHtml(label)}</span>`);
  }

  if (tags.length > 3) {
    parts.push(
      `<span class="log-chip log-chip-more" title="${escapeHtml(
        tags
          .slice(3)
          .map(([label]) => label)
          .join(', ')
      )}">+${tags.length - 3}</span>`
    );
  }

  return parts.length ? `<span class="log-summary">${parts.join('')}</span>` : '';
}

function treeLineHtml<TRow extends EventLogRow>(
  node: LogNode<TRow>,
  trail: readonly boolean[],
  isLast: boolean,
  hasChildren: boolean,
  open: boolean,
  dimmed: boolean,
  context: TreeRenderContext<TRow>
): string {
  const { row } = node;
  const root = (node.root ?? node).row;
  const isChild = node.depth > 0;
  const offset = row.at - root.at;
  // Canonical offsets identify delayed impacts without extending the group's lifetime for display.
  const late = isChild && root.span != null && timeKey(offset) > timeKey(root.span);
  const showOffset = isChild && context.state.timeMode === 'offset';
  const absolute = `${Number(row.at || 0).toFixed(3)}s`;
  const time = showOffset ? `+${Math.max(0, offset).toFixed(3)}` : absolute;
  const timeTitle = isChild
    ? ` title="${escapeHtml(`${absolute}, +${Math.max(0, offset).toFixed(3)}s after ${root.description}${late ? `, ${(offset - (root.span ?? 0)).toFixed(3)}s after it ends` : ''}`)}"`
    : '';
  const timeClasses = `log-time${showOffset ? ' log-time-offset' : ''}${late ? ' log-time-late' : ''}`;
  const guides = isChild
    ? `<span class="log-guides" aria-hidden="true">${trail
        .map((continues) => `<span class="log-guide${continues ? ' log-guide-pipe' : ''}"></span>`)
        .join(
          ''
        )}<span class="log-guide ${isLast ? 'log-guide-elbow' : 'log-guide-tee'}${row.parentLink?.kind === 'inferred' ? ' log-guide-inferred' : ''}"></span></span>`
    : '';
  const toggle = hasChildren
    ? `<button type="button" class="log-toggle" data-toggle="${node.key}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${escapeHtml(row.description)}">${open ? '▾' : '▸'}</button>`
    : '<span class="log-toggle-space"></span>';
  return `<div class="log-line log-tree-line${isChild ? '' : ' log-tree-root'}${dimmed ? ' log-dimmed' : ''}" data-key="${node.key}" data-root="${(node.root ?? node).key}" tabindex="-1">
      <span class="${timeClasses}"${timeTitle}>${time}</span>${guides}${toggle}${badgesHtml(row)}${descriptionHtml(row, context.query)}${summaryHtml(node, open, context)}
    </div>`;
}

/** Matching rows keep their ancestors visible but dimmed, so filtered results never lose their owner. */
function treeLinesHtml<TRow extends EventLogRow>(model: LogModel<TRow>, context: TreeRenderContext<TRow>): string {
  const visible = new Map<LogNode<TRow>, boolean>();
  const isVisible = (node: LogNode<TRow>): boolean => {
    let shown = visible.get(node);
    if (shown === undefined) {
      shown = context.matches(node.row) || node.children.some(isVisible);
      visible.set(node, shown);
    }

    return shown;
  };

  const lines: string[] = [];
  const emit = (node: LogNode<TRow>, trail: readonly boolean[], isLast: boolean): void => {
    if (!isVisible(node)) return;
    const children = node.children.filter(isVisible);
    const open = context.forceOpen || !node.row.id || !context.state.collapsed.has(node.row.id);
    lines.push(treeLineHtml(node, trail, isLast, children.length > 0, open, !context.matches(node.row), context));
    if (!open) return;
    const childTrail = node.depth === 0 ? [] : [...trail, !isLast];
    children.forEach((child, index) => emit(child, childTrail, index === children.length - 1));
  };

  for (const root of model.roots) emit(root, [], true);
  return lines.join('');
}

function flatLinesHtml<TRow extends EventLogRow>(
  model: LogModel<TRow>,
  matches: (row: TRow) => boolean,
  query: string
): string {
  return model.nodes
    .filter((node) => node.row.layout !== 'tree' && matches(node.row))
    .map((node) => {
      const { row } = node;
      if (!model.hasTree) {
        return `<div class="log-line">
      <span class="log-time">${Number(row.at || 0).toFixed(3)}s</span>
      ${descriptionHtml(row, query)}
    </div>`;
      }

      // Each row names its owning group so ownership stays visible in time order; flat-only rows jump to their parent.
      const root = (node.root ?? node).row;
      const target = row.layout === 'flat' ? node.parent : node;
      const owner =
        root.ordinal != null && target
          ? `<button type="button" class="log-owner" data-goto="${target.key}" title="Show in tree">#${root.ordinal}</button>`
          : '<span class="log-owner log-owner-none"></span>';
      return `<div class="log-line" data-key="${node.key}" data-root="${(node.root ?? node).key}">
      <span class="log-time">${Number(row.at || 0).toFixed(3)}s</span>${owner}${badgesHtml(row)}${descriptionHtml(row, query)}
    </div>`;
    })
    .join('');
}

/** Names every hop from a row up to its group, including how each link was established. */
function traceHtml<TRow extends EventLogRow>(node: LogNode<TRow>): string {
  const parts: string[] = [];
  for (let current: LogNode<TRow> | null = node; current; current = current.parent) {
    parts.push(`<span class="log-trace-node">${escapeHtml(current.row.description)}</span>`);
    if (!current.parent) continue;
    const link = current.row.parentLink;
    const inferred = link?.kind === 'inferred';
    parts.push(
      ` <span class="log-trace-hop${inferred ? ' log-trace-inferred' : ''}">← ${escapeHtml(link?.label || 'owned by')} ←</span> `
    );
  }

  const root = (node.root ?? node).row;
  if (node.row.orphan) parts.push(' <span class="log-trace-hop">· no owner found</span>');
  else if (root.ordinal != null) parts.push(` <span class="log-trace-hop">· #${root.ordinal}</span>`);
  return parts.join('');
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

export function mountEventLog<TRow extends EventLogRow>(
  container: HTMLElement | null | undefined,
  rows: readonly TRow[],
  options: EventLogMountOptions = {}
): void {
  if (!container) return;
  const resolvedRows: readonly TRow[] = rows || [];
  const model = buildLogModel(resolvedRows);
  const metricUnit = options.metricUnit || ['value', 'values'];
  const state = viewStates.get(container) || {
    view: 'tree',
    timeMode: 'offset',
    hiddenSources: new Set<string>(),
    collapsed: new Set<string>()
  };
  viewStates.set(container, state);
  const summaryMemo = new Map<LogNode<TRow>, LogSummary>();
  const previousDetails = container.querySelector<HTMLDetailsElement>('[data-role="event-log-details"]');
  const previousLog = container.querySelector<HTMLElement>('[data-role="event-log-rows"]');
  const scrollTop = previousLog?.scrollTop || 0;
  // Keep readers in place after recalculation; readers at the end follow the updated log.
  const followEnd = Boolean(
    previousLog && scrollTop > 0 && previousLog.scrollHeight - previousLog.clientHeight - scrollTop <= 1
  );
  const wasMounted = Boolean(previousDetails);
  // Preserve disclosure state when simulation results rerender.
  const open = wasMounted ? Boolean(previousDetails?.open) : Boolean(options.initiallyOpen);
  // Preserve the free-text search across result rerenders, like the per-container view state.
  const previousSearch = container.querySelector<HTMLInputElement>('[data-role="event-log-search"]');
  let searchQuery = previousSearch?.value || '';
  const title = options.title || 'Event Log';
  const filename = options.filename || 'event-log.csv';
  const treeView = (): boolean => model.hasTree && state.view === 'tree';

  const rowMatches = (row: TRow): boolean => {
    const query = searchQuery.trim().toLowerCase();
    return (
      (!query || String(row.description).toLowerCase().includes(query)) &&
      (!row.source || !state.hiddenSources.has(row.source.id))
    );
  };

  const linesHtml = (): string => {
    const html = treeView()
      ? treeLinesHtml(model, {
          matches: rowMatches,
          // Searching reveals matches inside collapsed groups.
          forceOpen: Boolean(searchQuery.trim()),
          state,
          query: searchQuery,
          memo: summaryMemo,
          metricUnit
        })
      : flatLinesHtml(model, rowMatches, searchQuery);
    return html || (resolvedRows.length ? '<div class="log-empty">No events match the current filters.</div>' : '');
  };

  const segmented = (role: string, label: string, key: string, current: string, choices: [string, string][]) =>
    `<div class="log-segmented" role="group" aria-label="${label}" data-role="${role}">${choices
      .map(
        ([value, text]) =>
          `<button type="button" data-${key}="${value}" aria-pressed="${value === current}">${text}</button>`
      )
      .join('')}</div>`;
  const treeControls = model.hasTree
    ? `${segmented('event-log-view', 'Event log layout', 'view', state.view, [
        ['tree', 'Tree'],
        ['flat', 'Chronological']
      ])}
      <span class="log-tree-tools" data-role="event-log-tree-tools"${treeView() ? '' : ' hidden'}>
        <button type="button" class="log-jump" data-role="event-log-expand">Expand all</button>
        <button type="button" class="log-jump" data-role="event-log-collapse">Collapse all</button>
        ${segmented('event-log-times', 'Child row times', 'times', state.timeMode, [
          ['offset', '+Offset'],
          ['absolute', 'Absolute']
        ])}
      </span>`
    : '';
  const sourceControls =
    model.hasTree && model.sources.length > 1
      ? `<div class="log-sources" role="group" aria-label="Show sources"><span>Show:</span>${model.sources
          .map((source) => {
            const sourceClass = safeClassNames(source.id);
            return `<button type="button" class="log-source${sourceClass ? ` log-source-${sourceClass}` : ''}" data-source="${escapeHtml(source.id)}" aria-pressed="${!state.hiddenSources.has(source.id)}">${escapeHtml(source.label)}</button>`;
          })
          .join('')}</div>`
      : '';

  const initialLines = open ? linesHtml() : '';
  container.innerHTML = `<details class="res-log-wrap" data-role="event-log-details"${open ? ' open' : ''}>
    <summary>${escapeHtml(title)} (${resolvedRows.filter((row) => row.layout !== 'tree').length} events)</summary>
    <div class="log-controls">
      <button type="button" class="btn-csv-export" data-role="event-log-download"
        data-filename="${escapeHtml(filename)}">Download CSV Log</button>
      <button type="button" class="log-jump" data-role="event-log-start">Jump to start</button>
      <button type="button" class="log-jump" data-role="event-log-end">Jump to end</button>
      <input type="search" class="log-search" data-role="event-log-search"
        aria-label="Filter events" placeholder="Filter events…" value="${escapeHtml(searchQuery)}" />
      ${treeControls}
    </div>
    ${sourceControls}
    <div class="res-log" data-role="event-log-rows"${open ? ' data-rendered="true"' : ''}>${initialLines}</div>
    ${model.hasTree ? '<div class="log-trace" data-role="event-log-trace" aria-live="polite">Hover or focus a row to trace it back to its cause.</div>' : ''}
  </details>`;

  const details = container.querySelector<HTMLDetailsElement>('[data-role="event-log-details"]');
  const logElement = container.querySelector<HTMLElement>('[data-role="event-log-rows"]');
  const traceElement = container.querySelector<HTMLElement>('[data-role="event-log-trace"]');
  const treeTools = container.querySelector<HTMLElement>('[data-role="event-log-tree-tools"]');
  const restoreScroll = (): void => {
    if (logElement) logElement.scrollTop = followEnd ? logElement.scrollHeight : scrollTop;
  };

  const renderLogLines = (force = false): void => {
    // Large logs are rendered lazily the first time the details element opens.
    if (!logElement || (!force && logElement.dataset.rendered === 'true')) {
      return;
    }

    const previousTop = logElement.scrollTop;
    logElement.innerHTML = linesHtml();
    logElement.dataset.rendered = 'true';
    logElement.scrollTop = previousTop;
  };

  const rerender = (): void => {
    if (details?.open) renderLogLines(true);
  };

  if (details?.open) restoreScroll();
  if (details) {
    details.ontoggle = () => {
      if (details.open && logElement?.dataset.rendered !== 'true') {
        renderLogLines();
        restoreScroll();
      }
    };
  }

  // Explicit jumps avoid dragging through long logs and leave normal reading under user control.
  for (const edge of ['start', 'end']) {
    const button = container.querySelector<HTMLButtonElement>(`[data-role="event-log-${edge}"]`);
    if (button && logElement)
      button.onclick = () => {
        logElement.scrollTop = edge === 'end' ? logElement.scrollHeight : 0;
      };
  }

  const search = container.querySelector<HTMLInputElement>('[data-role="event-log-search"]');
  if (search) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    search.oninput = () => {
      searchQuery = search.value;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      // Debounce so large logs aren't re-rendered on every keystroke.
      debounceTimer = setTimeout(rerender, 200);
    };
  }

  const download = container.querySelector<HTMLElement>('[data-role="event-log-download"]');
  // Export the complete log, independent of temporary display filters.
  if (download) download.onclick = () => downloadCsv(resolvedRows, filename);

  if (!model.hasTree) return;

  const syncSegmented = (role: string, key: string, current: string): void => {
    for (const button of container.querySelectorAll<HTMLButtonElement>(`[data-role="${role}"] button`)) {
      button.setAttribute('aria-pressed', String(button.dataset[key] === current));
    }
  };

  const setView = (view: LogView): void => {
    state.view = view;
    syncSegmented('event-log-view', 'view', view);
    if (treeTools) treeTools.hidden = view !== 'tree';
    rerender();
  };

  const view = container.querySelector<HTMLElement>('[data-role="event-log-view"]');
  if (view) {
    view.onclick = (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-view]');
      if (button) setView(button.dataset.view === 'flat' ? 'flat' : 'tree');
    };
  }

  const times = container.querySelector<HTMLElement>('[data-role="event-log-times"]');
  if (times) {
    times.onclick = (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-times]');
      if (!button) return;
      state.timeMode = button.dataset.times === 'absolute' ? 'absolute' : 'offset';
      syncSegmented('event-log-times', 'times', state.timeMode);
      rerender();
    };
  }

  const expand = container.querySelector<HTMLButtonElement>('[data-role="event-log-expand"]');
  if (expand) {
    expand.onclick = () => {
      state.collapsed.clear();
      rerender();
    };
  }

  const collapse = container.querySelector<HTMLButtonElement>('[data-role="event-log-collapse"]');
  if (collapse) {
    collapse.onclick = () => {
      for (const node of model.nodes) if (node.children.length && node.row.id) state.collapsed.add(node.row.id);
      rerender();
    };
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>('[data-source]')) {
    button.onclick = () => {
      const id = button.dataset.source || '';
      const shown = state.hiddenSources.has(id);
      if (shown) state.hiddenSources.delete(id);
      else state.hiddenSources.add(id);
      button.setAttribute('aria-pressed', String(shown));
      rerender();
    };
  }

  if (!logElement) return;

  const nodeFrom = (target: EventTarget | null, attribute: string): LogNode<TRow> | undefined => {
    const element = (target as Element | null)?.closest?.<HTMLElement>(`[${attribute}]`);
    const key = Number(element?.getAttribute(attribute));
    return element && Number.isInteger(key) ? model.nodes[key] : undefined;
  };

  // Highlight the hovered row's whole group and its ancestor chain, and name each hop below the log.
  const trace = (node: LogNode<TRow>): void => {
    if (traceElement) traceElement.innerHTML = traceHtml(node);
    for (const line of logElement.querySelectorAll('.log-family, .log-chain')) {
      line.classList.remove('log-family', 'log-chain');
    }

    const chain = new Set<string>();
    for (let current: LogNode<TRow> | null = node; current; current = current.parent) chain.add(String(current.key));
    const rootKey = String((node.root ?? node).key);
    for (const line of logElement.querySelectorAll<HTMLElement>(`[data-root="${rootKey}"]`)) {
      line.classList.add(chain.has(line.dataset.key || '') ? 'log-chain' : 'log-family');
    }
  };

  const toggle = (node: LogNode<TRow>): void => {
    const id = node.row.id;
    if (!id) return;
    if (state.collapsed.has(id)) state.collapsed.delete(id);
    else state.collapsed.add(id);
    rerender();
    logElement.querySelector<HTMLElement>(`[data-toggle="${node.key}"]`)?.focus({ preventScroll: true });
  };

  // Reveal a row inside the tree from the chronological layout, expanding its ancestors first.
  const reveal = (node: LogNode<TRow>): void => {
    for (let current = node.parent; current; current = current.parent) {
      if (current.row.id) state.collapsed.delete(current.row.id);
    }

    setView('tree');
    const line = logElement.querySelector<HTMLElement>(`.log-line[data-key="${node.key}"]`);
    if (!line) return;
    const offset = line.getBoundingClientRect().top - logElement.getBoundingClientRect().top;
    logElement.scrollTop += offset - logElement.clientHeight / 3;
    line.classList.add('log-flash');
    line.focus({ preventScroll: true });
    trace(node);
  };

  logElement.onclick = (event) => {
    const goto = nodeFrom(event.target, 'data-goto');
    if (goto) return reveal(goto);
    const button = nodeFrom(event.target, 'data-toggle');
    if (button) return toggle(button);
    // Clicking elsewhere on a group row toggles it, except inside nested controls such as damage details.
    if (!treeView() || (event.target as Element | null)?.closest?.('details, button, a')) return;
    const line = nodeFrom(event.target, 'data-key');
    if (line?.children.length) toggle(line);
  };

  let traced = '';
  const onPoint = (event: Event): void => {
    const node = nodeFrom(event.target, 'data-key');
    if (!node || String(node.key) === traced) return;
    traced = String(node.key);
    trace(node);
  };

  logElement.onmouseover = onPoint;
  // The log element is recreated on every mount, so this listener never accumulates.
  logElement.addEventListener('focusin', onPoint);
}
