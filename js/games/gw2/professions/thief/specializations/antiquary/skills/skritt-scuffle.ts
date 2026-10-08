import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { pilferArtifacts } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const SKRITT_SCUFFLE = 'thief.skritt-scuffle';

/** Each Skritt assistant keeps an independent lifetime, including a final pilfer at its expiry. */
export function skrittScufflePilfer(runtime: ThiefRuntime, data: unknown): void {
  const { expiresAt } = data as { expiresAt: number };
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.scuffle), 'pulseInterval');
  if (!(interval > 0) || runtime.time > expiresAt) return;
  const state = antiquaryState.from(runtime);
  const next = canonicalTime(runtime.time + interval);
  // The public value is a retry and display projection; the queued pulse owns scheduling.
  state.nextSkrittScufflePilferAt = next <= expiresAt ? next : 0;
  pilferArtifacts(runtime, 'scuffle');
  if (next <= expiresAt) runtime.schedule(SKRITT_SCUFFLE, next, { expiresAt });
}

/** The scheduled pilfer carries its assistant's lifetime, including the final pulse. */
export function completeSkrittScuffle(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.scuffle);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'durationMultiplier'));
  state.nextSkrittScufflePilferAt = runtime.time + interval;
  pilferArtifacts(runtime, 'scuffle');
  if (interval > 0) runtime.schedule(SKRITT_SCUFFLE, canonicalTime(runtime.time + interval), { expiresAt });
}
