/** Recover instant weapon inputs from distinguishing buff applications when EVTC omits their activations. */
import { isBuffApply } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** The weapon's ten-second self grant distinguishes Frost Aura from shorter trait, combo, and shared grants. */
export function elementalistFrostAuraActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'elementalist') return [];

  const actions: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex } of context.evidence.eventsBySkill.get(5579) ?? []) {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      Math.abs(event.value - 10000) >= 10 ||
      !isBuffApply(context.log, event) ||
      [...context.recordedActions, ...actions].some(
        (action) => action.rawSkillId === ID.FROST_AURA && Math.abs(action.start - event.time) < 10
      )
    )
      continue;

    actions.push({
      start: event.time,
      end: event.time,
      expectedDurationMs: 0,
      rawSkillId: ID.FROST_AURA,
      rawName: 'Frost Aura',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      castOrigin: 'skill',
      metadataAccurate: false
    });
  }

  return actions;
}

export function elementalistBlindingFlashActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'elementalist') return [];

  const applications = (skillId: number) =>
    (context.evidence.eventsBySkill.get(skillId) ?? []).filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.target !== context.playerAddress &&
        event.target !== 0n &&
        event.value > 0 &&
        isBuffApply(context.log, event)
    );
  const blinds = applications(720);
  const actions: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex } of applications(742)) {
    // Four-second Weakness scales up to eight seconds with duration bonuses. The blind can be clipped by its cap.
    if (event.value < 3990 || event.value > 8010) continue;

    const paired = blinds.some(
      ({ event: blind }) =>
        blind.target === event.target && Math.abs(blind.time - event.time) < 10 && blind.value <= event.value * 1.5 + 10
    );

    if (
      !paired ||
      [...context.recordedActions, ...actions].some(
        (action) => action.rawSkillId === ID.BLINDING_FLASH && Math.abs(action.start - event.time) < 10
      )
    )
      continue;

    actions.push({
      start: event.time,
      end: event.time,
      expectedDurationMs: 0,
      rawSkillId: ID.BLINDING_FLASH,
      rawName: 'Blinding Flash',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      castOrigin: 'skill',
      metadataAccurate: false
    });
  }

  return actions;
}
