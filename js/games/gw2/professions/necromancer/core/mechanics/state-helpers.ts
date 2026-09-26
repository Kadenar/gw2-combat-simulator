import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import { canonicalTime } from '#kernel/core/clock.js';

/**
 * Shared live Carapace, Soul Shard, and creature-summon operations.
 * Specializations register creature reactions without coupling Core to their mechanics.
 */

import { addTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';

const SOUL_SHARD_DURATION_SECONDS = 10;
const SOUL_SHARD_MAXIMUM_STACKS = 6;
const CARAPACE_MAXIMUM_STACKS = 30;

/** Returns stable identities for minions eligible to receive shared effects. */
export function necromancerActiveMinionCompanionIds(
  context: Pick<NecromancerRuntime, 'profession'>
): readonly string[] {
  const core = professionCoreState(context);
  const companionIds: string[] = [];
  for (const [key, count] of Object.entries(core.activeMinions || {})) {
    for (let index = 0; index < Number(count || 0); index += 1) {
      companionIds.push(`minion:${key}:${index}`);
    }
  }

  return Object.freeze(companionIds);
}

/** Includes every active Necromancer summon that can compete for a shared boon slot. */
export function necromancerActiveBoonCompanionIds(context: Pick<NecromancerRuntime, 'profession'>): readonly string[] {
  const runtime = context.profession;
  const spiritIds = Object.entries(
    runtime.specialization.kind === 'Ritualist' ? runtime.specialization.state.activeSpirits : {}
  )
    .filter(([, active]) => active)
    .map(([key]) => `spirit:${key}`);
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

type CreatureSummonReaction = (
  skill: NecromancerSkill,
  at: number,
  count: number,
  activationId: string | undefined
) => void;

const creatureSummonReactions = new WeakMap<object, Map<string, CreatureSummonReaction>>();

/**
 * Registers an active module's reaction without making Core depend on that
 * module. The caller supplies the simulation owner and actual summon attribution.
 */
export function registerCreatureSummonReaction(owner: object, id: string, reaction: CreatureSummonReaction): void {
  let reactions = creatureSummonReactions.get(owner);
  if (!reactions) {
    reactions = new Map();
    creatureSummonReactions.set(owner, reactions);
  }

  reactions.set(id, reaction);
}

/** Dispatches a creature summon to every reaction registered for this simulation state. */
export function runCreatureSummonReactions(
  owner: object,
  skill: NecromancerSkill,
  at: number,
  count: number,
  activationId: string | undefined
): void {
  for (const reaction of creatureSummonReactions.get(owner)?.values() || []) {
    reaction(skill, at, count, activationId);
  }
}

type CreatureStrikeMultiplier = () => number;

const creatureStrikeMultipliers = new WeakMap<object, Map<string, CreatureStrikeMultiplier>>();

/** Registers specialization-owned multipliers that must be stamped onto Core creature attacks. */
export function registerNecromancerCreatureStrikeMultiplier(
  owner: object,
  id: string,
  multiplier: CreatureStrikeMultiplier
): void {
  let multipliers = creatureStrikeMultipliers.get(owner);
  if (!multipliers) {
    multipliers = new Map();
    creatureStrikeMultipliers.set(owner, multipliers);
  }

  multipliers.set(id, multiplier);
}

/** Multiplies all registered Core and specialization contributions for a creature strike. */
export function necromancerCreatureStrikeMultiplier(owner: object): number {
  let multiplier = 1;
  for (const contribution of creatureStrikeMultipliers.get(owner)?.values() || []) {
    // A specialization can explicitly disable creature strikes with a zero multiplier.
    multiplier *= Number(contribution() ?? 1);
  }

  return multiplier;
}
