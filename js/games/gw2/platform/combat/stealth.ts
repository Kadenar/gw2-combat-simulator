import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { STATUS } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

// Gameplay grants and duration observations share the same status limits, in seconds.
const MAXIMUM_STEALTH_DURATION = 15;
const REVEALED_DURATION = 3;

/** One status window serves gameplay and detached queries; attack entitlements remain profession-owned. */
export interface StealthState {
  stealthStartedAt: number;
  stealthUntil: number;
  revealedUntil: number;
}

/** Every profession starts without stealth or a Revealed lockout. */
export function createStealthState(): StealthState {
  return { stealthStartedAt: 0, stealthUntil: 0, revealedUntil: 0 };
}

/** Partial state is used by detached previews; expiry is exclusive for both statuses. */
export function revealedActive(state: Readonly<Partial<StealthState>>, at: number): boolean {
  return (state.revealedUntil ?? 0) > canonicalTime(at);
}

/** Gameplay and detached consumers use the same entry, exclusive expiry, and Revealed gate. */
export function stealthActive(state: Readonly<Partial<StealthState>>, at: number): boolean {
  const time = canonicalTime(at);
  return (state.stealthStartedAt ?? 0) <= time && (state.stealthUntil ?? 0) > time && !revealedActive(state, time);
}

/** Attacks close stealth and optionally apply Revealed, including attacks enabled by a separate entitlement. */
export function endStealth(state: StealthState, at: number, reveal = true): void {
  const time = canonicalTime(at);
  state.stealthStartedAt = time;
  state.stealthUntil = time;

  if (reveal) state.revealedUntil = canonicalTime(time + REVEALED_DURATION);
}

interface StealthPolicy<T extends { core: StealthState }, TSkill extends Skill> {
  /** Some granting strikes must settle before their new stealth window becomes usable. */
  readonly applicationPriority?: number;
  /** Profession reactions observe the accepted status, without duplicating grant arithmetic. */
  readonly onGranted?: (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent, entered: boolean) => void;
}

const APPLY_STEALTH = 'gw2.apply-stealth';

/** All sources enter through accepted self buff applications; local policies retain same-time reaction ordering. */
export function createStealthLifecycle<T extends { core: StealthState }, TSkill extends Skill>(
  policy: StealthPolicy<T, TSkill> = {}
): RuntimeHooks<T, TSkill> {
  function apply(runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent): void {
    const state = runtime.profession.core;
    const duration = Number(event.duration);

    if (!(duration > 0) || revealedActive(state, runtime.time)) return;

    const entered = !stealthActive(state, runtime.time);

    if (entered) state.stealthStartedAt = runtime.time;

    state.stealthUntil = canonicalTime(
      Math.min(runtime.time + MAXIMUM_STEALTH_DURATION, Math.max(runtime.time, state.stealthUntil) + duration)
    );
    policy.onGranted?.(runtime, event, entered);
  }

  return {
    // Self observations use the status owner, so rejected grants and broken stealth cannot leave a phantom buff.
    observeEffects(runtime) {
      const state = runtime.profession.core;
      return [
        timedEffectState(
          STATUS.STEALTH,
          stealthActive(state, runtime.time) ? [{ stacks: 1, expiresAt: state.stealthUntil }] : [],
          1,
          { durationLimit: MAXIMUM_STEALTH_DURATION, measure: 'remaining-duration' }
        )
      ];
    },
    reactions: {
      'buff.applied'(runtime, event) {
        if (event.kind !== STATUS.STEALTH || !event.resolvedAudience?.includesSelf) return;

        if (policy.applicationPriority === undefined) apply(runtime, event);
        else runtime.schedule(APPLY_STEALTH, runtime.time, event, undefined, policy.applicationPriority);
      }
    },
    ...(policy.applicationPriority === undefined
      ? {}
      : {
          tasks: {
            [APPLY_STEALTH]: (runtime: MechanicContext<T, TSkill>, data: unknown) =>
              apply(runtime, data as Gw2ResolverEvent)
          }
        })
  };
}
