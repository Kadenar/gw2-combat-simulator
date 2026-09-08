import { catalogSkillById, type RotationCatalog } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  mergeCompositeActions,
  mergedActionStatus,
  type CompositeAction
} from '#gw2/integrations/logs/lib/rotation/rules/composites.js';
import { quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/specializations/conduit/mechanics/beguiling-haze.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';

/** Combines Haze's launch and teleport and budgets the simulator's full main/follow-up cast without duplicate waits. */
export function normalizeConduitHazeActions<Action extends CompositeAction>(
  actions: readonly Action[],
  catalog: RotationCatalog | null
): Action[] {
  const mainCasts = new Set<Action>();
  const merged = mergeCompositeActions(
    actions,
    [{ startId: 77141, finishId: 77047, maximumGapMs: 10 }],
    (launch, teleport) => {
      const action = {
        ...teleport,
        start: launch.start,
        eventIndex: launch.eventIndex,
        status: mergedActionStatus(launch.status, teleport.status)
      };
      mainCasts.add(action);
      return action;
    }
  );
  const skill = catalogSkillById(catalog, 77141);
  const followUp = catalog?.balanceProfilesById?.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);
  const extension = catalog?.balanceProfilesById?.get(CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension);
  if (!skill || !followUp || !extension) return merged;

  return merged.map((action) =>
    [77141, 77047].includes(action.rawSkillId)
      ? {
          ...action,
          replayDurationMs:
            beguilingHazeCastDuration(
              quicknessReferenceCastTimeMs(skill) / 1000,
              action.rawSkillId === 77047 && !mainCasts.has(action),
              true,
              followUp,
              extension
            ) * 1000
        }
      : action
  );
}
