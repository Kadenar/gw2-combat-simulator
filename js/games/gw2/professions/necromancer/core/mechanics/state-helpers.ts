import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
/**
 * Shared primitives for every necromancer skill handler.
 *
 * Owns Core carapace, Soul Shard, and life-force mutations and their snapshots,
 * plus the module-composed creature-summon reaction dispatcher.
 * Specialization modules own blight and shade state.
 *
 * Handlers depend on this module; it must not depend on them.
 */
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
import { addTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { syncNecromancerResources } from '#gw2/professions/necromancer/core/state.js';
import type {
  NecromancerCastContext,
  NecromancerEmissionContext,
  NecromancerResolverContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';

const SOUL_SHARD_DURATION_SECONDS = 10;
const SOUL_SHARD_MAXIMUM_STACKS = 6;
const CARAPACE_MAXIMUM_STACKS = 30;

/** Returns stable identities for minions eligible to receive shared effects. */
export function necromancerActiveMinionCompanionIds(
  context: NecromancerEmissionContext | NecromancerResolverContext
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
export function necromancerActiveBoonCompanionIds(
  context: NecromancerEmissionContext | NecromancerResolverContext
): readonly string[] {
  const candidate = context as {
    readonly state?: { readonly profession?: unknown };
    readonly profession?: unknown;
  };
  const runtime = (candidate.state?.profession ?? candidate.profession) as {
    readonly specialization?: { readonly state?: { readonly activeSpirits?: Readonly<Record<string, boolean>> } };
  };
  const spiritIds = Object.entries(runtime.specialization?.state?.activeSpirits || {})
    .filter(([, active]) => active)
    .map(([key]) => `spirit:${key}`);
  return Object.freeze([...necromancerActiveMinionCompanionIds(context), ...spiritIds]);
}

/** Expires timed carapace and Soul Shard stacks, then synchronizes their public resource values. */
export function purgeTimedState(state: NecromancerCoreState, at: number): void {
  state.carapaceExpiries = purgeExpiredStacks(state.carapaceExpiries, at);
  expireCharges(state.soulShardGrant, at);
  syncNecromancerResources(state);
}

/** Adds as many timed carapace stacks as the 30-stack cap permits and returns the amount added. */
export function addCarapace(state: NecromancerCoreState, stacks: number, at: number, duration = 10): number {
  purgeTimedState(state, at);
  const grant = addTimedStacks(state.carapaceExpiries, stacks, at, duration, CARAPACE_MAXIMUM_STACKS);
  state.carapaceExpiries = grant.expiries;
  return grant.added;
}

/** Refreshes existing Soul Shards, adds stacks up to six, and returns the amount added. */
export function addSoulShards(state: NecromancerCoreState, stacks: number, at: number): number {
  purgeTimedState(state, at);
  // Refresh the shared deadline even at the cap, adding only the newly admitted shards.
  const added = boundedInteger(stacks, 0, 0, SOUL_SHARD_MAXIMUM_STACKS - state.soulShardGrant.charges);
  state.soulShardGrant = grantCharges(added, at + SOUL_SHARD_DURATION_SECONDS, state.soulShardGrant, at);
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

/** Applies percentage-based life-force gain, including Gluttony and the pool cap, and returns the actual gain. */
export function gainNecromancerLifeForce(
  context: NecromancerSchedulerContext,
  amount: number,
  at: number,
  reason = ''
): number {
  if (!(Number(amount) > 0)) return 0;
  const state = professionCoreState(context);
  const multiplier = hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1;
  const before = state.lifeForce;
  state.lifeForce = Math.min(
    state.maximumLifeForce,
    state.lifeForce + ((Number(amount) * Number(state.maximumLifeForce || 100)) / 100) * multiplier
  );
  syncNecromancerResources(state);
  if (state.lifeForce !== before && reason) {
    emitNecromancerStateSnapshot(context, at, reason, {
      dedupeAcrossSourceIds: true
    });
  }

  return state.lifeForce - before;
}

type CreatureSummonReaction = (
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count: number
) => void;

const creatureSummonReactions = new WeakMap<object, Map<string, CreatureSummonReaction>>();

/**
 * Registers an active module's reaction without making Core depend on that
 * module. Scheduler and cast contexts share the same state object.
 */
export function registerCreatureSummonReaction(
  context: NecromancerSchedulerContext,
  id: string,
  reaction: CreatureSummonReaction
): void {
  let reactions = creatureSummonReactions.get(context.state);
  if (!reactions) {
    reactions = new Map();
    creatureSummonReactions.set(context.state, reactions);
  }

  reactions.set(id, reaction);
}

/** Dispatches a creature summon to every reaction registered for this simulation state. */
export function runCreatureSummonReactions(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count = 1
): void {
  for (const reaction of creatureSummonReactions.get(context.state)?.values() || []) {
    reaction(context, skill, at, count);
  }
}

type CreatureStrikeMultiplier = (context: NecromancerCastContext) => number;

const creatureStrikeMultipliers = new WeakMap<object, Map<string, CreatureStrikeMultiplier>>();

/** Registers specialization-owned multipliers that must be stamped onto Core creature attacks. */
export function registerNecromancerCreatureStrikeMultiplier(
  context: NecromancerSchedulerContext,
  id: string,
  multiplier: CreatureStrikeMultiplier
): void {
  let multipliers = creatureStrikeMultipliers.get(context.state);
  if (!multipliers) {
    multipliers = new Map();
    creatureStrikeMultipliers.set(context.state, multipliers);
  }

  multipliers.set(id, multiplier);
}

/** Multiplies all registered Core and specialization contributions for a creature strike. */
export function necromancerCreatureStrikeMultiplier(context: NecromancerCastContext): number {
  let multiplier = 1;
  for (const contribution of creatureStrikeMultipliers.get(context.state)?.values() || []) {
    // A specialization can explicitly disable creature strikes with a zero multiplier.
    multiplier *= Number(contribution(context) ?? 1);
  }

  return multiplier;
}
