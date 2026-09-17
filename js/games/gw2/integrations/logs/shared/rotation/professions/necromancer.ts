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

/** Removes EI's weapon-swap signal for a shroud bar change while preserving independent weapon swaps. */
export function reconstructNecromancerDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const shroudTransitions = context.recordedActions.filter((action) => SHROUD_TRANSITION_IDS.has(action.rawSkillId));
  return context.recordedActions.filter(
    (action) =>
      !action.isSwap ||
      !shroudTransitions.some(
        (transition) => action.start >= transition.start && action.start - transition.start <= DUPLICATE_SWAP_WINDOW_MS
      )
  );
}
