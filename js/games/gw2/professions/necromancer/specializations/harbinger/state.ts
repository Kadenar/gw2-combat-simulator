import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import {
  projectPublicProfessionState,
  flattenProfessionState,
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { NecromancerConfig } from '#gw2/professions/necromancer/types.js';
import { consumeNewestStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { HARBINGER_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

const BLIGHT_DURATION_SECONDS = 25;

/** Resolve one selected capacity for initialization, live stacks, observations, and previews. */
export function harbingerBlightMaximum(context: unknown): number {
  return Math.max(
    0,
    Math.trunc(balanceNumberFromContext(context, HARBINGER_BALANCE_PROFILE_IDS.resources, 'maximumStacks'))
  );
}

/** Starting progress cannot itself complete a cycle; a live Blight consumption must trigger the trait. */
export const MAXIMUM_INITIAL_CASCADING_CORRUPTION_STACKS = 19;

export interface HarbingerState {
  blightGeneration: number;
  nextBlightAt?: number;
  blight: number;
  blightExpiries: number[];
  cascadingCorruptionStacks: number;
  meltdownUntil: number;
}

/** Declares Harbinger's public fields and missing-state defaults, used only when Harbinger is selected. */
const HARBINGER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  blight: 0,
  blightExpiries: [],
  cascadingCorruptionStacks: 0,
  meltdownUntil: 0
} satisfies Partial<HarbingerState>);

/** Creates isolated Harbinger Blight, Cascading Corruption, and Meltdown state from build inputs. */
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
    MAXIMUM_INITIAL_CASCADING_CORRUPTION_STACKS
  );
  return {
    blightGeneration: 0,
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
function syncHarbingerState(state: Pick<HarbingerState, 'blight' | 'blightExpiries'>, maximum: number): void {
  // Cap refreshes retain their consumption position; sorting by expiry would spend different stacks.
  state.blightExpiries = maximum > 0 ? state.blightExpiries.slice(-maximum) : [];
  state.blight = state.blightExpiries.length;
}

/** Removes expired Blight applications and reconciles the public stack count. */
export function purgeHarbingerTimedState(state: HarbingerState, at: number, maximum: number): void {
  state.blightExpiries = purgeExpiredStacks(state.blightExpiries, at);
  syncHarbingerState(state, maximum);
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

  syncHarbingerState(state, maximum);
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
  syncHarbingerState(state, maximum);
  return consumption.consumed;
}

export const harbingerState = defineProfessionSpecializationState('Harbinger', createHarbingerState);

/** Detach public fields before reconciling Blight so its display cap cannot alter live stacks. */
export function projectHarbingerPlanningState(input: Gw2PlanningStateInput) {
  const state = projectPublicProfessionState(
    flattenProfessionState(input.profession) as unknown as HarbingerState,
    HARBINGER_PUBLIC_STATE_PROJECTION.keys,
    HARBINGER_PUBLIC_STATE_PROJECTION.defaults
  );
  syncHarbingerState(state, harbingerBlightMaximum(input));
  return state;
}
