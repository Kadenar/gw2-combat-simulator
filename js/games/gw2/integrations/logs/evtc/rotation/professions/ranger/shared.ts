import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import {
  instantAction as directAction,
  playerInstance,
  rawSkillName
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface RangerActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export interface RangerRotationSkill extends Skill {
  readonly petSkill?: boolean;
  readonly petAutonomousSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
}

export { catalogDuration as recordedDuration } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
export { directAction, playerInstance, rawSkillName };

export function firstPlayerEventTime(context: EvtcProfessionReconstructionContext): number | null {
  const times = context.log.events
    .filter(
      (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

/** Recovers a cast begun before the log starts unless matching completion evidence is already recorded. */
export function truncatedCastActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  identity: RangerActionIdentity,
  toleranceMs: number
): EvtcRecordedRotationAction[] {
  const firstEventTime = firstPlayerEventTime(context);
  if (firstEventTime == null) return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.skillId !== identity.skillId ||
      event.stateChange !== EVTC_STATE_CHANGE.ANIMATION_STOP ||
      (event.activation !== EVTC_ACTIVATION.CANCEL_FIRE && event.activation !== EVTC_ACTIVATION.RESET) ||
      event.value <= 0
    ) {
      return [];
    }

    const start = event.time - event.value;
    const alreadyRecorded = actions.some(
      (action) => action.rawSkillId === event.skillId && Math.abs(action.end - event.time) <= toleranceMs
    );
    if (alreadyRecorded || start >= firstEventTime) return [];
    return [
      {
        ...directAction(
          eventIndex,
          start,
          event.skillId,
          rawSkillName(context, event.skillId),
          identity,
          'initial-state'
        ),
        end: event.time,
        expectedDuration: Math.max(event.value, event.buffDamage),
        status: 'completed' as const,
        precast: true
      }
    ];
  });
}

export function rangerSkill(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name = rawSkillName(context, skillId)
): RangerRotationSkill | null {
  return findRotationSkill(skillId, name, context.catalog, context.profile) as RangerRotationSkill | null;
}

export function finalizeRangerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context.log);
  const completionTolerance = context.profile.specializationId === 'druid' ? 200 : 0;
  return encounterEnd == null
    ? [...actions]
    : actions.filter((action) => action.start < encounterEnd + completionTolerance);
}
