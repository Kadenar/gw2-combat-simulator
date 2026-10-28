import type { ChartOptions } from '#gw2/app/results/charts/time-series-view.js';
import { resultSummaryMetrics } from '#gw2/app/results/model.js';
import type { ResultSummaryMetric } from '#gw2/app/results/summary-metrics.js';
import type { ResultSummaryModel } from '#gw2/app/results/summary-view.js';
import type { EncounterTimelineMarker } from '#gw2/app/rotation/timeline/encounter.js';
import type { targetHealthTimelineMarkers, TimelineDeadTimeOptions } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { SimulationExtensionViewModel, SimulationViewModel } from '#ui/results/simulation-view.js';

/** Shared renderers consume observed markers and display values without interpreting workspace inputs. */
export interface TimelinePresentation {
  readonly healthMarkers: ReturnType<typeof targetHealthTimelineMarkers>;
  readonly encounterMarkers: readonly EncounterTimelineMarker[];
  readonly downtimePhases: TimelineDeadTimeOptions['encounterPhases'];
}

export interface WorkspaceResultPresentation {
  readonly summary: Omit<ResultSummaryModel, 'metrics'> & { readonly metrics: readonly ResultSummaryMetric[] };
  readonly chartOptions: Pick<
    ChartOptions,
    'healthBreakpoints' | 'encounterPhases' | 'targetStartingHealthPercent' | 'targetDied'
  >;
  readonly analysisPanels: readonly SimulationExtensionViewModel[];
  readonly afterAnalysisRender?: SimulationViewModel['afterAnalysisRender'];
}

export interface WorkspacePresentation {
  readonly analysisTitle: string;
  readonly authoringLink: { readonly href: string; readonly label: string };
  timeline(app: ProfessionAppState, build: Gw2CanonicalBuild, result: ProfessionAppResult | null): TimelinePresentation;
  results(app: ProfessionAppState, result: ProfessionAppResult): WorkspaceResultPresentation | null;
}

/** Both workspaces label a deterministic baseline consistently when an RNG comparison has been requested. */
export function presentationMetrics(result: ProfessionAppResult) {
  return resultSummaryMetrics(result).map((metric) =>
    result.randomDistributionRequested && metric.label === 'Player DPS'
      ? { ...metric, label: 'Baseline Player DPS' }
      : metric
  );
}
