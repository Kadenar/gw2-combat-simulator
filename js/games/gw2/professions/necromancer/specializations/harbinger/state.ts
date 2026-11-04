import { consumeNewestStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { boundedInteger } from '#kernel/core/numeric.js';

const BLIGHT_DURATION_SECONDS = 25;

/** Resolve one selected capacity for initialization, live stacks, observations, and previews. */
export function harbingerBlightMaximum(context: unknown): number {
  return Math.max(0, Math.trunc(balanceNumberFromContext(context, TRAIT.DARK_DISCIPLE, 'maximumStacks')));
}

/** Whole-stack progress stays below the selected cap so a real Blight consumption must trigger Meltdown. */
export function cascadingCorruptionProgressMaximum(context: unknown): number {
  return Math.max(0, Math.ceil(balanceNumberFromContext(context, TRAIT.CASCADING_CORRUPTION, 'maximumStacks')) - 1);
}

export interface HarbingerState {
  blightGeneration: number;
  nextBlightAt?: number;
  blightExpiries: number[];
  cascadingCorruptionStacks: number;
}

/** Creates isolated Blight and Cascading Corruption progress; accepted buffs own Meltdown's lifetime. */
function createHarbingerState(
  config: NecromancerConfig,
  preparation: { balanceContext: ProfessionBalanceContext }
): HarbingerState {
  const initialBlight = boundedInteger(
    config.initialBlight || 0,
    0,
    0,
    harbingerBlightMaximum(preparation.balanceContext)
  );
  // Starting progress stays below a full cycle; only a subsequent consumption can trigger Meltdown.
  const initialCascadingCorruptionStacks = boundedInteger(
    config.initialCascadingCorruptionStacks || 0,
    0,
    0,
    cascadingCorruptionProgressMaximum(preparation.balanceContext)
  );
  return {
    blightGeneration: 0,
    // POSITIVE_INFINITY means "not yet in shroud"; the cursor is set to a real value when Harbinger Shroud is entered.
    nextBlightAt: Number.POSITIVE_INFINITY,
    // Pre-existing Blight stacks are given an expiry of 25 s from t=0 so they last through a typical opener.
    blightExpiries: Array.from({ length: initialBlight }, () => BLIGHT_DURATION_SECONDS),
    cascadingCorruptionStacks: initialCascadingCorruptionStacks
  };
}

/** Cap the authoritative stack array only when needed, without copying already valid live state. */
function capHarbingerBlight(state: Pick<HarbingerState, 'blightExpiries'>, maximum: number): void {
  // Cap refreshes retain their consumption position; sorting by expiry would spend different stacks.
  if (state.blightExpiries.length > maximum)
    state.blightExpiries = maximum > 0 ? state.blightExpiries.slice(-maximum) : [];
}

/** Remove expired applications and enforce the selected capacity on the remaining stacks. */
export function purgeHarbingerTimedState(state: HarbingerState, at: number, maximum: number): void {
  state.blightExpiries = purgeExpiredStacks(state.blightExpiries, at);
  capHarbingerBlight(state, maximum);
}

/**
 * Adds 25-second applications; cap refreshes replace the shortest-lived stack in place so spending
 * still follows stack positions rather than expiry order.
 *
 * Returns the net change in live stacks, so a refresh at the cap still reports zero gained.
 */
export function addBlight(state: HarbingerState, stacks: number, at: number, maximum: number): number {
  purgeHarbingerTimedState(state, at, maximum);
  const before = state.blightExpiries.length;
  const expiries = state.blightExpiries;
  const count = boundedInteger(stacks, 0, 0, maximum);
  for (let index = 0; index < count; index += 1) {
    const expiresAt = canonicalTime(at + BLIGHT_DURATION_SECONDS);

    if (expiries.length < maximum) expiries.push(expiresAt);
    else expiries[expiries.indexOf(Math.min(...expiries))] = expiresAt;
  }

  return state.blightExpiries.length - before;
}

/**
 * Consumes from the end of the live stack array. Refreshed positions stay in place, so the consumed
 * stacks need not be the freshest; expiration likewise preserves the surviving positions.
 */
export function consumeBlight(state: HarbingerState, stacks: number, at: number, maximum: number): number {
  purgeHarbingerTimedState(state, at, maximum);
  const consumption = consumeNewestStacks(state.blightExpiries, stacks, at);
  state.blightExpiries = consumption.expiries;
  return consumption.consumed;
}

export const harbingerState = defineProfessionSpecializationState('Harbinger', createHarbingerState);

/** Derive capped Blight observations without altering the authoritative stack array. */
export function projectHarbingerPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = harbingerState.from(input.profession);
  const capped = { blightExpiries: state.blightExpiries };
  capHarbingerBlight(capped, harbingerBlightMaximum(input));
  return {
    [STATE.BLIGHT_EXPIRIES]: capped.blightExpiries,
    [STATE.CASCADING_CORRUPTION_STACKS]: state.cascadingCorruptionStacks,
    [STATE.BLIGHT]: capped.blightExpiries.length
  };
}
