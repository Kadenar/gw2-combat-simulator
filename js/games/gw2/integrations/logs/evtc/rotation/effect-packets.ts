import type { Skill } from '#gw2/platform/engine/types.js';
import {
  firstStrikePacketOffsetMs,
  quicknessRuntimeDurationMs,
  strikePacketOffsets
} from '#gw2/integrations/logs/lib/rotation/timing.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import { observedCommittedInterruptMs } from '#gw2/platform/skills/timing.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export const EFFECT_PACKET_TOLERANCE_MS = 80;
const AGENT_SPAWN_STATE_CHANGE = 6;

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

export interface CommittedStrikeActionOptions {
  readonly maxFallbackImpactMs?: number;
  readonly matcher?: StrikePacketMatcherOptions;
}

export { normalized };

export function skillForAction(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): Skill | null {
  return recordedActionSkill(action, context);
}

export { firstStrikePacketOffsetMs, quicknessRuntimeDurationMs, strikePacketOffsets };

/** Reads the strike definition retained by a profession handler after it replaces the shared effect runner. */
function packetEffects(skill: Skill): NonNullable<Skill['effects']> {
  const effects = skill.effects || [];
  if (effects.length) return effects;
  return (skill as Skill & { readonly mesmerEffects?: Skill['effects'] }).mesmerEffects || [];
}

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
      ? packetEffects(skill).flatMap((effect) => {
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
    // Profession evidence can prove that a boundary (such as an Engineer kit transition) completed rather than interrupted the cast.
    if (action.forceCompleteReplay) continue;
    if (!validatePackets(action).observedPostInterruptWithoutCommit) continue;
    const skill = skillForAction(context, action);
    const name = skill?.name || action.canonicalName || action.rawName;
    missingBySkill.set(name, (missingBySkill.get(name) || 0) + 1);
  }

  return [...missingBySkill.entries()].map(
    ([name, count]) =>
      `EVTC observed ${count} interrupted ${name} cast${count === 1 ? '' : 's'} dealing damage at or after the interrupt marker, but the simulator catalog has no interruptCommitMs cutoff; reconstruction uses the simulator's default Quickness cast time.`
  );
}

export function committedActionsFromStrikePackets(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[],
  options: CommittedStrikeActionOptions = {}
): ReadonlySet<EvtcRecordedRotationAction> {
  const validatePackets = createStrikePacketMatcher(context, options.matcher);
  const committed = new Set<EvtcRecordedRotationAction>();
  for (const action of actions) {
    const packets = validatePackets(action);
    if (packets.expectedCount > 0 && packets.anyObserved) {
      committed.add(action);
    }
  }

  const maxFallbackImpactMs = Math.max(0, Number(options.maxFallbackImpactMs ?? 0));
  if (maxFallbackImpactMs === 0) return committed;
  for (const event of context.log.events) {
    if (
      event.source !== context.playerAddress ||
      event.buff !== 0 ||
      event.stateChange !== EVTC_STATE_CHANGE.NONE ||
      event.activation !== EVTC_ACTIVATION.NONE ||
      event.value <= 0
    ) {
      continue;
    }

    const candidate = actions
      .filter(
        (action) =>
          (event.skillId === action.rawSkillId || event.skillId === action.canonicalSkillId) &&
          action.start <= event.time &&
          event.time - action.start <= maxFallbackImpactMs
      )
      .sort((left, right) => right.start - left.start || right.eventIndex - left.eventIndex)[0];
    if (candidate) committed.add(candidate);
  }

  return committed;
}

export function reconcileCastEffectPackets(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const validatePackets = createStrikePacketMatcher(context);
  const skillNames = new Map(context.log.skills.map((skill) => [skill.id, normalized(skill.name)]));
  return actions.map((action) => {
    if (action.forceCompleteReplay) {
      return { ...action, status: 'completed' as const };
    }

    if (action.status !== 'completed' && action.status !== 'interrupted' && action.status !== 'reduced') {
      return action;
    }

    const wasInterrupted = action.status === 'interrupted' || action.status === 'reduced';

    const packets = validatePackets(action);
    const actualDuration = Math.max(0, action.end - action.start);
    const skill = skillForAction(context, action);
    const evtcQuicknessDuration =
      action.expectedDuration == null ? 0 : (Math.max(0, Number(action.expectedDuration)) * 2) / 3;
    const runtimeDuration = Math.max(0, quicknessRuntimeDurationMs(skill) || evtcQuicknessDuration);
    let phantasmCommitted = false;
    if (skill?.phantasm === true) {
      const phantasmIdentity = normalized(action.canonicalName || action.rawName).replace(/^phantasmal\s+/, '');
      const matchingPhantasmAddresses = new Set(
        context.log.agents
          .filter((agent) => normalized(agent.character).replace(/^illusionary\s+/, '') === phantasmIdentity)
          .map((agent) => agent.address)
      );
      const matchingPhantasmSpawn = context.log.events.some(
        (event) =>
          matchingPhantasmAddresses.has(event.source) &&
          event.stateChange === AGENT_SPAWN_STATE_CHANGE &&
          Math.abs(event.time - (action.start + runtimeDuration)) <= EFFECT_PACKET_TOLERANCE_MS
      );
      phantasmCommitted =
        matchingPhantasmSpawn &&
        (packets.anyObserved ||
          context.log.events.some(
            (event) =>
              event.source === context.playerAddress &&
              event.buff === 0 &&
              event.value > 0 &&
              event.activation === EVTC_ACTIVATION.NONE &&
              event.stateChange === EVTC_STATE_CHANGE.NONE &&
              (event.skillId === action.rawSkillId ||
                event.skillId === action.canonicalSkillId ||
                skillNames.get(event.skillId) === normalized(action.canonicalName || action.rawName)) &&
              Math.abs(event.time - (action.start + runtimeDuration)) <= EFFECT_PACKET_TOLERANCE_MS
          ));
    }

    if (!packets.anyObserved && !phantasmCommitted) return action;
    if (wasInterrupted && phantasmCommitted && runtimeDuration > 0) {
      return {
        ...action,
        status: 'completed' as const,
        replayCastEnd: action.start + runtimeDuration
      };
    }

    let replayDuration = Math.min(runtimeDuration || actualDuration, actualDuration);
    const replayCastEnd = action.replayCastEnd;
    const suppressFollowingWait = action.suppressFollowingWait;
    const observedCommittedInterrupt = observedCommittedInterruptMs(skill, actualDuration) != null;
    if (packets.allObserved) {
      if (
        runtimeDuration > 0 &&
        packets.allObservedTimingExplicit &&
        packets.lastObservedCancelableExpectedOffsetMs != null &&
        !observedCommittedInterrupt
      ) {
        // Every cancelable timed packet proves completion unless the observed duration is a valid committed interrupt.
        replayDuration = runtimeDuration;
      }
    }

    if (wasInterrupted && skill?.interruptMode === 'per-packet' && packets.lastObservedExpectedOffsetMs != null) {
      // A packet after an unreliable animation-stop marker proves the channel reached that packet boundary, while a
      // cancellation with no packets retains its exact observed duration.
      replayDuration = Math.max(replayDuration, packets.lastObservedExpectedOffsetMs);
    }

    if (wasInterrupted) {
      if (packets.allObserved && runtimeDuration > 0 && replayDuration + 10 >= runtimeDuration) {
        return {
          ...action,
          status: 'completed' as const,
          replayCastEnd: Math.max(action.end, action.start + replayDuration)
        };
      }

      return {
        ...action,
        status: 'reduced' as const,
        replayInterruptMs: replayDuration,
        ...(replayCastEnd == null ? {} : { replayCastEnd }),
        ...(suppressFollowingWait == null ? {} : { suppressFollowingWait })
      };
    }

    if (actualDuration === 0) return action;
    if (replayDuration > actualDuration) {
      return {
        ...action,
        status: 'completed' as const,
        replayCastEnd: action.start + replayDuration
      };
    }

    if (
      action.expectedDuration != null &&
      action.expectedDuration > 0 &&
      actualDuration + 10 >= action.expectedDuration
    ) {
      return action;
    }

    return runtimeDuration > 0 && replayDuration + 75 < runtimeDuration
      ? {
          ...action,
          status: 'reduced' as const,
          replayInterruptMs: replayDuration,
          ...(replayCastEnd == null ? {} : { replayCastEnd }),
          ...(suppressFollowingWait == null ? {} : { suppressFollowingWait })
        }
      : action;
  });
}
