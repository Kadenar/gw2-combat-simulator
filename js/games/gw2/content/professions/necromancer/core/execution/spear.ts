/**
 * Owns Necromancer spear Soul Shard generation, consumption, and conditional cast behavior.
 * Spear skill fragments remain in `skills/weapons/spear.ts`; `index.ts` assigns cast phases.
 */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillCondition, emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/content/professions/necromancer/state.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import {
  addSoulShards,
  consumeSoulShards,
  gainNecromancerLifeForce
} from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerCastContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/content/professions/necromancer/types.js';

interface PerforateState {
  readonly at: number;
  readonly shardCount: number;
  readonly interrupted?: boolean;
}

const SOUL_SHARDS_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png';

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

  if (bonusEffects) gainNecromancerLifeForce(context, 10, context.effectiveEnd, 'addle-bonus');
  addShards(context, skill, bonusEffects ? 4 : 2, 'addle');
}

// Grants Extirpate's shards once, on the first committed damage packet.
function extirpate(context: NecromancerCastContext, skill: NecromancerSkill, event: NecromancerSimulationEvent): void {
  if (event?.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  addShards(context, skill, 2, 'extirpate', event.at);
}

// Scales a spear packet from the captured Soul Shard count while preserving source metadata.
function soulShardDamage(
  context: NecromancerCastContext,
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
    flatStrikeThresholdMultiplier: Number(profile?.damageMultiplier || 1),
    noCrit: strike?.noCrit === true,
    damageKind: String(strike?.damageKind || '')
  });
}

// Captures and consumes the shards available to a completed Perforate cast for its per-hit follow-up damage.
function preparePerforate(context: NecromancerCastContext): PerforateState {
  const at = context.effectiveEnd;
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return { at, shardCount: 0, interrupted: true };
  return { at, shardCount: consumeSoulShards(professionCoreState(context), 6, at) };
}

// Emits Soul Shard damage only for committed Perforate packets.
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
  'necromancer.perforate': Object.freeze({
    prepare: preparePerforate,
    afterEffect: afterPerforateEffect,
    complete: completePerforate
  }),
  'necromancer.distress': distress
});
