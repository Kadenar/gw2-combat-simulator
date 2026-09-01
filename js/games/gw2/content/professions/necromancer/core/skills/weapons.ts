import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/content/professions/necromancer/state.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/timelines.js';
/**
 * Weapon-specific necromancer skill and scheduled-task handlers.
 *
 * Spear attacks build timed Soul Shards, while Perforate consumes them to add
 * life-steal hits and Distress refills the resource and resets Perforate.
 * Nightfall's declarative damage packets schedule their corresponding
 * life-force gains on the simulation clock after the field commits.
 * Exports `necromancerWeaponSkillHandlers` and
 * `necromancerWeaponTaskHandlers`.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import {
  resetAutoattackChains,
  type AutoattackChainTransitionContext
} from '#gw2/platform/skills/autoattack-chains.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import {
  addSoulShards,
  consumeSoulShards,
  gainNecromancerLifeForce
} from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/content/professions/necromancer/types.js';

interface PerforateState {
  readonly at: number;
  readonly shardCount: number;
  readonly interrupted?: boolean;
}

const GRASPING_DARKNESS_LIFE_FORCE_TASK = 'necromancer.grasping-darkness-life-force';
const NIGHTFALL_LIFE_FORCE_TASK = 'necromancer.nightfall-life-force';
const SWORD_AUTOATTACK_EXPIRY_OWNER = 'necromancer.sword-autoattack-chain';
const SWORD_AUTOATTACK_EXPIRY_TASK = 'necromancer.sword-autoattack-chain-expire';
const SWORD_AUTOATTACK_RETENTION_SECONDS = 3;
const SOUL_SHARDS_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png';

// Expires a sword continuation only if no newer transition has replaced the scheduled chain state.
function expireSwordAutoattackChain(context: NecromancerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const root = Number(task.payload?.root);
  const next = Number(task.payload?.next);
  const state = professionCoreState(context);
  if (Number(state.autoattackChains[root]) === next) resetAutoattackChains(context, [root]);
}

/** Keeps the Necromancer sword's three-second continuation window aligned with shared chain transitions. */
export function observeNecromancerAutoattackTransition(transition: AutoattackChainTransitionContext): void {
  const sword = transition.result.transitions.find((change) => Number(change.chainRootId) === ID.ENERVATION_BLADE);
  if (!transition.result.committed || !sword || sword.decision === 'preserve') return;
  const context = transition.cast as unknown as NecromancerCastContext;
  context.tasks.cancelOwner(SWORD_AUTOATTACK_EXPIRY_OWNER);
  if (sword.decision !== 'advance' || sword.nextSkillId == null) return;
  context.tasks.schedule({
    type: SWORD_AUTOATTACK_EXPIRY_TASK,
    at: context.effectiveEnd + SWORD_AUTOATTACK_RETENTION_SECONDS,
    ownerId: SWORD_AUTOATTACK_EXPIRY_OWNER,
    payload: { root: sword.chainRootId, next: sword.nextSkillId }
  });
}

// Updates Soul Shards and records the resource change at the same simulation timestamp.
function addShards(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  stacks: number,
  reason: string,
  at = context.effectiveEnd
): void {
  addSoulShards(professionCoreState(context), stacks, at);
  emitNecromancerStateSnapshot(context, at, reason || `${skill.name}-soul-shards`, { dedupeAcrossSourceIds: true });
}

function deadlySlice(context: NecromancerCastContext, skill: NecromancerSkill): void {
  addShards(context, skill, 1, 'deadly-slice');
}

function sinisterStab(context: NecromancerCastContext, skill: NecromancerSkill): void {
  addShards(context, skill, 1, 'sinister-stab');
}

// Resets Gravedigger only after Chilling Scythe produces a committed damage packet.
function chillingScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.state.cooldowns.delete(ID.GRAVEDIGGER);
}

// Resolves Addle's activation-time shard gate before applying its conditional control, life force, and shard gains.
function addle(context: NecromancerCastContext, skill: NecromancerSkill): void {
  // Immobilize checks the resource at activation, before Addle grants shards.
  const soulShardsAtActivation = Number(professionCoreState(context).soulShards || 0);
  const bonusEffects = Boolean(context.config.target?.defiant || context.config.target?.activatingSkills);
  emitSkillControl(context, skill, {
    at: context.effectiveEnd,
    controlKind: 'daze',
    duration: bonusEffects ? 1.5 : 0.25
  });
  if (soulShardsAtActivation >= 3) {
    emitSkillCondition(context, skill, {
      at: context.effectiveEnd,
      condition: 'Immobilized',
      stacks: 1,
      duration: 1.5
    });
  }

  if (bonusEffects) {
    gainNecromancerLifeForce(context, 10, context.effectiveEnd, 'addle-bonus');
  }

  addShards(context, skill, bonusEffects ? 4 : 2, 'addle');
}

// Grants Extirpate's shards once, on the first committed damage packet.
function extirpate(context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent): void {
  if (event?.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  addShards(context, skill, 2, 'extirpate', event.at);
}

// Scale a spear packet from the captured Soul Shard count while preserving the
// base effect's timing and source metadata.
function soulShardDamage(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  index: number,
  total: number
): void {
  // Resolve profile values at emission time so configured balance patches and traits affect every packet.
  const profile = balanceProfileFromContext(context, PROFILE.soulShards);
  const strike = balanceProfileEffect(profile, 'strike');
  const metadata = strike?.metadata || {};
  // Emit shards as their own effect actor while retaining the triggering skill as parent attribution.
  emitSkillDamage(context, {
    at,
    source: 'necromancer',
    sourceId: ID.SOUL_SHARDS,
    actorType: 'effect',
    skillId: ID.SOUL_SHARDS,
    skillName: 'Soul Shards',
    parentSkillName: skill.name,
    name: 'Soul Shards',
    icon: SOUL_SHARDS_ICON,
    coefficient: 0,
    hits: 1,
    hitIndex: index,
    totalHits: total,
    skillWeapon: 'Unequipped',
    flatStrikeBase: Number(strike?.flatStrikeBase || 0),
    flatStrikePowerCoeff: Number(strike?.flatStrikePowerCoeff || 0),
    flatStrikeMultiplier:
      hasTrait(context, TRAIT.SOUL_BARBS) && context.hasBuff('necromancer-soul-barbs', at) ? 1.1 : 1,
    flatStrikeHealthThreshold: Number(profile?.threshold || 0),
    flatStrikeThresholdMultiplier: Number(profile?.damageMultiplier || 1),
    noCrit: metadata.noCrit === true,
    damageKind: String(metadata.damageKind || '')
  });
}

// Captures and consumes the shards available to a completed Perforate cast for its per-hit follow-up damage.
function preparePerforate(context: NecromancerCastContext): PerforateState {
  const at = context.effectiveEnd;
  if (context.effectiveEnd < context.fullEnd - context.epsilon) {
    return { at, shardCount: 0, interrupted: true };
  }

  const shardCount = consumeSoulShards(professionCoreState(context), 6, at);
  return { at, shardCount };
}

// Consume or grant Soul Shards only after the relevant Perforate packet commits,
// keeping interrupted cast behavior aligned with actual hits.
function afterPerforateEffect(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
  state: unknown
): void {
  const perforateState = state as Partial<PerforateState> | null;
  if (event?.type === 'damage' && Number(event.hitIndex || 1) <= Number(perforateState?.shardCount || 0)) {
    soulShardDamage(context, skill, event.at, Number(event.hitIndex || 1), Number(perforateState?.shardCount || 0));
  }
}

// Publishes the post-consumption shard state once a non-interrupted Perforate finishes resolving.
function completePerforate(context: NecromancerCastContext, _skill: NecromancerSkill, state: unknown): void {
  const perforateState = state as Partial<PerforateState> | null;
  if (perforateState?.interrupted) return;
  emitNecromancerStateSnapshot(context, perforateState?.at ?? context.effectiveEnd, 'perforate', {
    dedupeAcrossSourceIds: true
  });
}

// Consumes Distress's flip, refreshes Perforate, and applies the simulator's single-target shard bonus.
function distress(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  delete professionCoreState(context).availableFlips[skill.id];
  context.state.cooldowns.delete(ID.PERFORATE);
  // The simulator models one target, so Distress always receives its
  // three additional shards for having no other enemies nearby.
  addShards(context, skill, 6, 'distress');
  return true;
}

// Projects an authored base-cast offset onto the active cast duration before testing interruption commitment.
function committedAtBaseOffset(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  baseOffsetMs: number
): boolean {
  const baseCastMs = Number(skill.castTimeMs || 0);
  const commitProgress = baseCastMs > 0 ? Number(baseOffsetMs) / baseCastMs : 1;
  const commitAt = context.start + (context.fullEnd - context.start) * commitProgress;
  return context.effectiveEnd + context.epsilon >= commitAt;
}

// Converts the target's active-condition count into party Might, subject to Oppressive Collapse's seven-condition cap.
function oppressiveCollapse(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const conditionCount = Math.min(
    7,
    Object.values(context.config.target?.conditions || {}).filter((value) => value === true || Number(value) > 0).length
  );
  if (!conditionCount) return;
  emitSkillBuff(context, skill, {
    at: context.effectiveEnd,
    kind: 'might',
    duration: 8,
    stacks: conditionCount * 2,
    metadata: { recipients: 'party', maximumRecipients: 5 }
  });
}

// Tests Grasping Darkness against its authored projectile-release commit point.
function graspingDarknessCommitted(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  return committedAtBaseOffset(context, skill, Number(skill.commitAtMs || 0));
}

// Treats Nightfall as committed once its first runtime-scaled damage packet is due.
function nightfallCommitted(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  if (context.effectiveEnd >= context.fullEnd - context.epsilon) return true;
  const firstPacket = skill.effects?.find((effect) => effect.type === 'strike');
  const authoredOffsetMs = Number(
    firstPacket?.type === 'strike' ? effectFirstAtMs(firstPacket) || skill.castTimeMs || 0 : skill.castTimeMs || 0
  );
  // Nightfall commits at its first runtime packet, so project its stored
  // Quickness-relative offset onto the current cast before checking interruption.
  const runtimeOffsetMs =
    firstPacket?.timingScale === 'cast'
      ? authoredOffsetMs * castRelativeEffectTimingScale(skill, (context.fullEnd - context.start) * 1000)
      : authoredOffsetMs;
  return context.effectiveEnd + context.epsilon >= context.start + runtimeOffsetMs / 1000;
}

// Defers Grasping Darkness life force to a task tied to its committed damage timestamp and reservation.
function afterGraspingDarknessEffect(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.tasks.schedule({
    id: `${context.reservationId}:grasping-darkness-life-force`,
    type: GRASPING_DARKNESS_LIFE_FORCE_TASK,
    at: event.at,
    ownerId: context.reservationId,
    payload: { lifeForceGain: Number(skill.lifeForceOnHit || 0) }
  });
}

// Applies the life-force gain deferred from a committed Grasping Darkness hit.
function handleGraspingDarknessLifeForce(
  context: NecromancerSchedulerContext,
  task: ScheduledTask<SchedulerRecord>
): void {
  gainNecromancerLifeForce(context, Number(task.payload?.lifeForceGain || 0), task.at, 'grasping-darkness-hit');
}

// Schedules one life-force grant for each committed Nightfall pulse without advancing it ahead of damage.
function afterNightfallEffect(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.tasks.schedule({
    id: `${context.reservationId}:nightfall-life-force:` + `${Number(event.hitIndex || 1)}`,
    type: NIGHTFALL_LIFE_FORCE_TASK,
    at: event.at,
    ownerId: context.reservationId,
    payload: { lifeForceGain: Number(skill.lifeForcePerPulse || 0) }
  });
}

// Applies the life-force gain deferred from one committed Nightfall pulse.
function handleNightfallLifeForce(context: NecromancerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  gainNecromancerLifeForce(context, Number(task.payload?.lifeForceGain || 0), task.at, 'nightfall-pulse');
}

/** Groups Core weapon activation hooks by skill handler ID for scheduler registration. */
export const necromancerWeaponSkillHandlers = Object.freeze({
  'necromancer.deadly-slice': deadlySlice,
  'necromancer.sinister-stab': sinisterStab,
  'necromancer.chilling-scythe': chillingScythe,
  'necromancer.addle': addle,
  'necromancer.extirpate': extirpate,
  'necromancer.oppressive-collapse': oppressiveCollapse,
  'necromancer.perforate': Object.freeze({
    prepare: preparePerforate,
    afterEffect: afterPerforateEffect,
    complete: completePerforate
  }),
  'necromancer.distress': distress,
  'necromancer.grasping-darkness': Object.freeze({
    committed: graspingDarknessCommitted,
    afterEffect: afterGraspingDarknessEffect
  }),
  'necromancer.nightfall': Object.freeze({
    committed: nightfallCommitted,
    afterEffect: afterNightfallEffect
  })
});

/** Groups Core weapon task callbacks by scheduled task type. */
export const necromancerWeaponTaskHandlers = Object.freeze({
  [SWORD_AUTOATTACK_EXPIRY_TASK]: expireSwordAutoattackChain,
  [GRASPING_DARKNESS_LIFE_FORCE_TASK]: handleGraspingDarknessLifeForce,
  [NIGHTFALL_LIFE_FORCE_TASK]: handleNightfallLifeForce
});

/** Applies Core greatsword cooldown feedback after the target crosses half health. */
export const necromancerCoreSkillMechanicHandlers = Object.freeze({
  'necromancer.core.reset-gravedigger-below-half': ({
    context,
    at
  }: {
    context: NecromancerSchedulerContext;
    at: number;
  }): void => {
    const schedulerFeedback = context.config._schedulerFeedback as { readonly targetBelowHalfAt?: number } | undefined;
    const targetBelowHalfAt = Number(schedulerFeedback?.targetBelowHalfAt);
    if (Number.isFinite(targetBelowHalfAt) && at > targetBelowHalfAt + context.epsilon) {
      context.state.cooldowns.delete(ID.GRAVEDIGGER);
    }
  }
});
