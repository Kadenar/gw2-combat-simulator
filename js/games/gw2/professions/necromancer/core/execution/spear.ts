/**
 * Owns Necromancer spear Soul Shard generation, consumption, and conditional cast behavior.
 * Spear skill fragments remain in `skills/weapons/spear.ts`; `index.ts` assigns cast phases.
 */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillCondition, emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import {
  addSoulShards,
  consumeSoulShards,
  gainNecromancerLifeForce
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

const SOUL_SHARDS_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png';
const PERFORATE_SOUL_SHARD_TASK = 'necromancer.perforate-soul-shard';

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

// Resolves Addle's activation-time shard gate before applying its conditional control, life force, and shard gains.
function addle(context: NecromancerCastContext, skill: NecromancerSkill): void {
  // Immobilize checks the resource at activation, before Addle grants shards.
  const soulShardsAtActivation = Number(professionCoreState(context).soulShards || 0);
  const bonusEffects = Boolean(context.config.target?.defiant || context.config.target?.activatingSkills);
  emitSkillControl(context, skill, {
    at: context.effectiveEnd,
    controlKind: 'daze'
  });
  if (soulShardsAtActivation >= 3) {
    emitSkillCondition(context, skill, {
      at: context.effectiveEnd,
      condition: 'Immobilized',
      stacks: 1,
      duration: 1.5
    });
  }

  if (bonusEffects) gainNecromancerLifeForce(context, 10, context.effectiveEnd, 'addle-bonus');
  addShards(context, skill, bonusEffects ? 4 : 2, 'addle');
}

// Grants Extirpate's shards once, on the first committed damage packet.
function extirpate(context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent): void {
  if (event?.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  addShards(context, skill, 2, 'extirpate', event.at);
}

// Emits one Soul Shard bonus packet for the Perforate strike that consumed it.
function soulShardDamage(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  at: number,
  index: number,
  total: number
): void {
  const profile = balanceProfileFromContext(context, PROFILE.soulShards);
  const strike = balanceProfileEffect(profile, 'strike');
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
    flatStrikeThresholdMultiplier: Number(profile?.damageMultiplier ?? 1),
    noCrit: strike?.noCrit === true,
    damageKind: String(strike?.damageKind || '')
  });
}

// Defers each committed Perforate packet so concurrent shard gains are visible when that individual strike starts.
function afterPerforateEffect(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage') return;
  context.tasks.schedule({
    id: `${context.reservationId}:perforate-soul-shard:${Number(event.hitIndex || 1)}`,
    type: PERFORATE_SOUL_SHARD_TASK,
    at: event.at,
    ownerId: context.reservationId,
    payload: {
      skillId: skill.id,
      hitIndex: Number(event.hitIndex || 1),
      totalHits: Math.min(6, Number(event.totalHits || 1))
    }
  });
}

// Consumes one currently active shard and emits its bonus damage at the matching Perforate strike.
function handlePerforateSoulShard(context: NecromancerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const skill = context.catalog.skillsById.get(Number(task.payload?.skillId)) as NecromancerSkill | undefined;
  if (!skill || consumeSoulShards(professionCoreState(context), 1, task.at) === 0) return;
  soulShardDamage(context, skill, task.at, Number(task.payload?.hitIndex || 1), Number(task.payload?.totalHits || 1));
  emitNecromancerStateSnapshot(context, task.at, 'perforate', {
    dedupeAcrossSourceIds: true
  });
}

// Consumes Distress's flip, refreshes Perforate, and applies the simulator's single-target shard bonus.
function distress(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  delete professionCoreState(context).availableFlips[skill.id];
  context.state.cooldowns.delete(ID.PERFORATE);
  // The simulator models one target, so Distress receives its three additional shards.
  addShards(context, skill, 6, 'distress');
  return true;
}

/** Exposes spear cast hooks by handler ID for root execution composition. */
export const necromancerSpearSkillHandlers = Object.freeze({
  'necromancer.deadly-slice': deadlySlice,
  'necromancer.sinister-stab': sinisterStab,
  'necromancer.addle': addle,
  'necromancer.extirpate': extirpate,
  'necromancer.perforate': afterPerforateEffect,
  'necromancer.distress': distress
});

/** Exposes Perforate's per-strike shard consumption to Core task composition. */
export const necromancerSpearTaskHandlers = Object.freeze({
  [PERFORATE_SOUL_SHARD_TASK]: handlePerforateSoulShard
});
