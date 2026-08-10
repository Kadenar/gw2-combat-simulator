import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import { WARRIOR_SKILL_IDS as ID } from "../data/ids.js";
import { applyWarriorSkillResource } from "./resources.js";
import {
  applyWarriorBurstSpendTraits,
  applyMartialCadenceWeaponSwap,
  applyRecklessDodge,
  grantBerserkersPowerOnFirstHit,
} from "./traits.js";
import type {
  WarriorCastContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../types.js";

function afterResourceSkill(
  context: WarriorCastContext,
  skill: WarriorSkill,
): { spent: number; berserkersPowerGranted: boolean } {
  const spent = applyWarriorSkillResource(context, skill);
  applyWarriorBurstSpendTraits(context, skill, spent);
  return { spent, berserkersPowerGranted: false };
}

function adjustResourceSkillEffect(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  handlerState: unknown,
): void {
  const state = handlerState as {
    spent: number;
    berserkersPowerGranted: boolean;
  };
  const spent = Number(state?.spent || 0);
  if (
    !state.berserkersPowerGranted &&
    grantBerserkersPowerOnFirstHit(context, skill, event, spent)
  ) {
    state.berserkersPowerGranted = true;
  }
  if (
    skill.id === ID.BLOODTHIRSTER &&
    event.type === "condition" &&
    event.condition === "Bleeding"
  ) {
    const tier = spent >= 30 ? 3 : spent >= 20 ? 2 : 1;
    context.replaceEvent(event, { stacks: tier * 3 });
  }
  if (
    skill.id !== ID.EVISCERATE ||
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  context.replaceEvent(event, {
    coefficient: spent >= 30 ? 3 : spent >= 20 ? 2.5 : 2,
    name: `Eviscerate — Level ${spent >= 30 ? 3 : spent >= 20 ? 2 : 1} Damage`,
  });
}

function adjustMightyThrowTarget(
  context: WarriorCastContext,
  _skill: WarriorSkill,
  event: WarriorSimulationEvent,
): void {
  if (
    event.name === "Mighty Throw — Shard Damage" &&
    Math.max(1, Number(context.config.target?.count || 1)) === 1
  ) {
    context.replaceEvent(event, {
      coefficient: 0,
      secondaryTargetOnly: true,
    });
  }
}

function adjustFierceBlowDamage(
  context: WarriorCastContext,
  _skill: WarriorSkill,
  event: WarriorSimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0) ||
    !(
      context.config.target?.controlled ||
      context.config.target?.defiant ||
      professionCoreState(context).targetControlledUntil > event.at
    )
  ) {
    return;
  }
  context.replaceEvent(event, {
    coefficient: 2.7,
    name: "Fierce Blow — Damage to Controlled or Defiant Foes",
  });
}

function swapWarriorWeapons(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  applyMartialCadenceWeaponSwap(context, context.effectiveEnd);
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "warrior",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  return true;
}

function consumeDragonRoarAmmo(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const bullets = Math.max(1, Number(context.ammo?.charges || 1));
  const castDuration = Math.max(0, context.effectiveEnd - context.start);
  const firstBulletAt = context.start + (castDuration * 6) / 7;
  const bulletInterval = (castDuration * 2) / 7;
  if (context.state.profession.specialization.kind === "Bladesworn") {
    const state = context.state.profession.specialization.state;
    state.ammoRoundsSpentByActivation[context.reservationId] = bullets;
    state.ammoStartedFullByActivation[context.reservationId] =
      bullets >= Number(context.ammo?.maximum || skill.ammo || 0);
  }
  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt:
      context.rechargeStart +
      Math.max(context.rechargeDuration, context.ammoLockoutDuration),
  });
  for (let hitIndex = 1; hitIndex <= bullets; hitIndex += 1) {
    context.emit({
      type: "damage",
      at: firstBulletAt + (hitIndex - 1) * bulletInterval,
      source: "Warrior",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Dragon's Roar — Damage per Bullet",
      coefficient: 0.75,
      hits: 1,
      hitIndex,
      totalHits: bullets,
      skillWeapon: "Pistol",
      damageKind: "explosion",
    });
  }
}

function performWarriorDodge(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const state = professionCoreState(context);
  state.endurance = Math.max(0, state.endurance - 50);
  state.enduranceUpdatedAt = context.start;
  applyRecklessDodge(context, skill);
  return true;
}

export const warriorCoreSkillHandlers = Object.freeze({
  "warrior.resource": augmentSkillHandler(afterResourceSkill, {
    afterEffect: adjustResourceSkillEffect,
  }),
  "warrior.mighty-throw": augmentSkillHandler(null, {
    afterEffect: adjustMightyThrowTarget,
  }),
  "warrior.fierce-blow": augmentSkillHandler(null, {
    afterEffect: adjustFierceBlowDamage,
  }),
  "warrior.weapon-swap": replaceSkillHandler(swapWarriorWeapons),
  "warrior.gunstinger": augmentSkillHandler(null),
  "warrior.dragons-roar": replaceSkillHandler(consumeDragonRoarAmmo),
  "warrior.dodge": replaceSkillHandler(performWarriorDodge),
});
