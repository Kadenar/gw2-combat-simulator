import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import { EPSILON } from '#kernel/core/clock.js';
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

interface PendingLifeForceGain {
  readonly at: number;
  readonly amount: number;
}

interface LifeForceGainTimeline {
  readonly gains: PendingLifeForceGain[];
  cursor: number;
}

// Each scheduler run owns one time-ordered queue of future gains; the resource clock consumes each entry once.
const lifeForceGainTimelines = new WeakMap<object, LifeForceGainTimeline>();

function lifeForceGainTimeline(context: NecromancerSchedulerContext): LifeForceGainTimeline {
  let timeline = lifeForceGainTimelines.get(context.state);
  if (!timeline) {
    timeline = { gains: [], cursor: 0 };
    lifeForceGainTimelines.set(context.state, timeline);
  }

  return timeline;
}

/** Queues a gain for the resource clock, keeping timestamp order among the gains it has not consumed yet. */
export function scheduleNecromancerLifeForceGain(
  context: NecromancerSchedulerContext,
  at: number,
  amount: number
): void {
  if (!(Number(amount) > 0)) return;
  const timeline = lifeForceGainTimeline(context);
  let index = timeline.gains.length;
  // Most gains arrive in order, so scan back from the end; overdue gains stay at the cursor and apply next.
  while (index > timeline.cursor && timeline.gains[index - 1].at > at) index -= 1;
  timeline.gains.splice(index, 0, { at: Number(at), amount: Number(amount) });
}

/** Reports the earliest queued gain so the resource clock can stop and apply it at its own timestamp. */
export function nextNecromancerLifeForceGainAt(context: NecromancerSchedulerContext): number {
  const timeline = lifeForceGainTimelines.get(context.state);
  return timeline?.gains[timeline.cursor]?.at ?? Number.POSITIVE_INFINITY;
}

/** Applies every queued gain due by the resource clock's current boundary, without publishing intermediate state. */
export function applyDueNecromancerLifeForceGains(context: NecromancerSchedulerContext, at: number): void {
  const timeline = lifeForceGainTimelines.get(context.state);
  if (!timeline) return;
  while (timeline.cursor < timeline.gains.length && timeline.gains[timeline.cursor].at <= at + EPSILON) {
    addNecromancerLifeForce(context, timeline.gains[timeline.cursor++].amount);
  }
}

// Percentage gains scale to the current pool, apply Gluttony once, and stop at the cap.
function addNecromancerLifeForce(context: NecromancerSchedulerContext, amount: number): boolean {
  const state = professionCoreState(context);
  const multiplier = hasTrait(context, TRAIT.GLUTTONY)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GLUTTONY), 'lifeForceGainMultiplier')
    : 1;
  const before = state.lifeForce;
  state.lifeForce = Math.min(
    state.maximumLifeForce,
    state.lifeForce + ((Number(amount) * Number(state.maximumLifeForce || 100)) / 100) * multiplier
  );
  syncNecromancerResources(state);
  return state.lifeForce !== before;
}

/**
 * Grants a strike's life force at the strike's timestamp. A strike ahead of the resource clock waits for it, so drain,
 * depletion, and the cap see the gain in order. The clock can already be past the strike because cast completion
 * advances it at cast start; such a gain applies immediately.
 */
export function gainNecromancerLifeForceOnHit(context: NecromancerSchedulerContext, at: number, amount: number): void {
  if (Number(at) > Number(professionCoreState(context).lastResourceAt || 0) + EPSILON) {
    scheduleNecromancerLifeForceGain(context, at, amount);
  } else if (Number(amount) > 0) {
    addNecromancerLifeForce(context, amount);
  }
}

/** Applies percentage-based life-force gain, including Gluttony and the pool cap. */
export function gainNecromancerLifeForce(
  context: NecromancerSchedulerContext,
  amount: number,
  at: number,
  reason = ''
): void {
  if (!(Number(amount) > 0)) return;
  if (addNecromancerLifeForce(context, amount) && reason) {
    emitNecromancerStateSnapshot(context, at, reason, {
      dedupeAcrossSourceIds: true
    });
  }
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
