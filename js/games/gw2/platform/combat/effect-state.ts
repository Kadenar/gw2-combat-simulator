import {
  buffApplicationStacks,
  durationStackingBoonCapSeconds,
  durationStackState,
  isDurationStackingBoon,
  type Gw2TimedBuffApplication
} from '#gw2/platform/combat/boons.js';
import { buffApplicationExpiry, buffWindowActive } from '#gw2/platform/combat/buff-expiry.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

/** Detached observations of existing gameplay owners; these are never a second mutable combat pool. */
export interface EffectState<Source = SimulationEvent> {
  readonly kind: string;
  readonly category: 'boon' | 'buff' | 'condition';
  readonly recipient: string;
  readonly origin: 'simulated' | 'assumption' | 'party-projection';
  readonly name?: string;
  readonly countLimit: number | null;
  readonly durationLimit: number | null;
  readonly measure: 'count' | 'remaining-duration';
  readonly windows: readonly {
    /** Natural deadline; null means permanent. */
    readonly expiresAt: number | null;
    /** Explicit removal, such as consumption or companion retirement, closes the window at this instant. */
    readonly removedAt?: number;
    readonly stacks: number;
    readonly source?: Source;
  }[];
  readonly source?: Source;
}

/** Every generic buff has an explicit gameplay policy; tuning is resolved by its native owner. */
export interface BuffStatePolicy {
  /** Profession pools replace all generic recipient histories for this effect. */
  readonly owner?: 'profession';
  readonly kind: string;
  /** Stable display identity belongs to the buff owner, independent of the granting skill. */
  readonly name?: string;
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
    recipient: RECIPIENT.SELF,
    origin: 'simulated',
    countLimit,
    durationLimit: null,
    measure: 'count',
    ...options,
    windows
  };
}

/**
 * Value at an instant: a buff window ending exactly then still counts, matching gameplay tied to its deadline.
 * Target conditions keep half-open lifetimes, and explicit removal always closes a window at its instant.
 */
export function effectStateValue<Source>(
  state: EffectState<Source>,
  at: number
): { count: number; expiresAt: number | null; source?: Source } {
  if (state.category === 'condition') return effectStateIntervalValue(state, at);

  return windowValue(state, at, (expiresAt, removedAt) => buffWindowActive(at, -Infinity, expiresAt, removedAt));
}

/** Value over the interval starting at `at`; a window ending exactly then has no remaining extent. */
export function effectStateIntervalValue<Source>(
  state: EffectState<Source>,
  at: number
): { count: number; expiresAt: number | null; source?: Source } {
  return windowValue(state, at, (expiresAt, removedAt) => expiresAt > at && !(removedAt != null && removedAt <= at));
}

/** Project a single active buff. Zero is an absent deadline and Infinity lasts until the owner clears it. */
export function timedBuffWindow(kind: string, name: string, expiresAt: number): EffectState {
  return timedEffectState(
    kind,
    expiresAt > 0 ? [{ stacks: 1, expiresAt: expiresAt === Infinity ? null : expiresAt }] : [],
    1,
    { name }
  );
}

/** Reuse the combat query for capped intensity; a window snapshot contains no future applications. */
function windowValue<Source>(
  state: EffectState<Source>,
  at: number,
  live: (expiresAt: number, removedAt: number | undefined) => boolean
): { count: number; expiresAt: number | null; source?: Source } {
  const windows = state.windows.filter(
    (window) => window.stacks > 0 && live(window.expiresAt ?? Infinity, window.removedAt)
  );
  const count = buffApplicationStacks(
    windows.map((window) => ({ at: -Infinity, expiresAt: buffApplicationExpiry(window), stacks: window.stacks })),
    '',
    at,
    state.countLimit ?? Infinity,
    { includes: () => true }
  );
  // The reported deadline is when the last live window actually ends, including an earlier removal.
  const expiresAt = windows.some((window) => window.expiresAt == null && window.removedAt == null)
    ? null
    : Math.max(at, ...windows.map(buffApplicationExpiry));
  return { count, expiresAt, source: windows.at(-1)?.source ?? state.source };
}

/** Observe already resolved boon storage, preserving recipient-specific duration pools and absolute deadlines. */
export function observeBuffState(
  kind: string,
  applications: readonly Gw2TimedBuffApplication[],
  at: number,
  policy: BuffStatePolicy,
  recipient: string = RECIPIENT.SELF,
  includes = (application: Gw2TimedBuffApplication) => application.resolvedAudience.includesSelf
): EffectState {
  const duration = isDurationStackingBoon(kind);
  const pool = duration
    ? durationStackState(applications, at, { includes, maximum: durationStackingBoonCapSeconds(kind) })
    : null;
  // The last eligible grant supplies the chart label. Duration pools retain their latest source across expiries.
  let source: SimulationEvent | undefined;
  for (let index = applications.length - 1; index >= 0; index--) {
    const application = applications[index]!;

    if (
      application.event &&
      application.at <= at &&
      includes(application) &&
      (duration || buffWindowActive(at, application.at, application.expiresAt, application.removedAt))
    ) {
      source = application.event;
      break;
    }
  }

  return {
    kind,
    category: duration || [BOON.MIGHT, BOON.STABILITY, BOON.AEGIS].some((boon) => boon === kind) ? 'boon' : 'buff',
    name: policy.name,
    recipient,
    origin: 'simulated',
    source,
    countLimit: duration ? 1 : (policy.maximumStacks ?? null),
    durationLimit: duration ? durationStackingBoonCapSeconds(kind) : (policy.maximumDuration ?? null),
    measure: duration || policy.maximumDuration != null ? 'remaining-duration' : 'count',
    // Keep a stable execution-clock deadline so floating-point drift cannot create extra chart transitions.
    windows: duration
      ? pool!.active
        ? [{ stacks: 1, expiresAt: gw2Time(at + pool!.remaining) }]
        : []
      : applications
          .filter(
            (application) =>
              includes(application) &&
              buffWindowActive(at, application.at, application.expiresAt, application.removedAt)
          )
          .map((application) => ({
            stacks: application.stacks,
            expiresAt: application.expiresAt,
            ...(application.removedAt == null ? {} : { removedAt: application.removedAt }),
            source: application.event
          }))
  };
}

// Revisions describe accepted mutations without copying combat state or retaining completed simulations.
const revisions = new WeakMap<object, number>();

/** Invalidate observations when an owner changes windows, including in-place expiry changes. */
export function reviseEffectState(owner: object): void {
  revisions.set(owner, effectStateRevision(owner) + 1);
}

/** Observers can check an owner's revision without scanning its historical applications. */
export function effectStateRevision(owner: object): number {
  return revisions.get(owner) ?? 0;
}
