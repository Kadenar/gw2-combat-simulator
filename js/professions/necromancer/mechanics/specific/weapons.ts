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
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  addSoulShards,
  consumeSoulShards,
  emitBuff,
  emitCondition,
  emitControl,
  emitState,
  gainNecromancerLifeForce,
  hasTrait,
  necromancerBoonDuration,
} from "./shared.js";
import type {
  ScheduledTask,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../../types.js";

interface PerforateState {
  readonly at: number;
  readonly shardCount: number;
  readonly interrupted?: boolean;
}

const GRASPING_DARKNESS_LIFE_FORCE_TASK =
  "necromancer.grasping-darkness-life-force";
const NIGHTFALL_LIFE_FORCE_TASK = "necromancer.nightfall-life-force";
const SOUL_SHARDS_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png";

function addShards(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  stacks: number,
  reason: string,
  at = context.effectiveEnd,
): void {
  addSoulShards(context.state.profession, stacks, at);
  emitState(context, at, reason || `${skill.name}-soul-shards`);
}

function deadlySlice(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  addShards(context, skill, 1, "deadly-slice");
}

function sinisterStab(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  addShards(context, skill, 1, "sinister-stab");
}

function chillingScythe(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage") return;
  context.state.cooldowns.delete(ID.GRAVEDIGGER);
}

function addle(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  // Immobilize checks the resource at activation, before Addle grants shards.
  const soulShardsAtActivation = Number(
    context.state.profession.soulShards || 0,
  );
  const bonusEffects = Boolean(
    context.config.target?.defiant
    || context.config.target?.activatingSkills,
  );
  emitControl(
    context,
    skill,
    "daze",
    context.effectiveEnd,
    bonusEffects ? 1.5 : 0.25,
  );
  if (soulShardsAtActivation >= 3) {
    emitCondition(context, skill, "Immobilized", 1, 1.5);
  }
  if (bonusEffects) {
    gainNecromancerLifeForce(
      context,
      10,
      context.effectiveEnd,
      "addle-bonus",
    );
  }
  addShards(context, skill, bonusEffects ? 4 : 2, "addle");
}

function extirpate(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (
    event?.type !== "damage"
    || Number(event.hitIndex || 1) !== 1
  ) return;
  addShards(context, skill, 2, "extirpate", event.at);
}

function soulShardDamage(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  index: number,
  total: number,
): void {
  const profile = MECHANICS.soulShards;
  context.emit({
    type: "damage",
    at,
    source: "necromancer",
    sourceId: ID.SOUL_SHARDS,
    actorType: "effect",
    skillId: ID.SOUL_SHARDS,
    skillName: "Soul Shards",
    parentSkillName: skill.name,
    name: "Soul Shards",
    icon: SOUL_SHARDS_ICON,
    coefficient: 0,
    hits: 1,
    hitIndex: index,
    totalHits: total,
    skillWeapon: "Unequipped",
    flatStrikeBase: profile.flatStrikeBase,
    flatStrikePowerCoeff: profile.flatStrikePowerCoeff,
    flatStrikeMultiplier:
      hasTrait(context, TRAIT.SOUL_BARBS) &&
      context.hasBuff("necromancer-soul-barbs", at)
        ? 1.1
        : 1,
    flatStrikeHealthThreshold: profile.flatStrikeHealthThreshold,
    flatStrikeThresholdMultiplier: profile.flatStrikeThresholdMultiplier,
    noCrit: profile.noCrit,
    damageKind: profile.damageKind,
  });
}

function preparePerforate(
  context: NecromancerCastContext,
): PerforateState {
  const at = context.effectiveEnd;
  if (context.effectiveEnd < context.fullEnd - context.epsilon) {
    return { at, shardCount: 0, interrupted: true };
  }
  const shardCount = consumeSoulShards(context.state.profession, 6, at);
  return { at, shardCount };
}

function afterPerforateEffect(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
  state: unknown,
): void {
  const perforateState = state as Partial<PerforateState> | null;
  if (
    event?.type === "damage" &&
    Number(event.hitIndex || 1) <= Number(perforateState?.shardCount || 0)
  ) {
    soulShardDamage(
      context,
      skill,
      event.at,
      Number(event.hitIndex || 1),
      Number(perforateState?.shardCount || 0),
    );
  }
}

function completePerforate(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  state: unknown,
): void {
  const perforateState = state as Partial<PerforateState> | null;
  if (perforateState?.interrupted) return;
  emitState(
    context,
    perforateState?.at ?? context.effectiveEnd,
    "perforate",
  );
}

function distress(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const at = context.effectiveEnd;
  delete context.state.profession.availableFlips[skill.id];
  context.state.cooldowns.delete(ID.PERFORATE);
  // The simulator models one target, so Distress always receives its
  // three additional shards for having no other enemies nearby.
  addShards(context, skill, 6, "distress");
  return true;
}

function committedAtBaseOffset(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  baseOffsetMs: number,
): boolean {
  const baseCastMs = Number(skill.castTimeMs || 0);
  const commitProgress =
    baseCastMs > 0 ? Number(baseOffsetMs) / baseCastMs : 1;
  const commitAt =
    context.start + (context.fullEnd - context.start) * commitProgress;
  return context.effectiveEnd + context.epsilon >= commitAt;
}

function oppressiveCollapse(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  const conditionCount = Math.min(
    7,
    Object.values(context.config.target?.conditions || {})
      .filter((value) => value === true || Number(value) > 0)
      .length,
  );
  if (!conditionCount) return;
  emitBuff(
    context,
    skill,
    "might",
    necromancerBoonDuration(context, "Might", 8),
    conditionCount * 2,
    { metadata: { affectsSummons: true } },
  );
}

function graspingDarknessCommitted(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  return committedAtBaseOffset(
    context,
    skill,
    MECHANICS.graspingDarkness.baseCommitAtMs,
  );
}

function nightfallCommitted(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const firstPacket = skill.effects?.find(
    (effect) => effect.type === "strike",
  );
  return committedAtBaseOffset(
    context,
    skill,
    Number(firstPacket?.atMs || skill.castTimeMs || 0),
  );
}

function afterGraspingDarknessEffect(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage") return;
  context.tasks.schedule({
    id: `${context.reservationId}:grasping-darkness-life-force`,
    type: GRASPING_DARKNESS_LIFE_FORCE_TASK,
    at: event.at,
    ownerId: context.reservationId,
    payload: {},
  });
}

function handleGraspingDarknessLifeForce(
  context: NecromancerSchedulerContext,
  task: ScheduledTask<SchedulerRecord>,
): void {
  gainNecromancerLifeForce(
    context,
    MECHANICS.graspingDarkness.lifeForceOnHit,
    task.at,
    "grasping-darkness-hit",
  );
}

function afterNightfallEffect(
  context: NecromancerCastContext,
  _skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage") return;
  context.tasks.schedule({
    id:
      `${context.reservationId}:nightfall-life-force:` +
      `${Number(event.hitIndex || 1)}`,
    type: NIGHTFALL_LIFE_FORCE_TASK,
    at: event.at,
    ownerId: context.reservationId,
    payload: {},
  });
}

function handleNightfallLifeForce(
  context: NecromancerSchedulerContext,
  task: ScheduledTask<SchedulerRecord>,
): void {
  gainNecromancerLifeForce(
    context,
    MECHANICS.nightfall.lifeForcePerPulse,
    task.at,
    "nightfall-pulse",
  );
}

export const necromancerWeaponSkillHandlers = Object.freeze({
  "necromancer.deadly-slice": deadlySlice,
  "necromancer.sinister-stab": sinisterStab,
  "necromancer.chilling-scythe": chillingScythe,
  "necromancer.addle": addle,
  "necromancer.extirpate": extirpate,
  "necromancer.oppressive-collapse": oppressiveCollapse,
  "necromancer.perforate": Object.freeze({
    prepare: preparePerforate,
    afterEffect: afterPerforateEffect,
    complete: completePerforate,
  }),
  "necromancer.distress": distress,
  "necromancer.grasping-darkness": Object.freeze({
    committed: graspingDarknessCommitted,
    afterEffect: afterGraspingDarknessEffect,
  }),
  "necromancer.nightfall": Object.freeze({
    committed: nightfallCommitted,
    afterEffect: afterNightfallEffect,
  }),
});

export const necromancerWeaponTaskHandlers = Object.freeze({
  [GRASPING_DARKNESS_LIFE_FORCE_TASK]: handleGraspingDarknessLifeForce,
  [NIGHTFALL_LIFE_FORCE_TASK]: handleNightfallLifeForce,
});
