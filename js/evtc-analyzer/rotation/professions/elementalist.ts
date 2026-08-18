import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '../../types.js';
import { findRotationSkill } from '../catalog.js';
import { createStrikePacketMatcher, quicknessRuntimeDurationMs, skillForAction } from '../effect-packets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../professions/elementalist/data/ids.js';
import { reconstructEvokerActions } from './elementalist/evoker.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from './types.js';

const ELEMENTAL_COMMANDS = Object.freeze([
  {
    speciesId: 6524,
    character: 'Fire Elemental',
    action: { name: 'Flame Barrage', skillId: 2662 }
  },
  {
    speciesId: 6523,
    character: 'Earth Elemental',
    action: { name: 'Stomp', skillId: 2666 }
  }
]);

type ElementalistActionTransform = (
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
) => EvtcRecordedRotationAction[];

const specializationAnalyzers: ReadonlyMap<string, ElementalistActionTransform> = new Map([
  ['evoker', reconstructEvokerActions]
]);
const TEMPEST_OVERLOAD_DWELL_MS = 5000;
const HURL_PACKET_GROUP_MS = 1000;

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

function firstPlayerEventTime(context: EvtcProfessionReconstructionContext): number | null {
  const first = Math.min(
    ...context.log.events
      .filter(
        (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
      )
      .map((event) => event.time)
  );
  return Number.isFinite(first) ? first : null;
}

function isAnimationStart(event: ParsedEvtcEvent): boolean {
  return (
    event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
    (event.stateChange === EVTC_STATE_CHANGE.NONE &&
      (event.activation === EVTC_ACTIVATION.START || event.activation === EVTC_ACTIVATION.QUICKNESS))
  );
}

function isCompletedAnimationStop(event: ParsedEvtcEvent): boolean {
  return (
    event.value > 0 &&
    (event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP || event.stateChange === EVTC_STATE_CHANGE.NONE) &&
    (event.activation === EVTC_ACTIVATION.CANCEL_FIRE || event.activation === EVTC_ACTIVATION.RESET)
  );
}

function playerInstance(context: EvtcProfessionReconstructionContext): number | null {
  return (
    context.log.events.find((event) => event.source === context.playerAddress && event.sourceInstance > 0)
      ?.sourceInstance ?? null
  );
}

function ownedElementalCommandActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const firstPlayerEvent = firstPlayerEventTime(context);
  return ELEMENTAL_COMMANDS.flatMap(({ speciesId, character, action }) => {
    const actors = new Set(
      context.log.agents
        .filter((agent) => agent.profession === speciesId || agent.character === character)
        .map((agent) => agent.address)
    );
    const starts = context.log.events.filter(
      (event) =>
        actors.has(event.source) &&
        event.sourceMasterInstance === ownerInstance &&
        event.skillId === action.skillId &&
        isAnimationStart(event)
    );

    return context.log.events.flatMap((event, eventIndex) => {
      if (
        !actors.has(event.source) ||
        event.sourceMasterInstance !== ownerInstance ||
        event.skillId !== action.skillId
      ) {
        return [];
      }
      const directStart = isAnimationStart(event);
      const unmatchedStop =
        isCompletedAnimationStop(event) &&
        !starts.some(
          (start) =>
            start.source === event.source &&
            start.time < event.time &&
            Math.abs(event.time - start.time - event.value) <= 150
        );
      if (!directStart && !unmatchedStop) return [];
      const inferredStart = directStart ? event.time : event.time - event.value;
      // A clipped legacy command can retain effect packets but lose its activation start;
      // anchor the player input to the first observed command packet instead of pre-log time.
      const observedStart =
        unmatchedStop &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        firstPlayerEvent != null &&
        inferredStart < firstPlayerEvent
          ? context.log.events
              .map((candidate, candidateIndex) => ({ event: candidate, eventIndex: candidateIndex }))
              .find(
                ({ event: candidate }) =>
                  candidate.source === event.source &&
                  candidate.sourceMasterInstance === ownerInstance &&
                  candidate.skillId === action.skillId &&
                  candidate.time >= firstPlayerEvent &&
                  candidate.time < event.time &&
                  candidate.activation === EVTC_ACTIVATION.NONE
              )
          : null;
      const start = observedStart?.event.time ?? inferredStart;
      const modernEvidence =
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_START ||
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP;
      return [
        {
          start,
          end: start,
          expectedDuration: 0,
          rawSkillId: event.skillId,
          rawName: action.name,
          canonicalSkillId: action.skillId,
          canonicalName: action.name,
          evidence: observedStart
            ? ('initial-state' as const)
            : modernEvidence
              ? ('animation' as const)
              : ('legacy-activation' as const),
          status: 'instant' as const,
          eventIndex: observedStart?.eventIndex ?? eventIndex,
          ...(unmatchedStop && firstPlayerEvent != null && inferredStart < firstPlayerEvent ? { precast: true } : {})
        }
      ];
    });
  });
}

function openingTempestScepterPrecast(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (context.profile.specializationId !== 'tempest') return [...actions];
  const hasHurlEvidence = context.log.events.some(
    (event) => event.time > 0 && event.source === context.playerAddress && event.skillId === ID.HURL
  );
  if (!hasHurlEvidence || actions.some((action) => isAction(action, ID.ROCK_BARRIER))) return [...actions];

  const firstPlayerEvent = firstPlayerEventTime(context);
  if (firstPlayerEvent == null) return [...actions];
  const clippedOverload = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === ID.OVERLOAD_AIR &&
        isCompletedAnimationStop(event) &&
        event.time - event.value < firstPlayerEvent
    );
  if (!clippedOverload) return [...actions];

  const overloadStart = clippedOverload.event.time - clippedOverload.event.value;
  const airAttunementAt = overloadStart - TEMPEST_OVERLOAD_DWELL_MS;
  const overloadCombatStart = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === ID.OVERLOAD_AIR &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.buff === 0 &&
      event.value > 0 &&
      event.target !== 0n &&
      event.time >= overloadStart &&
      event.time <= clippedOverload.event.time + 80
  )?.time;
  const rockBarrier = findRotationSkill(ID.ROCK_BARRIER, 'Rock Barrier', context.catalog, context.profile);
  const rockBarrierDuration = Math.max(0, Number(rockBarrier?.quicknessCastTimeMs || rockBarrier?.castTimeMs || 0));
  let hasOpeningAirAttunement = false;
  let hasOpeningOverload = false;
  const adjusted = actions.map((action) => {
    if (!hasOpeningAirAttunement && action.initialState === true && isAction(action, ID.AIR_ATTUNEMENT)) {
      hasOpeningAirAttunement = true;
      return { ...action, start: airAttunementAt, end: airAttunementAt, precast: true };
    }
    if (isAction(action, ID.OVERLOAD_AIR) && Math.abs(action.end - clippedOverload.event.time) <= 150) {
      hasOpeningOverload = true;
      return overloadCombatStart == null ? action : { ...action, inferredCombatStart: overloadCombatStart };
    }
    return action;
  });

  // Hurl proves Rock Barrier's flip state existed before logging began. Recreate the
  // Earth opener and Tempest's five-second Air dwell so the imported rotation is executable.
  adjusted.push({
    start: airAttunementAt - rockBarrierDuration,
    end: airAttunementAt,
    expectedDuration: rockBarrierDuration,
    rawSkillId: ID.ROCK_BARRIER,
    rawName: 'Rock Barrier',
    canonicalSkillId: ID.ROCK_BARRIER,
    canonicalName: 'Rock Barrier',
    evidence: 'initial-state',
    status: 'completed',
    eventIndex: -2001,
    precast: true
  });
  if (!hasOpeningAirAttunement) {
    adjusted.push({
      start: airAttunementAt,
      end: airAttunementAt,
      expectedDuration: 0,
      rawSkillId: ID.AIR_ATTUNEMENT,
      rawName: 'Air Attunement',
      canonicalSkillId: ID.AIR_ATTUNEMENT,
      canonicalName: 'Air Attunement',
      evidence: 'initial-state',
      status: 'instant',
      eventIndex: -2000,
      precast: true
    });
  }
  if (!hasOpeningOverload) {
    adjusted.push({
      start: overloadStart,
      end: clippedOverload.event.time,
      expectedDuration: Math.max(clippedOverload.event.value, clippedOverload.event.buffDamage),
      rawSkillId: ID.OVERLOAD_AIR,
      rawName: 'Overload Air',
      canonicalSkillId: ID.OVERLOAD_AIR,
      canonicalName: 'Overload Air',
      evidence: 'legacy-activation',
      status: 'completed',
      eventIndex: clippedOverload.eventIndex,
      precast: true,
      ...(overloadCombatStart == null ? {} : { inferredCombatStart: overloadCombatStart })
    });
  }
  return adjusted;
}

function collapsedHurlActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  if (actions.some((action) => isAction(action, ID.HURL))) return [];
  const packets = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.skillId === ID.HURL &&
        event.stateChange === EVTC_STATE_CHANGE.NONE &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.buff === 0 &&
        event.value > 0
    )
    .sort((left, right) => left.event.time - right.event.time || left.eventIndex - right.eventIndex);
  const actionsFromPackets: EvtcRecordedRotationAction[] = [];
  let groupStart: number | null = null;
  for (const packet of packets) {
    if (groupStart != null && packet.event.time - groupStart <= HURL_PACKET_GROUP_MS) continue;
    groupStart = packet.event.time;
    // One Hurl input produces a short burst of projectile packets; keep only the first packet as timing evidence.
    actionsFromPackets.push({
      start: packet.event.time,
      end: packet.event.time,
      expectedDuration: 0,
      rawSkillId: ID.HURL,
      rawName: 'Hurl',
      canonicalSkillId: ID.HURL,
      canonicalName: 'Hurl',
      evidence: 'effect',
      status: 'instant',
      eventIndex: packet.eventIndex
    });
  }
  return actionsFromPackets;
}

function inferArcLightningChannelDurations(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const validatePackets = createStrikePacketMatcher(context);
  const arcTargets = new Set(
    context.log.events
      .filter(
        (event) =>
          event.source === context.playerAddress &&
          event.skillId === ID.ARC_LIGHTNING &&
          event.activation === EVTC_ACTIVATION.NONE &&
          event.stateChange === EVTC_STATE_CHANGE.NONE &&
          event.buff === 0 &&
          event.value > 0 &&
          event.target !== 0n
      )
      .map((event) => event.target)
  );
  const targetEndTimes = context.log.events
    .filter(
      (event) =>
        arcTargets.has(event.source) &&
        (event.stateChange === EVTC_STATE_CHANGE.EXIT_COMBAT || event.stateChange === EVTC_STATE_CHANGE.CHANGE_DEAD)
    )
    .map((event) => event.time)
    .sort((left, right) => left - right);
  return actions.map((action) => {
    if (!isAction(action, ID.ARC_LIGHTNING)) return action;
    const packets = validatePackets(action);
    const actualDuration = Math.max(0, action.end - action.start);
    const runtimeDuration = quicknessRuntimeDurationMs(skillForAction(context, action));
    if (action.status === 'unknown' && !packets.anyObserved) {
      const targetEnd = targetEndTimes.find((time) => time >= action.start);
      const targetEndDuration = targetEnd == null ? null : targetEnd - action.start;
      if (targetEndDuration != null && targetEndDuration >= 0 && targetEndDuration + 10 < runtimeDuration) {
        // A log-edge channel has no stop packet after the target dies; use that target-state
        // packet as the channel boundary so replay cannot invent post-fight Arc Lightning ticks.
        return {
          ...action,
          end: action.start + targetEndDuration,
          status: 'reduced',
          replayInterruptMs: targetEndDuration
        };
      }
    }
    if (action.status !== 'completed') return action;
    const packetBoundaryProvesInterruption =
      packets.anyObserved &&
      !packets.allObserved &&
      packets.lastObservedOffsetMs != null &&
      packets.firstMissingOffsetMs != null &&
      packets.firstMissingOffsetMs > packets.lastObservedOffsetMs &&
      actualDuration + 80 >= packets.lastObservedOffsetMs &&
      actualDuration < packets.firstMissingOffsetMs &&
      actualDuration + 10 < runtimeDuration;
    if (!packetBoundaryProvesInterruption) return action;
    // ArcDPS reports a fired channel as completed even when it ends between damage packets;
    // replay only through the observed packet boundary so omitted ticks are not regenerated.
    return {
      ...action,
      status: 'reduced',
      replayInterruptMs: actualDuration
    };
  });
}

function filterUncommittedFlamestrikes(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const validatePackets = createStrikePacketMatcher(context);
  return actions.filter((action) => {
    if (!isAction(action, ID.FLAMESTRIKE)) return true;
    const packets = validatePackets(action);
    // Autoattack activation packets are emitted even when Flamestrike is cancelled before impact;
    // retain the input only when the catalog can verify at least one resulting damage packet.
    return packets.expectedCount === 0 || packets.anyObserved;
  });
}

export function reconstructElementalistProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  let actions = context.recordedActions.filter(
    (action) =>
      !(
        action.initialState === true &&
        (action.rawSkillId === ID.FIRE_ATTUNEMENT || action.canonicalSkillId === ID.FIRE_ATTUNEMENT)
      )
  );
  actions = specializationAnalyzers.get(context.profile.specializationId)?.(context, actions) || actions;
  actions = openingTempestScepterPrecast(context, actions);
  actions = inferArcLightningChannelDurations(context, actions);
  actions = filterUncommittedFlamestrikes(context, actions);
  return [...actions, ...collapsedHurlActions(context, actions), ...ownedElementalCommandActions(context)].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
