import type { Skill } from '#gw2/platform/engine/skills/types.js';
import {
  firstStrikePacketOffsetMs,
  quicknessRuntimeDurationMs,
  strikePacketOffsets
} from '#gw2/integrations/logs/lib/rotation/timing.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export const EFFECT_PACKET_TOLERANCE_MS = 80;

export interface StrikePacketValidation {
  readonly expectedCount: number;
  readonly observedCount: number;
  readonly allObserved: boolean;
  readonly anyObserved: boolean;
  readonly allObservedTimingExplicit: boolean;
  readonly firstMissingOffsetMs: number | null;
  readonly lastObservedOffsetMs: number | null;
  readonly lastObservedExpectedOffsetMs: number | null;
  readonly lastObservedCancelableExpectedOffsetMs: number | null;
  readonly observedPostInterruptWithoutCommit: boolean;
}

interface ExpectedStrikePacket {
  readonly signalName: string;
  readonly offsetMs: number;
  readonly timingExplicit: boolean;
  readonly persistsAfterInterrupt: boolean;
  readonly interruptMode: Skill['interruptMode'];
  readonly interruptCommitMs: number | null;
}

export interface StrikePacketMatcherOptions {
  readonly toleranceMs?: number;
  readonly runtimeDurationMs?: (skill: Skill, action: EvtcRecordedRotationAction) => number;
}

export { normalized };

export function skillForAction(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): Skill | null {
  return recordedActionSkill(action, context);
}

export { firstStrikePacketOffsetMs, quicknessRuntimeDurationMs, strikePacketOffsets };

export function createStrikePacketMatcher(
  context: EvtcProfessionReconstructionContext,
  options: StrikePacketMatcherOptions = {}
): (action: EvtcRecordedRotationAction) => StrikePacketValidation {
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
    const skill = skillForAction(context, action);
    const runtimeDurationMs = skill
      ? (options.runtimeDurationMs?.(skill, action) ?? quicknessRuntimeDurationMs(skill))
      : 0;
    const packets: ExpectedStrikePacket[] = skill
      ? (skill.effects || []).flatMap((effect) => {
          if (effect.type !== 'strike' || effect.actorType === 'summon') {
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
          return strikePacketOffsets(skill, effect, runtimeDurationMs).map((offsetMs) => ({
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
    const observedOffsets: number[] = [];
    const observedExpectedOffsets: number[] = [];
    const observedCancelableExpectedOffsets: number[] = [];
    const observedExplicitTimings: boolean[] = [];
    const missingOffsets: number[] = [];
    let observedPostInterruptWithoutCommit = false;
    for (const packet of packets) {
      const expectedTime = action.start + packet.offsetMs;
      const match = directEvents
        .filter(
          ({ event, eventIndex }) =>
            !used.has(eventIndex) &&
            normalized(names.get(event.skillId)) === packet.signalName &&
            (packet.timingExplicit
              ? Math.abs(event.time - expectedTime) <= (options.toleranceMs ?? EFFECT_PACKET_TOLERANCE_MS)
              : event.time >= action.start &&
                event.time <= expectedTime + (options.toleranceMs ?? EFFECT_PACKET_TOLERANCE_MS))
        )
        .sort(
          (left, right) =>
            Math.abs(left.event.time - expectedTime) - Math.abs(right.event.time - expectedTime) ||
            left.eventIndex - right.eventIndex
        )[0];
      if (!match) {
        missingOffsets.push(packet.offsetMs);
        continue;
      }

      used.add(match.eventIndex);
      const observedOffset = match.event.time - action.start;
      observedOffsets.push(observedOffset);
      observedExpectedOffsets.push(packet.offsetMs);
      observedExplicitTimings.push(packet.timingExplicit);
      if (
        (action.status === 'interrupted' || action.status === 'reduced') &&
        observedOffset >= Math.max(0, action.end - action.start) &&
        packet.interruptMode !== 'per-packet' &&
        packet.interruptCommitMs == null
      ) {
        observedPostInterruptWithoutCommit = true;
      }

      if (!packet.persistsAfterInterrupt) {
        observedCancelableExpectedOffsets.push(packet.offsetMs);
      }
    }

    const validation = {
      expectedCount: packets.length,
      observedCount: observedOffsets.length,
      allObserved: packets.length > 0 && observedOffsets.length === packets.length,
      anyObserved: observedOffsets.length > 0,
      allObservedTimingExplicit: observedExplicitTimings.length > 0 && observedExplicitTimings.every(Boolean),
      firstMissingOffsetMs: missingOffsets.length ? Math.min(...missingOffsets) : null,
      lastObservedOffsetMs: observedOffsets.length ? Math.max(...observedOffsets) : null,
      lastObservedExpectedOffsetMs: observedExpectedOffsets.length ? Math.max(...observedExpectedOffsets) : null,
      lastObservedCancelableExpectedOffsetMs: observedCancelableExpectedOffsets.length
        ? Math.max(...observedCancelableExpectedOffsets)
        : null,
      observedPostInterruptWithoutCommit
    };
    cache.set(action, validation);
    return validation;
  };
}

/** Warns when an EVTC proves post-interrupt damage that static simulator metadata cannot retain. */
export function missingInterruptCommitWarnings(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): string[] {
  const validatePackets = createStrikePacketMatcher(context);
  const missingBySkill = new Map<string, number>();
  for (const action of actions) {
    if (!validatePackets(action).observedPostInterruptWithoutCommit) continue;
    const skill = skillForAction(context, action);
    const name = skill?.name || action.canonicalName || action.rawName;
    missingBySkill.set(name, (missingBySkill.get(name) || 0) + 1);
  }

  return [...missingBySkill.entries()].map(
    ([name, count]) =>
      `EVTC observed ${count} interrupted ${name} cast${count === 1 ? '' : 's'} dealing damage at or after the interrupt marker, but the simulator catalog has no interruptCommitMs cutoff; reconstruction preserves the cancellation and omits that damage.`
  );
}
