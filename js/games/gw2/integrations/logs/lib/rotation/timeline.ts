import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { actionKind } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { retainsReplayCastLockout } from '#gw2/integrations/logs/lib/rotation/timing.js';
import type { ReconstructedCommand, ReconstructedRotationCommand } from '#gw2/integrations/logs/lib/rotation/model.js';
import { quantizeGw2ActionTimingMs, quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';

const OBSERVED_CAST_TOLERANCE_MS = 20;

export interface ReplayTimelineAction {
  readonly start: number;
  readonly end: number;
  readonly eventIndex: number;
  readonly skill: Skill | null;
  readonly name: string;
  readonly skillId: string | number;
  readonly independentTimeline?: boolean;
  /** Replays observed overlap while retaining this action as the scheduler's next relative-offset anchor. */
  readonly concurrentTimeline?: boolean;
  /** Runtime occupancy of a profession-resolved skill variant, including its built-in wind-up. */
  readonly replayDurationMs?: number;
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
  /** Limits runtime correction to observed casts, preserving command occupancy owned by profession mechanics. */
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
  const excessMs = replayEnd - action.start - (action.replayDurationMs ?? quicknessReferenceCastTimeMs(action.skill));
  return excessMs > OBSERVED_CAST_TOLERANCE_MS ? excessMs : 0;
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
  const entries: Array<
    | { readonly type: 'action'; readonly action: Action }
    | { readonly type: 'combat-start'; readonly at: number; readonly index: number }
  > = actions.map((action) => ({ type: 'action', action }));
  if (combatStart != null) entries.push({ type: 'combat-start', at: combatStart, index: -1 });
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

  // Tied Revenant swaps must trigger the outgoing weapon's sigils before changing weapons.
  // Exchange only the swap slots so other simultaneous inputs retain their source order.
  const weaponSwapIndices = new Map<number, number>();
  for (const [index, entry] of entries.entries()) {
    if (entry.type !== 'action') continue;
    if (entry.action.name === 'Swap Weapons') weaponSwapIndices.set(entry.action.start, index);
    const weaponIndex = weaponSwapIndices.get(entry.action.start);
    if (entry.action.name !== 'Swap Legends' || weaponIndex == null) continue;
    [entries[weaponIndex], entries[index]] = [entry, entries[weaponIndex]];
    weaponSwapIndices.delete(entry.action.start);
  }

  const rotation: ReconstructedCommand[] = [];
  let activeCastEnd = origin;
  let activeCast: Action | null = null;
  let retainedCastEnd = origin;
  let previousCastStart: number | null = null;
  let pendingAftercast: { until: number; progressedTo: number } | null = null;
  let interruptPaddingEnd = origin;
  let interruptPaddingProgress = origin;
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

  // Wait only after cancellation, preserving the rounded lane without delaying overlapping commands or reviving packets.
  const appendInterruptPadding = (): void => {
    appendWait(
      interruptPaddingEnd -
        (alignWaitsToSimulatorTiming ? Math.max(projectedTime, projectedReservedEnd) : interruptPaddingProgress)
    );
    interruptPaddingEnd = origin;
    interruptPaddingProgress = origin;
  };

  const appendPendingAftercastWait = (): void => {
    appendInterruptPadding();
    if (!pendingAftercast) return;
    const waitMs = alignWaitsToSimulatorTiming
      ? quantizeWaitMs(pendingAftercast.until - ignoredSourceIdleMs - Math.max(projectedTime, projectedReservedEnd))
      : quantizeWaitMs(pendingAftercast.until - pendingAftercast.progressedTo);
    appendWait(waitMs);
    pendingAftercast = null;
  };

  const appendObservedIdle = (nextActionAt: number): void => {
    appendInterruptPadding();
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
    // Combat can start on the final packet of a cast; action jitter must not postpone its observation window.
    const overlapping = at < blockingEnd - (entry.type === 'combat-start' ? 0 : timingToleranceMs);
    if (entry.type === 'combat-start') {
      if (previousCastStart != null && overlapping) {
        // Round combat offsets relative to the skill, retaining exact packet-proven boundaries so opening hits stay observable.
        const offset = quantizeGw2ActionTimingMs(at - previousCastStart);
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
    // Swaps can overlap dodge without cancelling it; delaying them also delays the next swap's cooldown.
    const swapDuringDodge = activeCast != null && actionKind(activeCast.skill, activeCast.name) === 'dodge';
    const concurrent =
      (action.name !== 'Swap Weapons' || swapDuringDodge) &&
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
      const runtimeEnd = at + (action.replayDurationMs ?? quicknessReferenceCastTimeMs(action.skill));
      pendingAftercast.progressedTo = Math.min(
        pendingAftercast.until,
        Math.max(pendingAftercast.progressedTo, runtimeEnd)
      );
    }

    if (interruptPaddingEnd > origin && concurrent) {
      interruptPaddingProgress = Math.max(
        interruptPaddingProgress,
        at + (action.replayDurationMs ?? quicknessReferenceCastTimeMs(action.skill))
      );
    }

    rotation.push(command);
    if (alignWaitsToSimulatorTiming) {
      // Mechanic-owned charge intervals already define their replay occupancy.
      const runtimeMs =
        action.replayDurationMs ??
        (action.skill && policy.hasObservedCastTime?.(action) !== false
          ? quicknessReferenceCastTimeMs(action.skill)
          : actionReplayEnd - at);
      const interruptMs = command.interruptMs ?? action.skill?.defaultInterruptMs;
      const effectiveRuntimeMs = interruptMs == null ? runtimeMs : Math.min(runtimeMs, Math.max(0, interruptMs));
      const retainedRuntimeMs =
        effectiveRuntimeMs < runtimeMs && retainsReplayCastLockout(action.skill, effectiveRuntimeMs)
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

    if (action.skill?.interruptMode === 'per-packet' && command.interruptMs != null) {
      const paddingMs = quantizeGw2ActionTimingMs(command.interruptMs) - command.interruptMs;
      if (paddingMs > 0) {
        const end = (alignWaitsToSimulatorTiming ? projectedTime : at) + command.interruptMs;
        interruptPaddingEnd = Math.max(interruptPaddingEnd, end + paddingMs);
        interruptPaddingProgress = at + command.interruptMs;
      }
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
      if (!instant && actionReplayEnd >= activeCastEnd) activeCast = action;
      activeCastEnd = Math.max(activeCastEnd, instant ? at : actionReplayEnd);
      // Only an interrupted command uses the retained lane; idle after a completed cast remains explicit.
      if (command.interruptMs != null && retainsReplayCastLockout(action.skill, command.interruptMs)) {
        retainedCastEnd = Math.max(retainedCastEnd, actionReplayEnd);
      }
    }
  }

  appendPendingAftercastWait();

  return rotation;
}
