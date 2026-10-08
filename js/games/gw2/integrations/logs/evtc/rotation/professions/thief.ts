import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { effectEvidence, isBuffApply } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { GW2_ACTION_TICK_MS, quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

/** Keep sub-480 ms Shadow Bolt attempts below that boundary; timeline alignment restores the saved time as idle. */
export function thiefShadowBoltInterruptMs(action: EvtcRecordedRotationAction): number | null {
  const observedMs = action.end - action.start;
  if (action.rawSkillId !== ID.SHADOW_BOLT || observedMs >= 480) return null;
  return Math.min(quantizeGw2ActionTimingMs(action.replayInterruptMs ?? observedMs), 480 - GW2_ACTION_TICK_MS);
}

/** Supplement EI with owned needle visuals and damage when its circle is missing or its visual window is exceeded. */
export function thiefThousandNeedlesActions(
  context: EvtcProfessionReconstructionContext
): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'thief') return [];
  const effects = effectEvidence(context.log).filter(({ event }) => event.source === context.playerAddress);
  const damage = context.log.events.filter(
    (event) =>
      event.skillId === 56897 &&
      event.source === context.playerAddress &&
      event.stateChange === 0 &&
      event.activation === 0 &&
      event.buff === 0 &&
      event.value > 0
  );
  const actions: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex, guid } of effects) {
    if (guid !== '2125A13079C1C5479C150926EB60A15D') continue;
    // The generic circle is ambiguous: require both needle visuals and a matching hit from this player.
    const corroborated = ['9AF103E33FC235498190448A9496C98A', 'B8DC8C6736C8E0439295A9DBBADC6296'].every((secondary) =>
      effects.some(
        (other) =>
          other.guid === secondary &&
          Math.abs(other.event.time - event.time - 280) <= GW2_ACTION_TICK_MS &&
          damage.some((hit) => Math.abs(hit.time - other.event.time) <= GW2_ACTION_TICK_MS)
      )
    );
    if (
      !corroborated ||
      [...context.recordedActions, ...actions].some(
        (action) =>
          (action.rawSkillId === 56897 || action.rawSkillId === ID.THOUSAND_NEEDLES) &&
          Math.abs(action.start - event.time) < 50
      )
    )
      continue;
    actions.push({
      start: event.time,
      end: event.time,
      expectedDurationMs: 0,
      rawSkillId: 56897,
      rawName: 'Thousand Needles',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      metadataAccurate: false,
      castOrigin: 'skill'
    });
  }

  // An omitted activation circle does not erase an impact proven by both needle-specific visuals and owned damage.
  // Infer the activation from EI's 280 ms impact delay, while preserving any earlier standard or circle-based action.
  for (const { event, eventIndex, guid } of effects) {
    if (guid !== '9AF103E33FC235498190448A9496C98A') continue;
    const start = event.time - 280;
    if (
      !effects.some(
        (other) => other.guid === 'B8DC8C6736C8E0439295A9DBBADC6296' && Math.abs(other.event.time - event.time) < 10
      ) ||
      !damage.some((hit) => Math.abs(hit.time - event.time) < 10) ||
      [...context.recordedActions, ...actions].some(
        (action) =>
          (action.rawSkillId === 56897 || action.rawSkillId === ID.THOUSAND_NEEDLES) &&
          Math.abs(action.start - start) < 50
      )
    )
      continue;
    actions.push({
      start,
      end: start,
      expectedDurationMs: 0,
      rawSkillId: 56897,
      rawName: 'Thousand Needles',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      metadataAccurate: false,
      castOrigin: 'skill'
    });
  }

  return actions;
}

/** The shield's owned placement effect and fresh self refund buff corroborate an instant cast even without all EI visuals. */
export function antiquaryChakShieldActions(context: EvtcProfessionReconstructionContext): EvtcRecordedRotationAction[] {
  if (context.profile.professionId !== 'thief' || context.profile.specializationId !== 'antiquary') return [];
  const actions: EvtcRecordedRotationAction[] = [];
  for (const { event, eventIndex, guid } of effectEvidence(context.log)) {
    if (
      guid !== '1B48B91A5B0EC540BEA2765583412CBC' ||
      event.source !== context.playerAddress ||
      !context.log.events.some(
        (buff) =>
          buff.skillId === 78288 &&
          buff.source === context.playerAddress &&
          buff.target === context.playerAddress &&
          buff.value > 0 &&
          isBuffApply(context.log, buff) &&
          Math.abs(buff.time - event.time) < 10
      ) ||
      [...context.recordedActions, ...actions].some(
        (action) => action.rawSkillId === ID.CHAK_SHIELD && Math.abs(action.start - event.time) < 50
      )
    )
      continue;
    actions.push({
      start: event.time,
      end: event.time,
      expectedDurationMs: 0,
      rawSkillId: ID.CHAK_SHIELD,
      rawName: 'Chak Shield',
      evidence: 'effect',
      status: 'instant',
      eventIndex,
      metadataAccurate: false,
      castOrigin: 'skill'
    });
  }

  return actions;
}

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
