import type { GuardianWillbenderState } from "../../types.js";

export const WILLBENDER_FLAME_DURATION = 5;
export const WILLBENDER_FLAME_INTERVAL = 1;
export const WILLBENDER_TRIGGER_HITS = 5;
export const WILLBENDER_MAX_LETHAL_TEMPO = 5;

export function lethalTempoDuration(tyrantsMomentum: boolean): number {
  return tyrantsMomentum ? 4 : 6;
}

export function gainLethalTempo(
  state: GuardianWillbenderState,
  at: number,
  tyrantsMomentum: boolean,
): number {
  if (at >= state.lethalTempoUntil) state.lethalTempoStacks = 0;
  state.lethalTempoStacks = Math.min(
    WILLBENDER_MAX_LETHAL_TEMPO,
    state.lethalTempoStacks + 1,
  );
  state.lethalTempoUntil = at + lethalTempoDuration(tyrantsMomentum);
  return state.lethalTempoStacks;
}

export function activeLethalTempo(
  state: GuardianWillbenderState,
  at: number,
): number {
  return at < state.lethalTempoUntil ? state.lethalTempoStacks : 0;
}
