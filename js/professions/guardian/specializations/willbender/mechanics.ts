import type { GuardianWillbenderState } from '../../types.js';

export const WILLBENDER_FLAME_DURATION = 5;
export const WILLBENDER_FLAME_INTERVAL = 1;
export const WILLBENDER_TRIGGER_HITS = 5;
export const WILLBENDER_MAX_LETHAL_TEMPO = 5;

// Tyrant's Momentum shortens the window (4 s vs 6 s) but raises the per-stack bonus,
// so the trait trades sustain for burst; both modifier rules account for this asymmetry.
export function lethalTempoDuration(tyrantsMomentum: boolean): number {
  return tyrantsMomentum ? 4 : 6;
}

export function gainLethalTempo(
  state: GuardianWillbenderState,
  at: number,
  tyrantsMomentum: boolean,
  maximumStacks = WILLBENDER_MAX_LETHAL_TEMPO,
  duration = lethalTempoDuration(tyrantsMomentum)
): number {
  // Stacks must reset when the previous window has fully expired before adding the new one;
  // otherwise a new activation mid-window would compound on a stale count.
  if (at >= state.lethalTempoUntil) state.lethalTempoStacks = 0;
  state.lethalTempoStacks = Math.min(maximumStacks, state.lethalTempoStacks + 1);
  state.lethalTempoUntil = at + duration;
  return state.lethalTempoStacks;
}

export function activeLethalTempo(state: GuardianWillbenderState, at: number): number {
  return at < state.lethalTempoUntil ? state.lethalTempoStacks : 0;
}
