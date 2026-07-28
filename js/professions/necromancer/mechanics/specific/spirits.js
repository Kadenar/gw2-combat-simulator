/**
 * Ritualist spirit handlers.
 *
 * Summoning a spirit (Anguish, Wanderlust) records it in `state.activeSpirits`,
 * fires its summon burst, and queues recurring `necromancer.summon-attack`
 * events (materialized in events.js) for the rest of the sim. Essence Blast
 * scales with the number of active spirits; Summon Spirits detonates them.
 * Innervate skills consume/enhance spirits for life force. Soul Twisting arms a
 * pending free recast. Exports `necromancerSpiritSkillHandlers`.
 */
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  emitControl,
  emitCreatureSummonTraits,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
} from "./shared.js";

const SPIRITS = MECHANICS.spirits;

function activePrimaryWeapon(context) {
  return context.state.activeWeaponSet === 2
    ? context.config.weaponSet2Primary || context.config.primaryWeapon || ""
    : context.config.primaryWeapon || "";
}

function queueSpiritAutoattacks(context, skill, spirit, at) {
  if (!(spirit.attackCoefficient > 0)) return;
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  for (
    let attackAt = at + MECHANICS.spiritAttackInterval;
    attackAt <= horizon;
    attackAt += MECHANICS.spiritAttackInterval
  ) {
    context.emit({
      type: "necromancer.summon-attack",
      at: attackAt,
      source: "Spirit",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: `${skill.name} — Spirit Attack`,
      name: `${skill.name} — Spirit Attack`,
      coefficient: spirit.attackCoefficient,
      requiresSpirit: spirit.key,
      summonKind: "spirit",
    });
  }
}

function ritualist(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.ESSENCE_BLAST) {
    const spirits = Object.keys(state.activeSpirits).length;
    const essence = MECHANICS.essenceBlast;
    emitDamage(
      context,
      skill,
      essence.coefficient * (1 + spirits * essence.coefficientPerSpirit),
      {
        skillWeapon: activePrimaryWeapon(context),
        metadata: { activeSpirits: spirits },
      },
    );
    return true;
  }
  if (skill.id === ID.SUMMON_SPIRITS) {
    for (const key of Object.keys(state.activeSpirits)) {
      const coefficient = Object.values(SPIRITS)
        .find(definition => definition.key === key)
        ?.activeCoefficient || 0;
      if (coefficient > 0) {
        emitDamage(context, skill, coefficient, {
          source: "Spirit",
          sourceId: `ritualist.${key}`,
          actorType: "summon",
          skillWeapon: "Hammer",
          metadata: { summonKind: "spirit" },
        });
      }
    }
    return true;
  }

  const spirit = SPIRITS[skill.id];
  if (!spirit) return false;
  state.activeSpirits[spirit.key] = true;
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    state.pendingSoulTwistSkill = skill.id;
  }
  emitState(context, at, "spirit-summoned");
  emitCreatureSummonTraits(context, skill, at);

  if (skill.id === ID.ANGUISH) {
    emitDamage(context, skill, spirit.summonCoefficient, {
      hits: spirit.summonHits,
      interval: spirit.summonInterval,
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
    const painfulBond = MECHANICS.painfulBond;
    for (let index = 1; index <= painfulBond.hits; index += 1) {
      context.emit({
        type: "damage",
        at: at + index * painfulBond.interval,
        source: "Spirit",
        sourceId: "ritualist.painful-bond",
        actorType: "effect",
        skillId: skill.id,
        skillName: skill.name,
        name: "Painful Bond",
        coefficient: 0,
        flatStrikeBase: painfulBond.flatStrikeBase,
        flatStrikePowerCoeff: painfulBond.flatStrikePowerCoeff,
        noCrit: true,
        damageKind: "life-steal",
      });
    }
  } else if (skill.id === ID.WANDERLUST) {
    emitDamage(context, skill, spirit.summonCoefficient);
    emitDamage(context, skill, spirit.lingeringCoefficient, {
      hits: spirit.lingeringHits,
      interval: spirit.lingeringInterval,
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
    emitControl(context, skill, "knockdown");
  }
  queueSpiritAutoattacks(context, skill, spirit, at);
  return true;
}

function innervate(context, skill) {
  const at = context.effectiveEnd;
  if (skill.id === ID.INNERVATE_ANGUISH) {
    emitDamage(context, skill, MECHANICS.innervateAnguish.coefficient, {
      source: "Spirit",
      actorType: "summon",
      metadata: { summonKind: "spirit" },
    });
  } else if (skill.id === ID.INNERVATE_WANDERLUST) {
    emitControl(context, skill, "fear");
  }
  gainNecromancerLifeForce(context, 10, at);
  emitState(context, at, "innervate");
  return true;
}

export const necromancerSpiritSkillHandlers = Object.freeze({
  "necromancer.ritualist": ritualist,
  "necromancer.innervate": innervate,
});
