/** Attaches profession-owned occupancy without preparing row labels or requiring authored commands. */
import {
  mechanicResourceSpends,
  timelineDeadTimeMarkers,
  type TimelineDeadTimeMarker
} from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  ProfessionTimelineOccupancyContext,
  ProfessionUiContract
} from '#gw2/platform/profession-presentation/types.js';
import { combatActivityEndMs, combatActivityStartMs, failedPlayerCasts } from '#gw2/platform/results/cast-activity.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export interface TimelineOccupancySource {
  readonly revision?: number;
  readonly ui: Pick<ProfessionUiContract, 'timelineOccupiedInterval'>;
  readonly context: Pick<ProfessionTimelineOccupancyContext, 'build' | 'catalog' | 'specialization'>;
}

/** Browser composition supplies the active owner without exposing application state to its projection. */
export function timelineOccupancySource(app: ProfessionAppState): TimelineOccupancySource {
  return {
    revision: app.analysis.state.buildRevision,
    ui: app.profession.ui,
    context: {
      build: app.build,
      catalog: app.activeCatalog,
      specialization: app.adapter.eliteSpecialization(app.build)
    }
  };
}

const activityCache = new WeakMap<
  Gw2SimulationResult,
  { source: TimelineOccupancySource; markers: readonly TimelineDeadTimeMarker[] }
>();

/** Share the occupancy union across result consumers; source revisions invalidate edited build inputs. */
export function combatDeadTimeMarkers(
  result: Gw2SimulationResult,
  source: TimelineOccupancySource
): readonly TimelineDeadTimeMarker[] {
  const cached = activityCache.get(result);

  if (
    cached &&
    cached.source.revision === source.revision &&
    cached.source.ui.timelineOccupiedInterval === source.ui.timelineOccupiedInterval &&
    cached.source.context.build === source.context.build &&
    cached.source.context.catalog === source.context.catalog &&
    cached.source.context.specialization === source.context.specialization
  )
    return cached.markers;

  const combatStart = combatActivityStartMs(result);
  const markers = timelineDeadTimeMarkers(presentedTimelineSteps(result, source), result.resolvedEvents || [], {
    includeFailedCasts: false,
    encounterPhases: result.encounter?.phases,
    startMs: combatStart,
    endMs: combatActivityEndMs(result)
  });
  const indices = new Map((result.steps || []).map((step) => [step.activationId, step.rotationCommandIndex]));
  for (const cast of failedPlayerCasts(result)) {
    markers.push({
      start: cast.start,
      end: cast.end,
      durationMs: cast.durationMs,
      insertionIndex: indices.get(cast.action.activationId) ?? 0,
      reason: cast.action.cancelled ? 'cancelled-before-commit' : 'zero-damage-cast',
      skill: cast.action.skillName || cast.action.name || String(cast.action.skillId)
    });
  }

  markers.sort((left, right) => left.start - right.start || left.insertionIndex - right.insertionIndex);
  activityCache.set(result, { source, markers });
  return markers;
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
