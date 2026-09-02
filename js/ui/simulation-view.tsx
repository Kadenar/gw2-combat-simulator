import type { CSSProperties, ReactElement } from 'react';
import { renderReact } from '#ui/react-root.js';

export interface SimulationMetricViewModel {
  readonly label: string;
  readonly value: unknown;
  readonly className?: string;
}

export interface SimulationTableViewModel {
  readonly kind: 'table';
  readonly title: string;
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface SimulationTimelineViewModel {
  readonly kind: 'timeline';
  readonly title: string;
  readonly durationMs: number;
  readonly points: readonly { readonly atMs: number; readonly label: string }[];
}

export interface SimulationEffectLanesViewModel {
  readonly kind: 'effect-lanes';
  readonly title: string;
  readonly lanes: readonly {
    readonly label: string;
    readonly intervals: readonly { readonly startMs: number; readonly endMs: number }[];
  }[];
}

export interface SimulationWarningsViewModel {
  readonly kind: 'warnings';
  readonly title: string;
  readonly warnings: readonly string[];
}

export interface SimulationStateSnapshotViewModel {
  readonly kind: 'state-snapshot';
  readonly title: string;
  readonly entries: readonly { readonly label: string; readonly value: unknown }[];
}

export interface SimulationExtensionViewModel {
  readonly kind: 'extension';
  mount(container: HTMLElement): void;
}

export type SimulationPanelViewModel =
  | SimulationTableViewModel
  | SimulationTimelineViewModel
  | SimulationEffectLanesViewModel
  | SimulationWarningsViewModel
  | SimulationStateSnapshotViewModel
  | SimulationExtensionViewModel;

export interface SimulationViewSection {
  readonly metrics?: readonly SimulationMetricViewModel[];
  readonly summaryPlaceholder?: boolean;
  readonly panels?: readonly SimulationPanelViewModel[];
}

export interface SimulationEmptyViewModel {
  readonly title: string;
  readonly message: string;
  readonly link?: { readonly href: string; readonly label: string };
}

/** Complete shell-facing projection; games may add extension panels without changing neutral contracts. */
export interface SimulationViewModel {
  readonly summary: SimulationViewSection;
  readonly workspace: SimulationViewSection | null;
  readonly analysis: SimulationViewSection | null;
  readonly floatingDps?: string | null;
  readonly analysisEmpty?: SimulationEmptyViewModel;
  readonly afterAnalysisRender?: () => void;
}

function number(value: number): string {
  return Number(value || 0).toLocaleString();
}

function Panel({ panel }: { panel: Exclude<SimulationPanelViewModel, SimulationExtensionViewModel> }): ReactElement {
  if (panel.kind === 'table') {
    return (
      <section className='sim-panel sim-table'>
        <h4>{panel.title}</h4>
        <div role='table'>
          <div role='row' className='sim-table-header'>
            {panel.columns.map((column) => (
              <span role='columnheader' key={column.key}>
                {column.label}
              </span>
            ))}
          </div>
          {panel.rows.map((row, rowIndex) => (
            <div role='row' key={rowIndex}>
              {panel.columns.map((column) => (
                <span role='cell' key={column.key}>
                  {String(row[column.key] ?? '')}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (panel.kind === 'timeline') {
    const duration = Math.max(1, Number(panel.durationMs || 0));
    return (
      <section className='sim-panel sim-timeline'>
        <h4>{panel.title}</h4>
        <div className='sim-timeline-track'>
          {panel.points.map((point, index) => (
            <span
              className='sim-timeline-point'
              style={{ left: `${Math.max(0, Math.min(100, (point.atMs / duration) * 100))}%` }}
              title={`${point.label} at ${number(point.atMs)}ms`}
              key={`${point.atMs}:${index}`}
            />
          ))}
        </div>
      </section>
    );
  }

  if (panel.kind === 'effect-lanes') {
    const duration = Math.max(1, ...panel.lanes.flatMap(({ intervals }) => intervals.map(({ endMs }) => endMs)));
    return (
      <section className='sim-panel sim-effect-lanes'>
        <h4>{panel.title}</h4>
        {panel.lanes.map((lane) => (
          <div className='sim-effect-lane' key={lane.label}>
            <span>{lane.label}</span>
            <div>
              {lane.intervals.map(({ startMs, endMs }, index) => (
                <i
                  style={
                    {
                      left: `${(startMs / duration) * 100}%`,
                      width: `${Math.max(0, ((endMs - startMs) / duration) * 100)}%`
                    } as CSSProperties
                  }
                  key={`${startMs}:${endMs}:${index}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (panel.kind === 'warnings') {
    return (
      <section className='sim-panel sim-warnings'>
        <h4>{panel.title}</h4>
        <ul>
          {panel.warnings.map((warning, index) => (
            <li key={`${warning}:${index}`}>{warning}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className='sim-panel sim-state-snapshot'>
      <h4>{panel.title}</h4>
      <dl>
        {panel.entries.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{String(value ?? '')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Renders the framework-neutral summary and panel models as one owned React subtree. */
export function SimulationSection({ view }: { view: SimulationViewSection }): ReactElement {
  const metrics = view.metrics || [];
  const panels = (view.panels || []).filter(
    (panel): panel is Exclude<SimulationPanelViewModel, SimulationExtensionViewModel> => panel.kind !== 'extension'
  );
  return (
    <>
      {metrics.length ? (
        <div className={`sim-summary res-summary${view.summaryPlaceholder ? ' res-summary-placeholder' : ''}`}>
          {metrics.map((metric) => (
            <div className='res-stat' key={metric.label}>
              <span className='res-label'>{metric.label}</span>
              <span className={`res-val${metric.className ? ` ${metric.className}` : ''}`}>
                {String(metric.value ?? '')}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {panels.map((panel) => (
        <Panel panel={panel} key={`${panel.kind}:${panel.title}`} />
      ))}
    </>
  );
}

/** Renders stable neutral panels and delegates only explicitly game-owned extension panels. */
export function mountSimulationView(container: HTMLElement | null | undefined, view: SimulationViewSection): void {
  if (!container) return;
  const extensions = (view.panels || []).filter(
    (panel): panel is SimulationExtensionViewModel => panel.kind === 'extension'
  );
  if (extensions.length) {
    for (const extension of extensions) extension.mount(container);
    return;
  }

  renderReact(container, <SimulationSection view={view} />);
}

/** Clears a previously mounted neutral or extension result surface through its retained React root. */
export function clearSimulationView(container: HTMLElement | null | undefined): void {
  if (container) renderReact(container, null);
}
