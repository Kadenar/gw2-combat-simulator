import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { effectEvidence, isBuffApply } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/**
 * The supplied core-thief log pairs this target effect with Serpent's Touch and Deadly Ambush.
 * Require both condition bursts from the same player onto the same foe: the visual alone is not a proven Steal.
 * This is a local evidence rule, not an EI finder, and deliberately leaves uncorroborated steals missing.
 */
export function thiefStealActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'thief' || context.profile.specializationId !== 'core') return [];
  const applications = context.log.events.filter(
    (event) => event.source === context.playerAddress && event.value > 0 && isBuffApply(context.log, event)
  );
  const actions: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex, guid } of effectEvidence(context.log)) {
    if (
      guid !== 'A0F99AB672E77E459EBF8185867C4961' ||
      event.source !== context.playerAddress ||
      [60, 79].includes(event.stateChange) ||
      event.target === context.playerAddress ||
      !context.log.agents.some((agent) => agent.address === event.target) ||
      [...context.recordedActions, ...actions].some(
        (action) => action.rawSkillId === ID.STEAL && Math.abs(action.start - event.time) <= 50
      )
    )
      continue;
    const nearby = applications.filter(
      (application) => application.target === event.target && Math.abs(application.time - event.time) < 10
    );
    // Both traits apply ten-second base conditions; reject short weapon/venom packets and initial snapshots.
    const hasBurst = (skillId: number, stacks: number): boolean => {
      const durations = new Map<number, number>();
      for (const application of nearby) {
        if (application.skillId !== skillId || application.value < 10000 || application.value > 20000) continue;
        durations.set(application.value, (durations.get(application.value) ?? 0) + 1);
      }

      return [...durations.values()].some((count) => count >= stacks);
    };

    if (!hasBurst(723, 2) || !hasBurst(736, 3)) continue;
    actions.push({
      start: event.time,
      end: event.time,
      expectedDurationMs: 0,
      rawSkillId: ID.STEAL,
      rawName: 'Steal',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      metadataAccurate: false,
      castOrigin: 'skill'
    });
  }

  return actions;
}

/** Gaze applications identify otherwise unrecorded Marks; initial snapshots cannot establish a cast timestamp. */
export function deadeyeMarkActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'deadeye') return [];
  return context.log.events.flatMap((event, eventIndex) => {
    if (
      event.skillId !== 46333 ||
      event.target !== context.playerAddress ||
      !isBuffApply(context.log, event) ||
      context.recordedActions.some(
        (action) => action.rawSkillId === ID.DEADEYES_MARK && Math.abs(action.start - event.time) <= 50
      )
    )
      return [];
    return [
      {
        start: event.time,
        end: event.time,
        expectedDurationMs: 0,
        rawSkillId: ID.DEADEYES_MARK,
        rawName: "Deadeye's Mark",
        evidence: 'buff-transition',
        status: 'instant',
        eventIndex,
        metadataAccurate: false,
        castOrigin: 'skill'
      }
    ];
  });
}
