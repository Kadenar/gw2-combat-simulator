import {
  buffApplicationStacks,
  type Gw2TimedBuffApplication,
  isDurationStackingBoon,
  remainingDurationStackSeconds,
  durationStackingBoonCapSeconds
} from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

/** Detached observations of existing gameplay owners; these are never a second mutable combat pool. */
export interface EffectState {
  readonly kind: string;
  readonly category: 'boon' | 'buff' | 'condition';
  readonly recipient: string;
  readonly origin: 'simulated' | 'assumption' | 'party-projection';
  readonly name?: string;
  readonly countLimit: number | null;
  readonly durationLimit: number | null;
  readonly measure: 'count' | 'remaining-duration';
  readonly windows: readonly {
    readonly expiresAt: number | null;
    readonly stacks: number;
    readonly source?: SimulationEvent;
  }[];
  readonly source?: SimulationEvent;
}

/** Every generic buff has an explicit gameplay policy; tuning is resolved by its native owner. */
export interface BuffStatePolicy {
  /** Profession pools replace all generic recipient histories for this effect. */
  readonly owner?: 'profession';
  readonly kind: string;
  readonly maximumStacks?: number;
  readonly maximumDuration?: number;
}

/** Expose the existing mechanic's independent deadlines without copying its grant or consumption algorithm. */
export function timedEffectState(
  kind: string,
  windows: EffectState['windows'],
  countLimit: number | null = null,
  options: Partial<Omit<EffectState, 'kind' | 'windows' | 'countLimit'>> = {}
): EffectState {
  return {
    kind,
    category: 'buff',
    recipient: 'self',
    origin: 'simulated',
    countLimit,
    durationLimit: null,
    measure: 'count',
    ...options,
    windows
  };
}

/** Reuse the combat query for capped intensity; a window snapshot contains no future applications. */
export function effectStateValue(
  state: EffectState,
  at: number
): { count: number; expiresAt: number | null; source?: SimulationEvent } {
  const live = state.windows.filter(
    (window) => window.stacks > 0 && (window.expiresAt == null || window.expiresAt > at)
  );
  const count = buffApplicationStacks(
    live.map((window) => ({ at: 0, expiresAt: window.expiresAt ?? Infinity, stacks: window.stacks })),
    '',
    at,
    state.countLimit ?? Infinity,
    { includes: () => true }
  );
  const expiresAt = live.some((window) => window.expiresAt == null)
    ? null
    : Math.max(at, ...live.map((window) => window.expiresAt!));
  return { count, expiresAt, source: live.at(-1)?.source ?? state.source };
}

/** Observe already resolved boon storage, preserving recipient-specific duration pools and absolute deadlines. */
export function observeBuffState(
  kind: string,
  applications: readonly Gw2TimedBuffApplication[],
  at: number,
  policy: BuffStatePolicy,
  recipient = 'self',
  includes = (application: Gw2TimedBuffApplication) => application.resolvedAudience.includesSelf
): EffectState {
  const duration = isDurationStackingBoon(kind);
  const remaining = duration
    ? remainingDurationStackSeconds(applications, at, { includes, maximum: durationStackingBoonCapSeconds(kind) })
    : 0;
  return {
    kind,
    category: duration || ['might', 'stability', 'aegis'].includes(kind) ? 'boon' : 'buff',
    recipient,
    origin: 'simulated',
    source: applications
      .filter(
        (application) => includes(application) && application.at <= at && (duration || application.expiresAt > at)
      )
      .filter((application) => application.event)
      .at(-1)?.event,
    countLimit: duration ? 1 : (policy.maximumStacks ?? null),
    durationLimit: duration ? durationStackingBoonCapSeconds(kind) : (policy.maximumDuration ?? null),
    measure: duration || policy.maximumDuration != null ? 'remaining-duration' : 'count',
    windows: duration
      ? remaining > 0
        ? [{ stacks: 1, expiresAt: at + remaining }]
        : []
      : applications
          .filter((application) => includes(application) && application.at <= at && application.expiresAt > at)
          .map((application) => ({
            stacks: application.stacks,
            expiresAt: application.expiresAt,
            source: application.event
          }))
  };
}
