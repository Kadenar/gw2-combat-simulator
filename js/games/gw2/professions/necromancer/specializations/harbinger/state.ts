import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { consumeNewestStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
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
  // Cap refreshes retain their consumption position; sorting by expiry would spend different stacks.
  state.blightExpiries = (state.blightExpiries || []).slice(-BLIGHT_MAXIMUM_STACKS);
  state.blight = state.blightExpiries.length;
  return state;
}

/** Removes expired Blight applications and reconciles the public stack count. */
export function purgeHarbingerTimedState(state: HarbingerState, at: number): void {
  state.blightExpiries = purgeExpiredStacks(state.blightExpiries, at);
  syncHarbingerState(state);
}

/**
 * Adds 25-second applications; cap refreshes replace the shortest-lived stack in place so spending
 * still follows stack positions rather than expiry order.
 *
 * Returns the net change in live stacks, so a refresh at the cap still reports zero gained.
 */
export function addBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const before = state.blightExpiries.length;
  const expiries = state.blightExpiries;
  const count = boundedInteger(stacks, 0, 0, BLIGHT_MAXIMUM_STACKS);
  for (let index = 0; index < count; index += 1) {
    const expiresAt = at + BLIGHT_DURATION_SECONDS;
    if (expiries.length < BLIGHT_MAXIMUM_STACKS) expiries.push(expiresAt);
    else expiries[expiries.indexOf(Math.min(...expiries))] = expiresAt;
  }

  syncHarbingerState(state);
  return state.blightExpiries.length - before;
}

/**
 * Consumes from the end of the live stack array. Refreshed positions stay in place, so the consumed
 * stacks need not be the freshest; expiration likewise preserves the surviving positions.
 */
export function consumeBlight(state: HarbingerState, stacks: number, at: number): number {
  purgeHarbingerTimedState(state, at);
  const consumption = consumeNewestStacks(state.blightExpiries, stacks, at);
  state.blightExpiries = consumption.expiries;
  syncHarbingerState(state);
  return consumption.consumed;
}

export const harbingerState = defineProfessionSpecializationState('Harbinger', createHarbingerState);
