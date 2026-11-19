import type { DpsReportPlayer } from '#gw2/integrations/logs/dps-report/types.js';
import type { RecordedLogAction } from '#gw2/integrations/logs/shared/rotation/normalization.js';
import {
  SIGNET_OF_MIGHT_PASSIVE_ID,
  signetOfMightProcAt
} from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

/** Use the player's passive timeline to distinguish Lesser Signet of Might from a manual signet activation. */
export function applyWarriorSignetEvidence(actions: RecordedLogAction[], player: DpsReportPlayer): RecordedLogAction[] {
  const states = player.buffUptimes?.find((buff) => buff.id === SIGNET_OF_MIGHT_PASSIVE_ID)?.states;

  if (!states?.length) return actions;

  return actions.map((action) =>
    action.rawSkillId === ID.SIGNET_OF_MIGHT && action.status === 'instant' && signetOfMightProcAt(action.start, states)
      ? { ...action, canonicalSkillId: ID.LESSER_SIGNET_OF_MIGHT }
      : action
  );
}
