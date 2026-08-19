import type { Skill, StrikeEffect } from '../../platform/engine/types.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../types.js';
import { findRotationSkill } from './catalog.js';
import type { EvtcProfessionReconstructionContext, EvtcRecordedRotationAction } from './professions/types.js';

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
}

interface ExpectedStrikePacket {
  readonly signalName: string;
  readonly offsetMs: number;
  readonly timingExplicit: boolean;
  readonly persistsAfterInterrupt: boolean;
}

export interface StrikePacketMatcherOptions {
  readonly toleranceMs?: number;
  readonly runtimeDurationMs?: (skill: Skill, action: EvtcRecordedRotationAction) => number;
}

export interface CommittedStrikeActionOptions {
  readonly maxFallbackImpactMs?: number;
  readonly matcher?: StrikePacketMatcherOptions;
}

export function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function skillForAction(
  context: EvtcProfessionReconstructionContext,
  action: EvtcRecordedRotationAction
): Skill | null {
  return findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
}

export function quicknessRuntimeDurationMs(skill: Skill | null): number {
  const explicit = Math.max(0, Number(skill?.quicknessCastTimeMs || 0));
  if (explicit > 0) return explicit;
  const base = Math.max(0, Number(skill?.castTimeMs || 0));
  return skill?.unaffectedByQuickness === true ? base : (base * 2) / 3;
}

export function strikePacketOffsets(
  skill: Skill,
  effect: StrikeEffect,
  runtimeDurationMs = quicknessRuntimeDurationMs(skill)
): number[] {
  const origin = effect.timingAnchor === 'castEnd' ? runtimeDurationMs : 0;
  const baseDurationMs = Math.max(0, Number(skill.castTimeMs || 0));
  const castScale = effect.timingScale === 'cast' && baseDurationMs > 0 ? runtimeDurationMs / baseDurationMs : 1;
  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return effect.ticks.map((tick) => origin + Number(tick.atMs) * castScale);
  }

  const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
  const first = origin + (effect.atMs == null ? runtimeDurationMs - origin : Number(effect.atMs) * castScale);
  const intervalScale = effect.intervalTimingScale === 'fixed' ? 1 : castScale;
  const interval = Math.max(0, Number(effect.intervalMs || 0)) * intervalScale;
  return Array.from({ length: hits }, (_, index) => first + index * interval);
}

export function firstStrikePacketOffsetMs(
  skill: Skill | null,
  runtimeDurationMs = quicknessRuntimeDurationMs(skill),
  options: { readonly explicitOnly?: boolean } = {}
): number | null {
  const offsets = (skill?.effects || []).flatMap((effect) => {
    if (effect.type !== 'strike') return [];
    if (options.explicitOnly === true && effect.atMs == null && !(Array.isArray(effect.ticks) && effect.ticks.length)) {
      return [];
    }

    return strikePacketOffsets(skill!, effect, runtimeDurationMs);
  });
  return offsets.length ? Math.min(...offsets) : null;
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
            persistsAfterInterrupt: effect.persistsAfterInterrupt === true
          }));
        })
      : [];
    const used = new Set<number>();
    const observedOffsets: number[] = [];
    const observedExpectedOffsets: number[] = [];
    const observedCancelableExpectedOffsets: number[] = [];
    const observedExplicitTimings: boolean[] = [];
    const missingOffsets: number[] = [];
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
      observedOffsets.push(match.event.time - action.start);
      observedExpectedOffsets.push(packet.offsetMs);
      observedExplicitTimings.push(packet.timingExplicit);
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
        : null
    };
    cache.set(action, validation);
    return validation;
  };
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
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  return actions.map((action) => {
    if (action.forceCompleteReplay) {
      return { ...action, status: 'completed' as const };
    }

    if (action.status !== 'completed' && action.status !== 'interrupted') {
      return action;
    }

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
    if (action.status === 'interrupted' && phantasmCommitted && runtimeDuration > 0) {
      return {
        ...action,
        status: 'completed' as const,
        replayCastEnd: action.start + runtimeDuration
      };
    }

    let replayDuration = Math.min(runtimeDuration || actualDuration, actualDuration);
    let preserveEffectsAfterInterrupt = false;
    let replayCastEnd = action.replayCastEnd;
    let suppressFollowingWait = action.suppressFollowingWait;
    const lastCancelableEffectOffset = packets.lastObservedCancelableExpectedOffsetMs || 0;
    if (packets.allObserved && lastCancelableEffectOffset > actualDuration) {
      const nextSerialAction = sorted.find((candidate) => {
        if (candidate.start <= action.start) return false;
        const candidateSkill = skillForAction(context, candidate);
        return candidateSkill?.independentCast !== true && candidateSkill?.canCastConcurrently !== true;
      });
      const nextSerialOffset =
        nextSerialAction == null ? Number.POSITIVE_INFINITY : nextSerialAction.start - action.start;
      if (
        runtimeDuration > 0 &&
        packets.allObservedTimingExplicit &&
        lastCancelableEffectOffset + 10 >= runtimeDuration &&
        nextSerialOffset + 75 >= runtimeDuration
      ) {
        replayDuration = runtimeDuration;
      } else {
        preserveEffectsAfterInterrupt = true;
        if (runtimeDuration > 0 && nextSerialOffset <= runtimeDuration + 75) {
          suppressFollowingWait = false;
        }
      }
    }

    if (action.status === 'interrupted') {
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
        replayPreserveEffectsAfterInterrupt: preserveEffectsAfterInterrupt,
        ...(replayCastEnd == null ? {} : { replayCastEnd }),
        ...(suppressFollowingWait == null ? {} : { suppressFollowingWait })
      };
    }

    if (actualDuration === 0) return action;
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
          replayPreserveEffectsAfterInterrupt: preserveEffectsAfterInterrupt,
          ...(replayCastEnd == null ? {} : { replayCastEnd }),
          ...(suppressFollowingWait == null ? {} : { suppressFollowingWait })
        }
      : action;
  });
}
