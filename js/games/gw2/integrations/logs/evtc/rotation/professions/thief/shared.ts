import type { EvtcProfessionReconstructionContext } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export const SIGNAL_WINDOW_MS = 150;
export const ASSASSINS_SIGNET = Object.freeze({
  name: "Assassin's Signet",
  skillId: 13046
});
export const ASSASSINS_SIGNET_ACTIVE_BUFF = 44597;

export interface ThiefActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export {
  canonicalAction,
  catalogDuration as skillDuration,
  combatStartTime as combatStart,
  hasNearbyAction as hasRecordedAction
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';

export function playerEvent(
  context: EvtcProfessionReconstructionContext,
  event: EvtcProfessionReconstructionContext['log']['events'][number]
): boolean {
  return event.source === context.playerAddress || event.target === context.playerAddress;
}

export function hasSelectedSkill(context: EvtcProfessionReconstructionContext, identity: ThiefActionIdentity): boolean {
  return (
    context.selectedSkillNames == null ||
    context.selectedSkillNames.some((name) => name.trim().toLowerCase() === identity.name.toLowerCase())
  );
}
