import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
/**
 * Shared primitives for every necromancer skill handler.
 *
 * State snapshots and timed-resource mutators for blight/carapace/shades and life force
 *     (`purgeTimedState`, `addCarapace`, `addSoulShards`,
 *     `consumeSoulShards`, `gainNecromancerLifeForce`),
 *     plus the module-composed creature-summon reaction dispatcher.
 *
 * Handlers depend on this module; it must not depend on them.
 */
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotNecromancerState } from '../state.js';
import { syncNecromancerResources } from './state.js';
import type {
  NecromancerCastContext,
  NecromancerCoreState,
  NecromancerEmissionContext,
  NecromancerResolverContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '../types.js';

const SOUL_SHARD_DURATION_SECONDS = 10;

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

export function purgeTimedState(state: NecromancerCoreState, at: number): void {
  state.carapaceExpiries = state.carapaceExpiries.filter((expiresAt: number) => expiresAt > at);
  state.soulShardExpiries = state.soulShardExpiries.filter((expiresAt: number) => expiresAt > at);
  syncNecromancerResources(state);
}

export function addCarapace(state: NecromancerCoreState, stacks: number, at: number, duration = 10): number {
  purgeTimedState(state, at);
  const count = Math.min(Math.max(0, Math.trunc(Number(stacks || 0))), 30 - state.carapaceExpiries.length);
  state.carapaceExpiries.push(...Array.from({ length: count }, () => at + duration));
  return count;
}

export function addSoulShards(state: NecromancerCoreState, stacks: number, at: number): number {
  purgeTimedState(state, at);
  // Every shard shares the newest application's ten-second window so gaining a shard refreshes the stack.
  const expiresAt = at + SOUL_SHARD_DURATION_SECONDS;
  state.soulShardExpiries = state.soulShardExpiries.map(() => expiresAt);
  const count = Math.min(Math.max(0, Math.trunc(Number(stacks || 0))), 6 - state.soulShardExpiries.length);
  state.soulShardExpiries.push(...Array.from({ length: count }, () => expiresAt));
  syncNecromancerResources(state);
  return count;
}

export function consumeSoulShards(state: NecromancerCoreState, stacks: number, at: number): number {
  purgeTimedState(state, at);
  const count = Math.min(Math.max(0, Math.trunc(Number(stacks || 0))), state.soulShardExpiries.length);
  state.soulShardExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

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
    emitStateSnapshot(context, 'necromancer', at, reason, snapshotNecromancerState(context.state.profession), {
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

export function necromancerCreatureStrikeMultiplier(context: NecromancerCastContext): number {
  let multiplier = 1;
  for (const contribution of creatureStrikeMultipliers.get(context.state)?.values() || []) {
    multiplier *= Number(contribution(context) || 1);
  }

  return multiplier;
}
