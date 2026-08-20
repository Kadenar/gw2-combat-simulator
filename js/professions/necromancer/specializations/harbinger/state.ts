import type { HarbingerState, NecromancerConfig } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';

export function createHarbingerState(config: NecromancerConfig = {}): HarbingerState {
  const initialBlight = Math.max(0, Math.min(25, Math.trunc(Number(config.initialBlight || 0))));
  // Cap at 19 rather than 20: pre-combat stacks must never immediately trigger Meltdown on the first consumed Blight.
  const initialCascadingCorruptionStacks = Math.max(
    0,
    Math.min(19, Math.trunc(Number(config.initialCascadingCorruptionStacks || 0)))
  );
  return {
    // POSITIVE_INFINITY means "not yet in shroud"; the cursor is set to a real value when Harbinger Shroud is entered.
    nextBlightAt: Number.POSITIVE_INFINITY,
    blight: initialBlight,
    // Pre-existing Blight stacks are given an expiry of 25 s from t=0 so they last through a typical opener.
    blightExpiries: Array.from({ length: initialBlight }, () => 25),
    cascadingCorruptionStacks: initialCascadingCorruptionStacks,
    meltdownUntil: 0
  };
}

/** Keeps Harbinger's capped, expiry-backed Blight representation internally consistent. */
export function syncHarbingerState<TState extends HarbingerState>(state: TState): TState {
  state.blightExpiries = (state.blightExpiries || []).sort((left, right) => left - right).slice(-25);
  state.blight = state.blightExpiries.length;
  return state;
}

export function purgeHarbingerTimedState(state: HarbingerState, at: number): void {
  state.blightExpiries = state.blightExpiries.filter((expiresAt: number) => expiresAt > at);
  syncHarbingerState(state);
}

export function addBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const count = Math.min(Math.max(0, Math.trunc(Number(stacks || 0))), 25 - state.blightExpiries.length);
  state.blightExpiries.push(...Array.from({ length: count }, () => at + 25));
  syncHarbingerState(state);
  return count;
}

export function consumeBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const count = Math.min(Math.max(0, Math.trunc(Number(stacks || 0))), state.blightExpiries.length);
  state.blightExpiries.splice(0, count);
  syncHarbingerState(state);
  return count;
}

export const harbingerState = defineProfessionSpecializationState('Harbinger', createHarbingerState);
