/** Attaches profession-owned occupancy without preparing row labels or requiring authored commands. */
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  ProfessionTimelineOccupancyContext,
  ProfessionUiContract
} from '#gw2/platform/profession-presentation/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export interface TimelineOccupancySource {
  readonly ui: Pick<ProfessionUiContract, 'timelineOccupiedInterval'>;
  readonly context: Pick<ProfessionTimelineOccupancyContext, 'build' | 'catalog' | 'specialization'>;
}

/** Browser composition supplies the active owner without exposing application state to its projection. */
export function timelineOccupancySource(app: ProfessionAppState): TimelineOccupancySource {
  return {
    ui: app.profession.ui,
    context: {
      build: app.build,
      catalog: app.activeCatalog,
      specialization: app.adapter.eliteSpecialization(app.build)
    }
  };
}

/** Timeline geometry, summary, and insights share the same interpretation of observed occupied time. */
export function presentedTimelineSteps(result: Gw2SimulationResult, source: TimelineOccupancySource) {
  const spends = mechanicResourceSpends(result);
  return (result.steps || []).map((step) => {
    const partialFill = source.ui.timelineOccupiedInterval({
      ...source.context,
      skill: step.skillId == null ? undefined : source.context.catalog?.skillsById.get(step.skillId),
      step,
      spend: spends.get(step.rotationCommandIndex)
    });
    return partialFill ? { ...step, partialFill } : step;
  });
}
