import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import {
  addTimedStacks,
  consumeOldestStacks,
  purgeExpiredStacks
} from '#gw2/platform/combat/resources/timed-stacks.js';
import { boundedInteger } from '#kernel/core/numeric.js';

const BLIGHT_DURATION_SECONDS = 25;
const BLIGHT_MAXIMUM_STACKS = 25;

export interface HarbingerState {
  nextBlightAt?: number;
  blight: number;
  blightExpiries: number[];
  cascadingCorruptionStacks: number;
  meltdownUntil: number;
}

/** Declares Harbinger's public compatibility fields and inactive values. */
export const HARBINGER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'blight',
  'blightExpiries',
  'cascadingCorruptionStacks',
  'meltdownUntil'
] as const satisfies readonly (keyof HarbingerState)[]);

export const HARBINGER_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<HarbingerState>> = Object.freeze({
  blight: 0,
  blightExpiries: [],
  cascadingCorruptionStacks: 0,
  meltdownUntil: 0
});

/** Creates isolated Harbinger Blight, Cascading Corruption, and Meltdown state from build inputs. */
export function createHarbingerState(config: NecromancerConfig = {}): HarbingerState {
  const initialBlight = boundedInteger(config.initialBlight || 0, 0, 0, BLIGHT_MAXIMUM_STACKS);
  // Cap at 19 rather than 20: pre-combat stacks must never immediately trigger Meltdown on the first consumed Blight.
  const initialCascadingCorruptionStacks = boundedInteger(config.initialCascadingCorruptionStacks || 0, 0, 0, 19);
  return {
    // POSITIVE_INFINITY means "not yet in shroud"; the cursor is set to a real value when Harbinger Shroud is entered.
    nextBlightAt: Number.POSITIVE_INFINITY,
    blight: initialBlight,
    // Pre-existing Blight stacks are given an expiry of 25 s from t=0 so they last through a typical opener.
    blightExpiries: Array.from({ length: initialBlight }, () => BLIGHT_DURATION_SECONDS),
    cascadingCorruptionStacks: initialCascadingCorruptionStacks,
    meltdownUntil: 0
  };
}

/** Keeps Harbinger's capped, expiry-backed Blight representation internally consistent. */
export function syncHarbingerState<TState extends HarbingerState>(state: TState): TState {
  state.blightExpiries = (state.blightExpiries || []).sort((left, right) => left - right).slice(-BLIGHT_MAXIMUM_STACKS);
  state.blight = state.blightExpiries.length;
  return state;
}

/** Removes expired Blight applications and reconciles the public stack count. */
export function purgeHarbingerTimedState(state: HarbingerState, at: number): void {
  state.blightExpiries = purgeExpiredStacks(state.blightExpiries, at);
  syncHarbingerState(state);
}

/** Adds as many 25-second Blight applications as the stack cap permits. */
export function addBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const grant = addTimedStacks(state.blightExpiries, stacks, at, BLIGHT_DURATION_SECONDS, BLIGHT_MAXIMUM_STACKS);
  state.blightExpiries = grant.expiries;
  syncHarbingerState(state);
  return grant.added;
}

/** Consumes the oldest active Blight applications up to the requested amount. */
export function consumeBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const consumption = consumeOldestStacks(state.blightExpiries, stacks, at);
  state.blightExpiries = consumption.expiries;
  syncHarbingerState(state);
  return consumption.consumed;
}

export const harbingerState = defineProfessionSpecializationState('Harbinger', createHarbingerState);
