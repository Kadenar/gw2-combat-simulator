import { catalogSkillById, type RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import {
  mergeCompositeActions,
  mergedActionStatus,
  type CompositeAction
} from '#gw2/integrations/logs/shared/rotation/rules/composites.js';
import { referenceCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/data/beguiling-haze-timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { skillNumberFromContext, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';

/** Align combat within a clipped opening teleport using the main-minus-follow-up offset, without adding inputs. */
export function alignConduitHazeCombatOffset<Action extends CompositeAction & { readonly replayDurationMs?: number }>(
  actions: readonly Action[],
  catalog: RotationCatalog | null,
  combatStart: number
): readonly Action[] {
  const opener = actions.find((action) => action.end > action.start);

  if (!opener || opener.rawSkillId !== 77047 || opener.start >= combatStart || opener.end < combatStart) return actions;

  const skill = catalogSkillById(catalog, 77141);

  if (!skill) return actions;

  const followUpMs = skillNumberFromContext({ catalog }, ID.BEGUILING_HAZE_FOLLOW_UP, 'castTimeMs');

  if (opener.replayDurationMs !== followUpMs) return actions;

  const mainMs = referenceCastTimeMs(skill);
  const offsetMs = mainMs - followUpMs;

  if (!(offsetMs > 0)) return actions;

  // Keep the recorded end and combat instant fixed; only their offset from the complete main input changes.
  return actions.map((action) =>
    action === opener ? { ...action, start: action.start - offsetMs, replayDurationMs: mainMs } : action
  );
}

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

  if (!skill || !merged.some((action) => action.rawSkillId === 77141 || action.rawSkillId === 77047)) return merged;

  // Follow-ups use their selected duration rather than the main skill's full cast.
  const followUp = requireSkillFromContext({ catalog }, ID.BEGUILING_HAZE_FOLLOW_UP);

  return merged.map((action) =>
    [77141, 77047].includes(action.rawSkillId)
      ? {
          ...action,
          replayDurationMs:
            beguilingHazeCastDuration(
              referenceCastTimeMs(skill) / 1000,
              action.rawSkillId === 77047 && !mainCasts.has(action),
              followUp
            ) * 1000
        }
      : action
  );
}
