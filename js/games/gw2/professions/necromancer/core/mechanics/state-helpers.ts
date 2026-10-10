import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/**
 * Shared live Carapace, Soul Shard, and creature-summon operations.
 * Specializations register creature reactions without coupling Core to their mechanics.
 */

import { addTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const SOUL_SHARD_DURATION_SECONDS = 10;
const SOUL_SHARD_MAXIMUM_STACKS = 6;
const CARAPACE_MAXIMUM_STACKS = 30;

/** Returns stable identities for minions eligible to receive shared effects. */
export function necromancerActiveMinionCompanionIds(
  context: Pick<NecromancerRuntime, 'profession'>
): readonly string[] {
  const core = professionCoreState(context);
  const companionIds: string[] = [];
  for (const [key, count] of Object.entries(core.activeMinions)) {
    for (let index = 0; index < (count || 0); index += 1) {
      companionIds.push(`minion:${key}:${index}`);
    }
  }

  return Object.freeze(companionIds);
}

/** Includes every active Necromancer summon that can compete for a shared boon slot. */
export function necromancerActiveBoonCompanionIds(context: Pick<NecromancerRuntime, 'profession'>): readonly string[] {
  const runtime = context.profession;
  // Presence in the live actor map is the spirit's single source of active membership.
  const spiritIds = Object.keys(
    runtime.specialization.kind === 'Ritualist' ? runtime.specialization.state.activeSpirits : {}
  ).map((key) => `spirit:${key}`);
  return Object.freeze([...necromancerActiveMinionCompanionIds(context), ...spiritIds]);
}

/** Expires timed carapace and Soul Shard stacks, then synchronizes their public resource values. */
export function purgeTimedState(state: NecromancerCoreState, at: number): void {
  state.carapaceExpiries = purgeExpiredStacks(state.carapaceExpiries, at);
  expireCharges(state.soulShardGrant, at);
}

/** Adds timed carapace stacks up to the 30-stack cap. */
export function addCarapace(state: NecromancerCoreState, stacks: number, at: number, duration: number): void {
  purgeTimedState(state, at);
  const grant = addTimedStacks(state.carapaceExpiries, stacks, at, duration, CARAPACE_MAXIMUM_STACKS);
  state.carapaceExpiries = grant.expiries;
}

/** Refreshes existing Soul Shards, adds stacks up to six, and returns the amount added. */
export function addSoulShards(state: NecromancerCoreState, stacks: number, at: number): number {
  purgeTimedState(state, at);
  // Refresh the shared deadline even at the cap, adding only the newly admitted shards.
  const added = boundedInteger(stacks, 0, 0, SOUL_SHARD_MAXIMUM_STACKS - state.soulShardGrant.charges);
  // The stored deadline must equal the queue's canonical timestamp so exact expiry cannot leave floating-point residue.
  state.soulShardGrant = grantCharges(added, canonicalTime(at + SOUL_SHARD_DURATION_SECONDS), state.soulShardGrant, at);
  return added;
}

/** Removes active Soul Shards up to the requested amount and returns the amount consumed. */
export function consumeSoulShards(state: NecromancerCoreState, stacks: number, at: number): number {
  purgeTimedState(state, at);
  const requested = boundedInteger(stacks, 0, 0, state.soulShardGrant.charges);
  let consumed = 0;
  while (consumed < requested && consumeCharge(state.soulShardGrant, at)) consumed += 1;
  return consumed;
}

/** Preserve the existing ordered rewards at the accepted creature-summoned boundary. */
export const creatureSummoned = defineTriggerPoint<{
  readonly skill: NecromancerSkill;
  readonly at: number;
  readonly count: number;
  readonly activationId: string | undefined;
}>('necromancer.creature-summoned', [TRAIT.BOON_OF_CREATION, TRAIT.EXPLOSIVE_GROWTH]);

// One active elite may supply a pure creature value policy; summon reactions use compiled points above.
const creatureStrikeScaling = new WeakMap<NecromancerRuntime, () => number>();
/** Install the selected specialization's scalar query without subscribing a trait reaction. */
export function setNecromancerCreatureStrikeScaling(runtime: NecromancerRuntime, scaling: () => number): void {
  creatureStrikeScaling.set(runtime, scaling);
}

/** Core creatures sample their active specialization's scalar when committing an attack. */
export function necromancerCreatureStrikeMultiplier(runtime: NecromancerRuntime): number {
  return creatureStrikeScaling.get(runtime)?.() ?? 1;
}
