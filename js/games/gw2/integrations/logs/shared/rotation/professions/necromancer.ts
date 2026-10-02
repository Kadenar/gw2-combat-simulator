import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

const SHROUD_TRANSITION_IDS: ReadonlySet<number> = new Set([
  ID.DEATH_SHROUD,
  ID.END_DEATH_SHROUD,
  ID.REAPERS_SHROUD,
  ID.EXIT_REAPERS_SHROUD,
  ID.HARBINGER_SHROUD,
  ID.EXIT_HARBINGER_SHROUD,
  ID.RITUALISTS_SHROUD,
  ID.EXIT_RITUALISTS_SHROUD
]);
const DUPLICATE_SWAP_WINDOW_MS = 5;

/** Removes duplicate shroud bar signals and cancelled exit autoattacks while preserving the source timing gaps. */
export function reconstructNecromancerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const shroudTransitions = context.recordedActions.filter((action) => SHROUD_TRANSITION_IDS.has(action.rawSkillId));
  return context.recordedActions.filter((action) => {
    // EI can start a cancelled Life Rend beside the exit signal after its shroud bar has already closed.
    if (
      action.rawSkillId === ID.LIFE_REND &&
      action.status === 'interrupted' &&
      shroudTransitions.some(
        (transition) =>
          transition.rawSkillId === ID.EXIT_REAPERS_SHROUD &&
          action.start >= transition.start &&
          action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
      )
    )
      return false;
    return (
      !action.isSwap ||
      // EI also flags shroud transitions as swaps; keep them instead of matching them against themselves.
      SHROUD_TRANSITION_IDS.has(action.rawSkillId) ||
      !shroudTransitions.some(
        (transition) => action.start >= transition.start && action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
      )
    );
  });
}
