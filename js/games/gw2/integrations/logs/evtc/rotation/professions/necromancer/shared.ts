import { EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import { hasNearbyAction } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type { EvtcProfessionReconstructionContext } from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export { instantAction as effectAction } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';

export const INSTANT_SIGNAL_WINDOW_MS = 150;

/** Counts player-owned stacks captured in the EVTC initial buff snapshot. */
export function initialSelfBuffCount(log: ParsedEvtc, playerAddress: bigint, skillId: number): number {
  return log.events.filter(
    (event) =>
      event.source === playerAddress &&
      event.target === playerAddress &&
      event.skillId === skillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
  ).length;
}

export function hasRecordedAction(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name: string,
  time: number,
  windowMs: number
): boolean {
  return hasNearbyAction(context.recordedActions, { name, skillId }, time, windowMs);
}
