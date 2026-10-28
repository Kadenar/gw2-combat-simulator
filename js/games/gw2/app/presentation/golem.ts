import { professionPlanningState } from '#gw2/app/rotation/context.js';
import { targetHealthTimelineMarkers } from '#gw2/app/rotation/timeline/model.js';
import { targetHealthBreakpointSnapshots } from '#gw2/app/results/summary-metrics.js';
import { renderPatchComparison } from '#gw2/app/patch-preview/view.js';
import { presentationMetrics, type WorkspacePresentation } from '#gw2/app/presentation/model.js';

/** Golem presents one target's health milestones and makes patch comparison available alongside analysis. */
export function createGolemPresentation(): WorkspacePresentation {
  return {
    analysisTitle: 'Golem analysis',
    authoringLink: { href: '#workspace', label: 'the Workspace' },
    timeline(app, build, result) {
      const thresholds =
        app.profession.ui.targetHealthThresholds?.({
          catalog: app.activeCatalog,
          specialization: app.adapter.eliteSpecialization(build),
          build,
          professionState: professionPlanningState(result)
        }) || [];
      return {
        healthMarkers: targetHealthTimelineMarkers(
          result,
          build.targetHealth,
          thresholds,
          build.rotation.length,
          build.targetStartingHealthPercent
        ),
        encounterMarkers: [],
        downtimePhases: []
      };
    },
    results(app, result) {
      const breakpoints = targetHealthBreakpointSnapshots(
        result,
        app.build.targetHealth,
        undefined,
        app.build.targetStartingHealthPercent
      );
      return {
        summary: { metrics: presentationMetrics(result), breakpoints },
        chartOptions: {
          healthBreakpoints: breakpoints,
          encounterPhases: null,
          targetStartingHealthPercent: app.build.targetStartingHealthPercent ?? 100,
          targetDied: result.deathTime != null
        },
        analysisPanels: [],
        // Mount available comparisons in the same paint as the shared tables to keep layout stable.
        afterAnalysisRender: app.profession?.preview ? (container) => renderPatchComparison(container, app) : undefined
      };
    }
  };
}
