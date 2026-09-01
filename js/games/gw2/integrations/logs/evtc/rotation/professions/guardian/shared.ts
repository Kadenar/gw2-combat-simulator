import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface GuardianActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export const SWAP_WEAPONS = Object.freeze({
  name: 'Swap Weapons',
  skillId: -3
});
export const SIGNAL_WINDOW_MS = 150;

export { canonicalAction } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';

const PHYSICAL_WEAPON_SETS = new Set([4, 5]);

export function skillFor(context: EvtcProfessionReconstructionContext, identity: GuardianActionIdentity) {
  return findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
}

export function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: GuardianActionIdentity
): number {
  const normalizedName = identity.name.toLowerCase();
  const completed = context.recordedActions.filter(
    (action) => action.status === 'completed' && action.end > action.start
  );
  const exactDurations = completed
    .filter((action) => action.rawSkillId === identity.skillId)
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  const durations = completed
    .filter((action) => action.rawName.trim().toLowerCase() === normalizedName)
    .map((action) => action.end - action.start)
    .sort((left, right) => left - right);
  if (exactDurations.length) {
    return exactDurations[Math.floor(exactDurations.length / 2)];
  }

  if (durations.length) return durations[Math.floor(durations.length / 2)];
  const skill = skillFor(context, identity);
  return Math.max(0, Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0));
}

export function firstPlayerEventTime(context: EvtcProfessionReconstructionContext): number {
  return Math.min(
    ...context.log.events
      .filter(
        (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
      )
      .map((event) => event.time)
  );
}

export function isPhysicalWeaponSwap(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): boolean {
  const event = context.log.events[action.eventIndex];
  return (
    event != null && PHYSICAL_WEAPON_SETS.has(Number(event.target)) && PHYSICAL_WEAPON_SETS.has(Number(event.value))
  );
}

export function normalizeDefaultGuardianWeaponTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.filter(
    (action) => action.rawName !== SWAP_WEAPONS.name || context.log.events[action.eventIndex] != null
  );
}
