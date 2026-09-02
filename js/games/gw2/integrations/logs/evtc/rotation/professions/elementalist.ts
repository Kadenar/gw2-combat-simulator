import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtcEvent } from '#gw2/integrations/logs/evtc/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import {
  createStrikePacketMatcher,
  quicknessRuntimeDurationMs,
  skillForAction
} from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { reconstructEvokerActions } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist/evoker.js';
import { playerInstance } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

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
const FIRE_AURA_BUFF_ID = 5677;
const AURA_SIGNAL_WINDOW_MS = 150;
const FIRE_AURA_SOURCES = new Set(['Feel the Burn!', 'Signet of Fire', 'Conflagration', 'Overload Fire']);
const ELEMENTALIST_ATTUNEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth']);
const SPEAR_ETCHING_INITIAL_BUFFS = Object.freeze([
  { buffSkillId: 73133, skillId: ID.ETCHING_VOLCANO, name: 'Etching: Volcano' },
  { buffSkillId: 73144, skillId: ID.ETCHING_JO_KULHLAUP, name: 'Etching: Jökulhlaup' },
  { buffSkillId: 72895, skillId: ID.ETCHING_DERECHO, name: 'Etching: Derecho' },
  { buffSkillId: 72899, skillId: ID.ETCHING_HABOOB, name: 'Etching: Haboob' }
]);

function isAction(action: EvtcRecordedRotationAction, skillId: number): boolean {
  return action.rawSkillId === skillId || action.canonicalSkillId === skillId;
}

function actionName(action: EvtcRecordedRotationAction): string {
  return action.canonicalName || action.rawName;
}

function configuredStartingAttunement(context: EvtcProfessionReconstructionContext): string {
  const configured = String(context.professionConfig?.startAttunement || '')
    .trim()
    .toLowerCase();
  return ELEMENTALIST_ATTUNEMENTS.find((attunement) => attunement.toLowerCase() === configured) || 'Fire';
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

function ownedElementalCommandActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): readonly EvtcRecordedRotationAction[] {
  const ownerInstance = playerInstance(context);
  if (ownerInstance == null) return [];
  const firstPlayerEvent = firstPlayerEventTime(context);
  const recoveredOpeningStart =
    context.profile.specializationId === 'evoker'
      ? Math.min(...actions.filter((action) => action.precast === true).map((action) => action.start))
      : Number.POSITIVE_INFINITY;
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
      // Once another Evoker packet establishes a real precast lane, preserve the
      // command stop's start time; otherwise anchor clipped legacy input to its first packet.
      const preservePrecast =
        unmatchedStop &&
        firstPlayerEvent != null &&
        Number.isFinite(recoveredOpeningStart) &&
        inferredStart < firstPlayerEvent;
      const observedStart =
        unmatchedStop &&
        !preservePrecast &&
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

function recoverMissingFireShieldActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const skill = findRotationSkill(ID.FIRE_SHIELD, 'Fire Shield', context.catalog, context.profile);
  if (!skill) return [...actions];
  const hasFocus =
    String(context.professionConfig?.secondaryWeapon || '')
      .trim()
      .toLowerCase() === 'focus' || actions.some((action) => isAction(action, ID.TRANSMUTE_FIRE));
  if (!hasFocus) return [...actions];

  const recovered = context.log.events.flatMap<EvtcRecordedRotationAction>((event, eventIndex) => {
    if (
      event.source !== context.playerAddress ||
      event.target !== context.playerAddress ||
      event.skillId !== FIRE_AURA_BUFF_ID ||
      event.buff === 0 ||
      event.buffRemove !== 0 ||
      Math.max(event.value, event.buffDamage) <= 0 ||
      (event.stateChange !== EVTC_STATE_CHANGE.NONE && event.stateChange !== EVTC_STATE_CHANGE.BUFF_APPLY)
    ) {
      return [];
    }

    const auraEnd = event.time + Math.max(event.value, event.buffDamage);
    const transmuted = actions.some(
      (action) => isAction(action, ID.TRANSMUTE_FIRE) && action.start >= event.time && action.start <= auraEnd
    );
    const alreadyRecorded = actions.some(
      (action) => isAction(action, ID.FIRE_SHIELD) && Math.abs(action.start - event.time) <= AURA_SIGNAL_WINDOW_MS
    );
    const explainedBySource = actions.some((action) => {
      if (actionName(action) === 'Fire Attunement') {
        return Math.abs(action.start - event.time) <= AURA_SIGNAL_WINDOW_MS;
      }

      return (
        FIRE_AURA_SOURCES.has(actionName(action)) &&
        event.time >= action.start - AURA_SIGNAL_WINDOW_MS &&
        event.time <= action.end + AURA_SIGNAL_WINDOW_MS
      );
    });
    if (!transmuted || alreadyRecorded || explainedBySource) return [];

    // Transmute Fire proves the Focus chain was activated; the preceding unexplained
    // self-aura is the instant Fire Shield input omitted from ArcDPS animations.
    return [
      {
        start: event.time,
        end: event.time,
        expectedDuration: 0,
        rawSkillId: ID.FIRE_SHIELD,
        rawName: 'Fire Shield',
        canonicalSkillId: ID.FIRE_SHIELD,
        canonicalName: 'Fire Shield',
        evidence: 'buff-transition' as const,
        status: 'instant' as const,
        eventIndex
      }
    ];
  });

  return [...actions, ...recovered];
}

function openingSpearEtchingPrecasts(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const recovered = SPEAR_ETCHING_INITIAL_BUFFS.flatMap<EvtcRecordedRotationAction>(
    ({ buffSkillId, skillId, name }) => {
      const skill = findRotationSkill(skillId, name, context.catalog, context.profile);
      if (!skill) return [];
      const initial = context.log.events
        .map((event, eventIndex) => ({ event, eventIndex }))
        .find(
          ({ event }) =>
            event.target === context.playerAddress &&
            event.skillId === buffSkillId &&
            event.buff !== 0 &&
            event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL
        );
      if (!initial) return [];
      if (actions.some((action) => isAction(action, skillId) && action.start <= initial.event.time)) return [];

      const totalDuration = Math.max(initial.event.value, initial.event.buffDamage);
      const remainingDuration = Math.min(totalDuration, Math.max(0, initial.event.value));
      const fieldStartedAt = initial.event.time - Math.max(0, totalDuration - remainingDuration);
      const castDuration = quicknessRuntimeDurationMs(skill);
      // An active seven-second etching buff identifies a cast that began before logging;
      // age the buff back to field creation, then prepend the cast so its later full flip is available.
      return [
        {
          start: fieldStartedAt - castDuration,
          end: fieldStartedAt,
          expectedDuration: castDuration,
          rawSkillId: skillId,
          rawName: name,
          canonicalSkillId: skillId,
          canonicalName: name,
          evidence: 'initial-state' as const,
          status: 'completed' as const,
          eventIndex: context.log.events.length + initial.eventIndex,
          precast: true
        }
      ];
    }
  );
  if (!recovered.length) return [...actions];

  const combined = [...actions, ...recovered];
  const firstPrecastStart = Math.min(
    ...combined.filter((action) => action.precast === true).map((action) => action.start)
  );
  // Initial attunement snapshots occur at log creation, after clipped precasts. Move
  // the transition to the earliest recovered cast so replay enables that weapon skill first.
  return combined.map((action) =>
    action.initialState === true && action.start > firstPrecastStart
      ? { ...action, start: firstPrecastStart, end: firstPrecastStart }
      : action
  );
}

function orderSimultaneousAttunementTransitions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  return actions.map((action) => {
    if (action.evidence !== 'buff-transition') return action;
    const enteredElement = String(action.canonicalName || action.rawName).split(' ')[0];
    const precedingWeapon = actions.some((candidate) => {
      if (candidate === action || candidate.start !== action.start) return false;
      const skill = skillForAction(context, candidate);
      const attunements = String(skill?.attunement || '').split('+');
      return skill?.type === 'Weapon' && attunements.some(Boolean) && !attunements.includes(enteredElement);
    });
    if (!precedingWeapon) return action;
    // Same-millisecond animation and buff packets are unordered; a weapon from the
    // outgoing element must replay before the transition that would disable it.
    return { ...action, start: action.start + 1, end: action.end + 1 };
  });
}

export function reconstructElementalistProfessionActions(
  context: EvtcProfessionReconstructionContext
): readonly EvtcRecordedRotationAction[] {
  const startingAttunement = configuredStartingAttunement(context);
  let actions = context.recordedActions.filter(
    (action) =>
      !(
        action.initialState === true &&
        String(action.canonicalName || action.rawName) === `${startingAttunement} Attunement`
      )
  );
  actions = recoverMissingFireShieldActions(context, actions);
  actions = specializationAnalyzers.get(context.profile.specializationId)?.(context, actions) || actions;
  actions = openingTempestScepterPrecast(context, actions);
  actions = openingSpearEtchingPrecasts(context, actions);
  actions = inferArcLightningChannelDurations(context, actions);
  actions = filterUncommittedFlamestrikes(context, actions);
  actions = [...actions, ...collapsedHurlActions(context, actions), ...ownedElementalCommandActions(context, actions)];
  return orderSimultaneousAttunementTransitions(context, actions).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
}
