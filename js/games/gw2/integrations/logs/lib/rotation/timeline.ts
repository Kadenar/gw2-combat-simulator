import type { Skill } from '#gw2/platform/engine/types.js';
import type { ReconstructedCommand, ReconstructedRotationCommand } from '#gw2/integrations/logs/lib/rotation/model.js';

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
  /** Profession evidence may place combat before a source phase/EVTC boundary so an opening hit remains observable. */
  readonly combatStartOverride?: number;
}

export interface ReplayTimelinePolicy<Action extends ReplayTimelineAction> {
  readonly timingToleranceMs?: number;
  /** Positive source gaps at or below this threshold are timing jitter, not intentional simulator idle time. */
  readonly minimumWaitMs?: number;
  readonly quantizeMs?: (value: number) => number;
  readonly replayEnd?: (action: Action) => number;
  readonly compareSimultaneousActions?: (left: Action, right: Action) => number;
  readonly commandFor: (action: Action) => ReconstructedRotationCommand;
  readonly canEmit?: (action: Action) => boolean;
  readonly isBoundaryTransition?: (action: Action, activeCastEnd: number, previousCastStart: number | null) => boolean;
}

function identityMilliseconds(value: number): number {
  return Math.max(0, value);
}

/** Applies the earliest profession-proven combat boundary without moving a later source boundary forward. */
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
  const replayEnd = policy.replayEnd ?? ((action: Action) => action.end);
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
  const appendObservedIdle = (nextActionAt: number): void => {
    const blockingEnd = Math.max(activeCastEnd, retainedCastEnd);
    const observedGapMs = nextActionAt - blockingEnd;
    const retainedTimingJitter =
      retainedCastEnd > origin && retainedCastEnd >= activeCastEnd && observedGapMs <= timingToleranceMs;
    const waitMs = quantizeMs(observedGapMs);
    // A cancelled skill's retained aftercast already occupies this interval in the scheduler;
    // tolerate one source-timing frame around that boundary instead of replaying it as extra idle time.
    if (!retainedTimingJitter && waitMs > minimumWaitMs) rotation.push({ name: '__wait', waitMs });
    activeCastEnd = nextActionAt;
  };

  for (const entry of entries) {
    const at = entry.type === 'action' ? entry.action.start : entry.at;
    const blockingEnd = Math.max(activeCastEnd, retainedCastEnd);
    const overlapping = at < blockingEnd - timingToleranceMs;
    if (entry.type === 'combat-start') {
      if (previousCastStart != null && overlapping) {
        // Keep a profession-proven observation boundary exact so action-frame rounding cannot move it past an opener.
        const offset = preserveCombatStartOffset ? at - previousCastStart : quantizeMs(at - previousCastStart);
        rotation.push({ name: '__combat_start', offset });
      } else {
        appendObservedIdle(at);
        rotation.push({ name: '__combat_start' });
      }

      continue;
    }

    const action = entry.action;
    if (action.control === 'cooldown-reset') {
      if (!overlapping) appendObservedIdle(at);
      rotation.push({ name: '__cooldown_reset' });
      continue;
    }

    const actionReplayEnd = Math.max(at, replayEnd(action));
    if (!canEmit(action)) {
      if (!overlapping) appendObservedIdle(at);
      const waitMs = quantizeMs(actionReplayEnd - at);
      if (waitMs > 0) rotation.push({ name: '__wait', waitMs });
      activeCastEnd = Math.max(activeCastEnd, actionReplayEnd);
      previousCastStart = null;
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

    rotation.push(command);
    if (action.followingWaitMs && action.followingWaitMs > 0) {
      rotation.push({ name: '__wait', waitMs: quantizeMs(action.followingWaitMs) });
    }

    if (independent) {
      activeCastEnd = Math.max(activeCastEnd, at);
    } else {
      previousCastStart = at;
      activeCastEnd = Math.max(activeCastEnd, instant ? at : actionReplayEnd);
      if (action.skill?.retainsCastLockoutAfterInterrupt === true) {
        retainedCastEnd = Math.max(retainedCastEnd, actionReplayEnd);
      }
    }
  }

  return rotation;
}
