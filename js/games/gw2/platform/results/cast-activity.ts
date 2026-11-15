/** Classify interrupted actions by their observed output, independently of damage-table rows. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ResolverResult } from '#gw2/platform/results/types.js';

const UTILITY_EVENTS = new Set(['buff', 'resource', 'control', 'aura', 'combo', 'boon_extension', 'condition']);
const usefulActivationCache = new WeakMap<readonly SimulationEvent[], ReadonlySet<string>>();

/** Accepted utility or damage makes an activation productive even when its cast was interrupted. */
export function usefulActivationIds(events: readonly SimulationEvent[]): ReadonlySet<string> {
  const cached = usefulActivationCache.get(events);

  if (cached) return cached;

  const useful = new Set(
    events
      .filter(
        (event) =>
          event.activationId && event.cancelled !== true && (Number(event.damage) > 0 || UTILITY_EVENTS.has(event.type))
      )
      .map((event) => event.activationId!)
  );
  usefulActivationCache.set(events, useful);
  return useful;
}

export interface FailedCast {
  readonly action: SimulationEvent;
  readonly start: number;
  readonly end: number;
  readonly durationMs: number;
}

const failedCastCache = new WeakMap<Gw2ResolverResult, readonly FailedCast[]>();

/** Use observed combat entry, including implicit entry when the rotation has no explicit marker. */
export function combatActivityStartMs(result: Gw2ResolverResult): number {
  return (result.combatStartTime ?? result.events.find((event) => event.type === 'combat_start')?.at ?? 0) * 1000;
}

/** Combat reporting stops at death even when authored commands continue beyond it. */
export function combatActivityEndMs(result: Gw2ResolverResult): number {
  return Math.min(result.combatEndTime, result.deathTime ?? Infinity) * 1000;
}

/** Immutable result snapshots share one action-derived list across tables, summaries, and comparisons. */
export function failedPlayerCasts(result: Gw2ResolverResult): readonly FailedCast[] {
  const cached = failedCastCache.get(result);

  if (cached) return cached;

  const useful = usefulActivationIds(result.resolvedEvents);
  const combatStart = combatActivityStartMs(result);
  const combatEnd = combatActivityEndMs(result);
  const casts: FailedCast[] = [];
  for (const action of result.events) {
    if (
      action.type !== 'action' ||
      action.actorType !== ACTOR.PLAYER ||
      !(action.cancelled || action.missingInterruptCommit === true) ||
      (!(action.cancelled === true && action.missingInterruptCommit !== true) &&
        action.activationId &&
        useful.has(action.activationId))
    )
      continue;

    const start = Math.max(combatStart, Math.round(action.at * 1000));
    const end = Math.min(combatEnd, Math.round(Number(action.endsAt ?? action.at) * 1000));

    if (end > start) casts.push({ action, start, end, durationMs: end - start });
  }

  failedCastCache.set(result, casts);
  return casts;
}
