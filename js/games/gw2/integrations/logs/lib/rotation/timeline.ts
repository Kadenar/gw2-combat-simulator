import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ReconstructedCommand, ReconstructedRotationCommand } from '#gw2/integrations/logs/lib/rotation/model.js';
import { quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';

const OBSERVED_CAST_TOLERANCE_MS = 20;

export interface ReplayTimelineAction {
  readonly start: number;
  readonly end: number;
  readonly eventIndex: number;
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: string | number;
  readonly control?: 'cooldown-reset';
  readonly independentTimeline?: boolean;
  /** Replays observed overlap while retaining this action as the scheduler's next relative-offset anchor. */
  readonly concurrentTimeline?: boolean;
  readonly followingWaitMs?: number;
  /** Opening-hit evidence may place combat before a source phase/EVTC boundary so its damage remains observable. */
  readonly combatStartOverride?: number;
}

export interface ReplayTimelinePolicy<Action extends ReplayTimelineAction> {
  readonly timingToleranceMs?: number;
  /** Positive source gaps at or below this threshold are timing jitter, not intentional simulator idle time. */
  readonly minimumWaitMs?: number;
  readonly quantizeMs?: (value: number) => number;
  /** Quantizes imported idle durations independently from offsets when their replay precision differs. */
  readonly quantizeWaitMs?: (value: number) => number;
  readonly replayEnd?: (action: Action) => number;
  /** Makes waits compensate when emitted commands use a different cast duration than the source log. */
  readonly alignWaitsToSimulatorTiming?: boolean;
  /** Limits runtime correction to observed casts, preserving inferred setup and waits owned by profession mechanics. */
  readonly hasObservedCastTime?: (action: Action) => boolean;
  readonly compareSimultaneousActions?: (left: Action, right: Action) => number;
  readonly commandFor: (action: Action) => ReconstructedRotationCommand;
  readonly canEmit?: (action: Action) => boolean;
  readonly isBoundaryTransition?: (action: Action, activeCastEnd: number, previousCastStart: number | null) => boolean;
}

function identityMilliseconds(value: number): number {
  return Math.max(0, value);
}

/** Preserves overlong explicit casts while leaving autoattack chains to model their own cadence. */
function observedAftercastWaitMs(action: ReplayTimelineAction, replayEnd: number): number {
  if (!action.skill || String(action.skill.slot || '').toLowerCase() === 'weapon_1') return 0;
  const excessMs = replayEnd - action.start - quicknessReferenceCastTimeMs(action.skill);
  return excessMs > OBSERVED_CAST_TOLERANCE_MS ? excessMs : 0;
}

/** Applies the earliest proven combat boundary without moving a later source boundary forward. */
export function replayCombatStart(
  actions: readonly { readonly combatStartOverride?: number }[],
  sourceCombatStart: number | null
): number | null {
  const overrides = actions
    .map((action) => Number(action.combatStartOverride))
    .filter((value) => Number.isFinite(value));
  if (!overrides.length) return sourceCombatStart;
  const earliestOverride = Math.min(...overrides);
  return sourceCombatStart == null ? earliestOverride : Math.min(sourceCombatStart, earliestOverride);
}

/** Converts one normalized action timeline into executable commands so both log sources preserve the same gaps and overlaps. */
export function buildReplayTimeline<Action extends ReplayTimelineAction>(
  actions: readonly Action[],
  origin: number,
  combatStart: number | null,
  policy: ReplayTimelinePolicy<Action>
): ReconstructedCommand[] {
  const timingToleranceMs = policy.timingToleranceMs ?? 50;
  const minimumWaitMs = Math.max(0, Number(policy.minimumWaitMs || 0));
  const quantizeMs = policy.quantizeMs ?? identityMilliseconds;
  const quantizeWaitMs = policy.quantizeWaitMs ?? quantizeMs;
  const replayEnd = policy.replayEnd ?? ((action: Action) => action.end);
  const alignWaitsToSimulatorTiming = policy.alignWaitsToSimulatorTiming === true;
  const canEmit = policy.canEmit ?? ((action: Action) => action.skill != null);
  const effectiveCombatStart = replayCombatStart(actions, combatStart);
  const preserveCombatStartOffset = actions.some(
    (action) => Number(action.combatStartOverride) === effectiveCombatStart
  );
  const entries: Array<
    | { readonly type: 'action'; readonly action: Action }
    | { readonly type: 'combat-start'; readonly at: number; readonly index: number }
  > = actions.map((action) => ({ type: 'action', action }));
  if (effectiveCombatStart != null) entries.push({ type: 'combat-start', at: effectiveCombatStart, index: -1 });
  entries.sort((left, right) => {
    const leftTime = left.type === 'action' ? left.action.start : left.at;
    const rightTime = right.type === 'action' ? right.action.start : right.at;
    const leftIndex = left.type === 'action' ? left.action.eventIndex : left.index;
    const rightIndex = right.type === 'action' ? right.action.eventIndex : right.index;
    const timeOrder = leftTime - rightTime;
    if (timeOrder !== 0) return timeOrder;
    // Source-specific replay semantics may need a deterministic priority for
    // simultaneous actions while retaining the original event order otherwise.
    if (left.type === 'action' && right.type === 'action') {
      const actionOrder = policy.compareSimultaneousActions?.(left.action, right.action) ?? 0;
      if (actionOrder !== 0) return actionOrder;
    }

    return leftIndex - rightIndex;
  });

  const rotation: ReconstructedCommand[] = [];
  let activeCastEnd = origin;
  let retainedCastEnd = origin;
  let previousCastStart: number | null = null;
  let pendingAftercast: { until: number; progressedTo: number } | null = null;
  // Log adapters use this scheduler projection when source cast boundaries differ from serial replay timing.
  let projectedTime = origin;
  let projectedReservedEnd = origin;
  let projectedBlockingEnd = origin;
  let projectedInstantReadyAt = origin;
  let projectedIndependentReadyAt = origin;
  let projectedPreviousCastStart: number | null = null;
  let ignoredSourceIdleMs = 0;

  const appendWait = (waitMs: number): void => {
    if (!(waitMs > 0)) return;
    rotation.push({ name: '__wait', waitMs });
    if (alignWaitsToSimulatorTiming) {
      projectedTime = Math.max(projectedTime, projectedReservedEnd) + waitMs;
    }
  };

  const appendPendingAftercastWait = (): void => {
    if (!pendingAftercast) return;
    const waitMs = alignWaitsToSimulatorTiming
      ? quantizeWaitMs(pendingAftercast.until - ignoredSourceIdleMs - Math.max(projectedTime, projectedReservedEnd))
      : quantizeWaitMs(pendingAftercast.until - pendingAftercast.progressedTo);
    appendWait(waitMs);
    pendingAftercast = null;
  };

  const appendObservedIdle = (nextActionAt: number): void => {
    const blockingEnd = Math.max(activeCastEnd, retainedCastEnd);
    const observedGapMs = nextActionAt - blockingEnd;
    const retainedTimingJitter =
      retainedCastEnd > origin && retainedCastEnd >= activeCastEnd && observedGapMs <= timingToleranceMs;
    const waitMs = alignWaitsToSimulatorTiming
      ? quantizeWaitMs(nextActionAt - ignoredSourceIdleMs - Math.max(projectedTime, projectedReservedEnd))
      : quantizeWaitMs(observedGapMs);
    const aftercastWaitMs = pendingAftercast
      ? quantizeWaitMs(pendingAftercast.until - pendingAftercast.progressedTo)
      : 0;
    pendingAftercast = null;
    // A cancelled skill's retained aftercast already occupies this interval in the scheduler;
    // tolerate one source-timing frame around that boundary instead of replaying it as extra idle time.
    if (alignWaitsToSimulatorTiming) {
      if (!retainedTimingJitter && waitMs > minimumWaitMs) appendWait(waitMs);
      else ignoredSourceIdleMs += waitMs;
    } else {
      appendWait(aftercastWaitMs + (!retainedTimingJitter && waitMs > minimumWaitMs ? waitMs : 0));
    }

    activeCastEnd = nextActionAt;
  };

  for (const entry of entries) {
    const at = entry.type === 'action' ? entry.action.start : entry.at;
    const blockingEnd = Math.max(activeCastEnd, retainedCastEnd);
    const overlapping = at < blockingEnd - timingToleranceMs;
    if (entry.type === 'combat-start') {
      if (previousCastStart != null && overlapping) {
        // Keep a packet-proven observation boundary exact so action-frame rounding cannot move it past an opener.
        const offset = preserveCombatStartOffset ? at - previousCastStart : quantizeMs(at - previousCastStart);
        rotation.push({ name: '__combat_start', offset });
        if (alignWaitsToSimulatorTiming && projectedPreviousCastStart != null) {
          projectedTime = Math.max(projectedTime, projectedPreviousCastStart + offset);
        }
      } else {
        appendObservedIdle(at);
        rotation.push({ name: '__combat_start' });
        if (alignWaitsToSimulatorTiming) projectedTime = Math.max(projectedTime, projectedReservedEnd);
      }

      continue;
    }

    const action = entry.action;
    if (action.control === 'cooldown-reset') {
      if (overlapping) appendPendingAftercastWait();
      else appendObservedIdle(at);
      rotation.push({ name: '__cooldown_reset' });
      if (alignWaitsToSimulatorTiming) projectedTime = Math.max(projectedTime, projectedReservedEnd);
      continue;
    }

    const actionReplayEnd = Math.max(at, replayEnd(action));
    if (!canEmit(action)) {
      if (overlapping) appendPendingAftercastWait();
      else appendObservedIdle(at);
      appendWait(
        alignWaitsToSimulatorTiming
          ? quantizeWaitMs(actionReplayEnd - ignoredSourceIdleMs - Math.max(projectedTime, projectedReservedEnd))
          : quantizeWaitMs(actionReplayEnd - at)
      );
      activeCastEnd = Math.max(activeCastEnd, actionReplayEnd);
      previousCastStart = null;
      if (alignWaitsToSimulatorTiming) projectedPreviousCastStart = null;
      continue;
    }

    const command = { ...policy.commandFor(action) };
    const instant = actionReplayEnd <= at;
    const independent = action.skill?.independentCast === true || action.independentTimeline === true;
    // Weapon swaps cancel an active cast in game, so log imports must always replay them serially.
    const concurrent =
      action.name !== 'Swap Weapons' &&
      (independent || action.concurrentTimeline === true || (instant && action.skill?.canCastConcurrently !== false));
    const boundaryTransition = policy.isBoundaryTransition?.(action, blockingEnd, previousCastStart) === true;
    if (independent && previousCastStart != null && at >= previousCastStart) {
      command.offset = quantizeMs(at - previousCastStart);
    } else if (previousCastStart != null && ((concurrent && overlapping) || boundaryTransition)) {
      command.offset = quantizeMs(at - previousCastStart);
    } else {
      appendObservedIdle(at);
    }

    // Concurrent actions advance the replay clock through an observed excess-cast interval, so only its remainder waits.
    if (pendingAftercast && concurrent) {
      const runtimeEnd = at + quicknessReferenceCastTimeMs(action.skill);
      pendingAftercast.progressedTo = Math.min(
        pendingAftercast.until,
        Math.max(pendingAftercast.progressedTo, runtimeEnd)
      );
    }

    rotation.push(command);
    if (alignWaitsToSimulatorTiming) {
      // Inferred setup and mechanic-owned charge intervals already define their replay occupancy.
      const runtimeMs =
        action.skill && policy.hasObservedCastTime?.(action) !== false
          ? quicknessReferenceCastTimeMs(action.skill)
          : actionReplayEnd - at;
      const interruptMs = command.interruptMs ?? action.skill?.defaultInterruptMs;
      const effectiveRuntimeMs = interruptMs == null ? runtimeMs : Math.min(runtimeMs, Math.max(0, interruptMs));
      const retainedRuntimeMs =
        effectiveRuntimeMs < runtimeMs && action.skill?.retainsCastLockoutAfterInterrupt === true
          ? runtimeMs
          : effectiveRuntimeMs;
      const projectedStart: number =
        command.offset != null && projectedPreviousCastStart != null
          ? Math.max(projectedTime, projectedPreviousCastStart + command.offset)
          : independent
            ? Math.max(projectedTime, projectedIndependentReadyAt)
            : instant
              ? Math.max(projectedTime, projectedInstantReadyAt)
              : Math.max(projectedTime, projectedBlockingEnd);
      projectedTime = projectedStart;
      projectedReservedEnd = Math.max(projectedReservedEnd, projectedStart + retainedRuntimeMs);
      if (independent) {
        if (action.skill?.independentCastCanOverlap !== true) {
          projectedIndependentReadyAt = Math.max(projectedIndependentReadyAt, projectedStart + retainedRuntimeMs);
        }
      } else {
        projectedPreviousCastStart = projectedStart;
        projectedInstantReadyAt = Math.max(projectedInstantReadyAt, projectedStart + effectiveRuntimeMs);
        projectedBlockingEnd = Math.max(projectedBlockingEnd, projectedStart + retainedRuntimeMs);
      }
    }

    if (action.followingWaitMs && action.followingWaitMs > 0) {
      appendWait(quantizeWaitMs(action.followingWaitMs));
    }

    const aftercastWaitMs = observedAftercastWaitMs(action, actionReplayEnd);
    if (!concurrent && policy.hasObservedCastTime?.(action) !== false && aftercastWaitMs > 0) {
      pendingAftercast = {
        until: actionReplayEnd,
        progressedTo: actionReplayEnd - aftercastWaitMs
      };
    }

    if (independent) {
      activeCastEnd = Math.max(activeCastEnd, at);
    } else {
      previousCastStart = at;
      activeCastEnd = Math.max(activeCastEnd, instant ? at : actionReplayEnd);
      // Only an interrupted command uses the retained lane; idle after a completed cast remains explicit.
      if (action.skill?.retainsCastLockoutAfterInterrupt === true && command.interruptMs != null) {
        retainedCastEnd = Math.max(retainedCastEnd, actionReplayEnd);
      }
    }
  }

  appendPendingAftercastWait();

  return rotation;
}
