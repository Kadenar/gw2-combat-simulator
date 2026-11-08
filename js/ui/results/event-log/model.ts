/** Builds causal event trees, descendant summaries, and CSV from game-neutral display rows. */

/** One line of a calculation: what it is, how it was derived, and the value it contributes. */
export interface EventLogCalculationStep {
  readonly label: string;
  readonly explanation: string;
  readonly value: string;
  /** Unformatted value offered as a tooltip, so displayed numbers can stay readable. */
  readonly exact: string;
}

/** One factor behind a calculation, with how the result would change without it. */
export interface EventLogCalculationFactor {
  readonly label: string;
  readonly value: string;
  readonly impact: string;
  readonly exact: string;
}

/** A row whose value was computed: leads with its equation and keeps unformatted facts a click away. */
export interface EventLogCalculation {
  readonly heading: string;
  readonly meta: string;
  /** Steps in evaluation order; the final step is the result. */
  readonly steps: readonly EventLogCalculationStep[];
  readonly factors: readonly EventLogCalculationFactor[];
  readonly effects: readonly string[];
  readonly trace: string;
  /** Every recorded fact at full precision, listed under the trace and copied by its action. */
  readonly raw: readonly string[];
}

export interface EventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly details?: readonly string[];
  readonly calculation?: EventLogCalculation;
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

export interface LogNode<TRow extends EventLogRow> {
  readonly row: TRow;
  readonly key: number;
  parent: LogNode<TRow> | null;
  readonly children: LogNode<TRow>[];
  root: LogNode<TRow> | null;
  depth: number;
}

export interface LogModel<TRow extends EventLogRow> {
  readonly nodes: readonly LogNode<TRow>[];
  readonly roots: readonly LogNode<TRow>[];
  readonly hasTree: boolean;
  readonly sources: readonly EventLogSource[];
}

export interface LogSummary {
  count: number;
  metricCount: number;
  metricTotal: number;
  readonly tags: Map<string, string>;
}

/** Links rows into a forest by `parentId`; rows keep input order so siblings stay chronological. */
export function buildLogModel<TRow extends EventLogRow>(rows: readonly TRow[]): LogModel<TRow> {
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
export function summarize<TRow extends EventLogRow>(
  node: LogNode<TRow>,
  memo: Map<LogNode<TRow>, LogSummary>
): LogSummary {
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
