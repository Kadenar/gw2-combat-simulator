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
  addShards(context, skill, 1, "deadly-slice");
}

function sinisterStab(context, skill) {
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
}

function chillingScythe(context, _skill, event) {
  if (event?.type !== "damage") return;
  context.state.cooldowns.delete(ID.GRAVEDIGGER);
}

function addle(context, skill) {
  // Immobilize checks the resource at activation, before Addle grants shards.
  const soulShardsAtActivation = Number(
    context.state.profession.soulShards || 0,
  );
  emitControl(context, skill, "daze", context.effectiveEnd, 0.25);
  if (soulShardsAtActivation >= 3) {
    emitCondition(context, skill, "Immobilized", 1, 1);
  }
  addShards(context, skill, 2, "addle");
}

function extirpate(context, skill) {
  emitBuff(context, skill, "might", 8, 5);
  emitCondition(context, skill, "Weakness", 1, 3);
  addShards(context, skill, 2, "extirpate");
}

function soulShardDamage(context, skill, at, index, total) {
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

function preparePerforate(context) {
  const at = context.effectiveEnd;
  if (context.effectiveEnd < context.fullEnd - context.epsilon) {
    return { at, shardCount: 0, interrupted: true };
  }
  const shardCount = consumeSoulShards(context.state.profession, 6, at);
  return { at, shardCount };
}

function afterPerforateEffect(context, skill, event, state) {
  if (
    event?.type === "damage" &&
    Number(event.hitIndex || 1) <= Number(state?.shardCount || 0)
  ) {
    soulShardDamage(
      context,
      skill,
      event.at,
      Number(event.hitIndex || 1),
      state.shardCount,
    );
  }
}

function completePerforate(context, _skill, state) {
  if (state?.interrupted) return;
  emitState(context, state?.at ?? context.effectiveEnd, "perforate");
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

function nightfallCommitted(context, skill) {
  const firstPacket = skill.effects.find((effect) => effect.type === "strike");
  const baseCastMs = Number(skill.castTimeMs || 0);
  const commitProgress =
    baseCastMs > 0 ? Number(firstPacket?.atMs || baseCastMs) / baseCastMs : 1;
  const commitAt =
    context.start + (context.fullEnd - context.start) * commitProgress;
  return context.effectiveEnd + context.epsilon >= commitAt;
}

function afterNightfallEffect(context, _skill, event) {
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

function handleNightfallLifeForce(context, task) {
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
  "necromancer.perforate": Object.freeze({
    prepare: preparePerforate,
    afterEffect: afterPerforateEffect,
    complete: completePerforate,
  }),
  "necromancer.distress": distress,
  "necromancer.nightfall": Object.freeze({
    committed: nightfallCommitted,
    afterEffect: afterNightfallEffect,
  }),
});

export const necromancerWeaponTaskHandlers = Object.freeze({
  [NIGHTFALL_LIFE_FORCE_TASK]: handleNightfallLifeForce,
});
