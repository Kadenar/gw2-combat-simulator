import { ACTOR } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { referenceCastTimeMs, strikePacketOffsets } from '#gw2/integrations/logs/shared/rotation/timing.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import {
  normalizedName as normalized,
  recordedActionSkill,
  createRotationSkillResolver
} from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

const EFFECT_PACKET_TOLERANCE_MS = 80;

export interface StrikePacketValidation {
  readonly allObserved: boolean;
  readonly allObservedTimingExplicit: boolean;
  readonly observedCommittedDelayedPacket: boolean;
}

interface ExpectedStrikePacket {
  readonly signalName: string;
  readonly offsetMs: number;
  readonly timingExplicit: boolean;
  readonly persistsAfterInterrupt: boolean;
  readonly interruptMode: Skill['interruptMode'];
  readonly interruptCommitMs: number | null;
}

function skillForAction(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): Skill | null {
  return recordedActionSkill(action, context);
}

export { referenceCastTimeMs };

/** Match observed strikes against catalog timing using the shared EVTC tolerance. */
export function createStrikePacketMatcher(
  context: EvtcProfessionReconstructionContext
): (action: EvtcRecordedRotationAction) => StrikePacketValidation {
  // Packet validation reads the cast's selected cutoff, including its active equipped weapon set.
  const resolveSkill = createRotationSkillResolver(context);
  const names = new Map(context.log.skills.map((skill) => [skill.id, skill.name.trim()]));
  const availableNames = new Set([...names.values()].map((name) => normalized(name)));
  const directEvents = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter(
      ({ event }) =>
        event.source === context.playerAddress &&
        event.buff === 0 &&
        event.value > 0 &&
        event.activation === EVTC_ACTIVATION.NONE &&
        event.stateChange === EVTC_STATE_CHANGE.NONE
    );
  const cache = new WeakMap<EvtcRecordedRotationAction, StrikePacketValidation>();

  return (action) => {
    const cached = cache.get(action);

    if (cached) return cached;

    const skill = resolveSkill(action);
    const authoredSkill = skillForAction(context, action);
    const runtimeDurationMs = skill ? referenceCastTimeMs(skill) : 0;
    const packets: ExpectedStrikePacket[] = skill
      ? (skill.effects || []).flatMap((effect) => {
          if (effect.type !== 'strike' || effect.actorType === ACTOR.SUMMON) {
            return [];
          }

          const effectName = normalized(effect.name || skill.name);
          const skillName = normalized(skill.name);
          const rawName = normalized(action.rawName);
          const signalName = availableNames.has(effectName)
            ? effectName
            : availableNames.has(skillName)
              ? skillName
              : rawName;
          const timingExplicit =
            effect.atMs != null ||
            (Array.isArray(effect.ticks) && effect.ticks.length > 0) ||
            effect.timingAnchor != null ||
            effect.timingScale != null;
          // Resolve replay occupancy without replacing the authored reference used to scale the skill's effects.
          return strikePacketOffsets(authoredSkill ?? skill, effect, runtimeDurationMs).map((offsetMs) => ({
            signalName,
            offsetMs,
            timingExplicit,
            persistsAfterInterrupt: effect.persistsAfterInterrupt === true,
            interruptMode: skill.interruptMode,
            interruptCommitMs: effect.interruptCommitMs ?? skill.interruptCommitMs ?? null
          }));
        })
      : [];
    const used = new Set<number>();
    // Used events count matched packets; explicit timing is checked only for those matches.
    let matchedTimingsExplicit = true;
    let observedCommittedDelayedPacket = false;
    for (const packet of packets) {
      const expectedTime = action.start + packet.offsetMs;
      const match = directEvents
        .filter(
          ({ event, eventIndex }) =>
            !used.has(eventIndex) &&
            normalized(names.get(event.skillId)) === packet.signalName &&
            (packet.timingExplicit
              ? Math.abs(event.time - expectedTime) <= EFFECT_PACKET_TOLERANCE_MS
              : event.time >= action.start && event.time <= expectedTime + EFFECT_PACKET_TOLERANCE_MS)
        )
        .sort(
          (left, right) =>
            Math.abs(left.event.time - expectedTime) - Math.abs(right.event.time - expectedTime) ||
            left.eventIndex - right.eventIndex
        )[0];

      if (!match) continue;

      used.add(match.eventIndex);
      const observedOffset = match.event.time - action.start;
      matchedTimingsExplicit &&= packet.timingExplicit;
      const observedAfterInterrupt =
        (action.status === 'interrupted' || action.status === 'reduced') &&
        observedOffset >= Math.max(0, action.end - action.start) &&
        packet.interruptMode !== 'per-packet';

      // Retain positive packet evidence for reconstruction without producing metadata diagnostics for import users.
      if (observedAfterInterrupt && packet.persistsAfterInterrupt && packet.interruptCommitMs != null)
        observedCommittedDelayedPacket = true;
    }

    const validation = {
      allObserved: packets.length > 0 && used.size === packets.length,
      allObservedTimingExplicit: used.size > 0 && matchedTimingsExplicit,
      observedCommittedDelayedPacket
    };
    cache.set(action, validation);
    return validation;
  };
}
