import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { gw2SchedulerBoonDuration } from '../../../platform/gw2/scheduler/policy.js';
/**
 * Shared primitives for every necromancer skill handler.
 *
 * Three groups of helpers:
 *   - Event emitters (`emitState`, `emitDamage`, `emitCondition`,
 *     `emitControl`, `emitBuff`) that stamp the common necromancer fields onto
 *     canonical events before pushing them through `context.emit`.
 *   - Timed-resource mutators for blight/carapace/shades and life force
 *     (`purgeTimedState`, `addCarapace`, `addSoulShards`,
 *     `consumeSoulShards`, `gainNecromancerLifeForce`),
 *     plus the module-composed creature-summon reaction dispatcher.
 *
 * Handlers depend on this module; it must not depend on them.
 */
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotNecromancerState } from '../state.js';
import { hasNecromancerTrait, syncNecromancerResources } from './state.js';
import type { SimulationActorType, SkillId } from '../../../platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerCoreState,
  NecromancerEmissionContext,
  NecromancerResolverContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '../types.js';

const SOUL_SHARD_DURATION_SECONDS = 10;

interface EmitDamageOptions {
  readonly at?: number;
  readonly hits?: number;
  readonly interval?: number;
  readonly name?: string;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly skillWeapon?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface EmitEventOptions {
  readonly at?: number;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function hasTrait(context: { readonly config: NecromancerConfig }, traitId: SkillId): boolean {
  // Adapt the canonical config IDs to the set-based state helper at the lookup boundary.
  return hasNecromancerTrait(new Set(context.config?.selectedTraitIds || []), traitId);
}

export function emitState(context: NecromancerSchedulerContext, at: number, reason = ''): void {
  emitStateSnapshot(
    context,
    {
      type: 'necromancer.state',
      at,
      source: 'necromancer',
      sourceId: `necromancer.state.${reason || 'update'}`,
      actorType: 'player',
      reason,
      state: snapshotNecromancerState(context.state.profession)
    },
    { dedupeAcrossSourceIds: true }
  );
}

// Emit a normalized Necromancer strike with optional summon ownership, timing,
// weapon, and metadata overrides.
export function emitDamage(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  coefficient: number,
  {
    at = context.effectiveEnd ?? context.state.time,
    hits = 1,
    interval = 0,
    name = skill.name,
    source = 'necromancer',
    sourceId = skill.id,
    actorType = 'player',
    skillWeapon = String(skill.skillWeapon ?? (skill.type === 'Weapon' ? skill.weapon || '' : 'Unequipped')),
    metadata = {}
  }: EmitDamageOptions = {}
): void {
  const perHit = Number(coefficient || 0) / Math.max(1, hits);
  for (let index = 0; index < Math.max(1, hits); index += 1) {
    context.emit({
      type: 'damage',
      at: at + index * interval,
      source,
      sourceId,
      actorType,
      skillId: skill.id,
      skillName: skill.name,
      name,
      coefficient: perHit,
      hits: 1,
      hitIndex: index + 1,
      totalHits: hits,
      skillWeapon,
      canCrit: metadata.canCrit !== false,
      ...metadata
    });
  }
}

export function emitCondition(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  name: string,
  stacks: number,
  duration: number,
  {
    at = context.effectiveEnd ?? context.state.time,
    source = 'necromancer',
    sourceId = skill.id,
    actorType = 'player',
    metadata = {}
  }: EmitEventOptions = {}
): void {
  context.emit({
    type: 'condition',
    at,
    source,
    sourceId,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${name}`,
    condition: name,
    stacks,
    duration,
    ...metadata
  });
}

export function emitControl(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  kind = 'control',
  at = context.effectiveEnd ?? context.state.time,
  duration = 0
): void {
  context.emit({
    type: 'control',
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    controlKind: kind,
    ...(duration > 0 ? { duration } : {})
  });
}

export function emitBuff(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  kind: string,
  duration: number,
  stacks = 1,
  {
    at = context.effectiveEnd ?? context.state.time,
    metadata = {}
  }: {
    readonly at?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  } = {}
): void {
  const adjustedDuration = gw2SchedulerBoonDuration(context, skill, kind, duration);
  context.emit({
    type: 'buff',
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration: adjustedDuration,
    stacks,
    ...metadata
  });
}

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
  if (state.lifeForce !== before && reason) emitState(context, at, reason);
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
