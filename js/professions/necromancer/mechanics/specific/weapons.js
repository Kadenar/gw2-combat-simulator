import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  addSoulShards,
  consumeSoulShards,
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
  hasTrait,
} from "./shared.js";

const NIGHTFALL_LIFE_FORCE_TASK = "necromancer.nightfall-life-force";
const SOUL_SHARDS_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png";

function addShards(context, skill, stacks, reason) {
  const at = context.effectiveEnd;
  addSoulShards(context.state.profession, stacks, at);
  emitState(context, at, reason || `${skill.name}-soul-shards`);
}

function deadlySlice(context, skill) {
  emitDamage(context, skill, 1.4);
  addShards(context, skill, 1, "deadly-slice");
  return true;
}

function sinisterStab(context, skill) {
  emitDamage(context, skill, 1.8);
  context.emit({
    type: "necromancer.chill",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    duration: 2,
  });
  addShards(context, skill, 1, "sinister-stab");
  return true;
}

function addle(context, skill) {
  const defiant = Boolean(context.config?.target?.defiant);
  emitDamage(context, skill, 1.9);
  emitControl(
    context,
    skill,
    "daze",
    context.effectiveEnd,
    defiant ? 1.5 : 0.25,
  );
  emitCondition(context, skill, "Immobilized", 1, 1);
  addShards(context, skill, defiant ? 4 : 2, "addle");
  if (defiant) {
    // The skill's normal 10% is applied from skill metadata after the cast.
    gainNecromancerLifeForce(
      context,
      10,
      context.effectiveEnd,
      "addle-defiant",
    );
  }
  return true;
}

function extirpate(context, skill) {
  emitDamage(context, skill, 3.8);
  emitBuff(context, skill, "might", 8, 5);
  emitCondition(context, skill, "Weakness", 1, 3);
  addShards(context, skill, 2, "extirpate");
  return true;
}

function soulShardDamage(context, skill, at, index, total) {
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
    flatStrikeBase: 1504,
    flatStrikePowerCoeff: 0.1,
    flatStrikeMultiplier: hasTrait(context, TRAIT.SOUL_BARBS)
      && context.hasBuff("necromancer-soul-barbs", at)
      ? 1.1
      : 1,
    flatStrikeHealthThreshold: 0.5,
    flatStrikeThresholdMultiplier: 1.5,
    noCrit: true,
    damageKind: "life-steal",
  });
}

function perforate(context, skill) {
  const at = context.effectiveEnd;
  const shardCount = consumeSoulShards(
    context.state.profession,
    6,
    at,
  );
  for (let index = 1; index <= 7; index += 1) {
    context.emit({
      type: "damage",
      at,
      source: "necromancer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      coefficient: 0.5,
      hits: 1,
      hitIndex: index,
      totalHits: 7,
      skillWeapon: skill.weapon,
      canCrit: true,
      thresholdCoefficients: { 50: 0.6 },
    });
    if (index <= shardCount) {
      soulShardDamage(context, skill, at, index, shardCount);
    }
  }
  emitState(context, at, "perforate");
  return true;
}

function distress(context, skill) {
  const at = context.effectiveEnd;
  delete context.state.profession.availableFlips[skill.id];
  context.state.cooldowns.delete(ID.PERFORATE);
  // The simulator models one target, so Distress always receives its
  // three additional shards for having no other enemies nearby.
  addShards(context, skill, 6, "distress");
  return true;
}

function nightfall(context, skill) {
  const firstAt = context.effectiveEnd;
  for (let index = 0; index < 4; index += 1) {
    const at = firstAt + index;
    emitDamage(context, skill, 1.15, {
      at,
      metadata: {
        hitIndex: index + 1,
        totalHits: 4,
      },
    });
    context.emit({
      type: "blind",
      at,
      source: "necromancer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
    });
    emitCondition(context, skill, "Crippled", 1, 2, { at });
    context.tasks.schedule({
      id: `${context.reservationId}:nightfall-life-force:${index + 1}`,
      type: NIGHTFALL_LIFE_FORCE_TASK,
      at,
      ownerId: context.reservationId,
      payload: {},
    });
  }
  return true;
}

function handleNightfallLifeForce(context, task) {
  gainNecromancerLifeForce(
    context,
    7,
    task.at,
    "nightfall-pulse",
  );
}

export const necromancerWeaponSkillHandlers = Object.freeze({
  "necromancer.deadly-slice": deadlySlice,
  "necromancer.sinister-stab": sinisterStab,
  "necromancer.addle": addle,
  "necromancer.extirpate": extirpate,
  "necromancer.perforate": perforate,
  "necromancer.distress": distress,
  "necromancer.nightfall": nightfall,
});

export const necromancerWeaponTaskHandlers = Object.freeze({
  [NIGHTFALL_LIFE_FORCE_TASK]: handleNightfallLifeForce,
});
