import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { applyWarriorSkillResource } from "./resources.js";
import { grantBerserkersPower } from "./traits.js";
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
  const state = professionCoreState(context);
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BURST_PRECISION)) {
    state.burstPrecisionDurations[context.reservationId] = spent >= 30 ? 4 : 2;
  }
  return { spent, berserkersPowerGranted: false };
}

function berserkersPowerStacks(
  context: WarriorCastContext,
  skill: WarriorSkill,
  spent: number,
): number {
  if (
    !skill.burst ||
    spent <= 0 ||
    !hasTrait(context, TRAIT.BERSERKERS_POWER)
  ) {
    return 0;
  }
  return skill.primalBurst || context.config.specialization === "Spellbreaker"
    ? 2
    : spent >= 30
      ? 4
      : spent >= 20
        ? 3
        : 2;
}

function grantBerserkersPowerOnFirstHit(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  handlerState: { spent: number; berserkersPowerGranted: boolean },
): void {
  if (
    handlerState.berserkersPowerGranted ||
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  const stacks = berserkersPowerStacks(context, skill, handlerState.spent);
  if (stacks > 0) {
    handlerState.berserkersPowerGranted = true;
    grantBerserkersPower(context, stacks, event.at + context.epsilon, skill);
  }
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
  grantBerserkersPowerOnFirstHit(context, skill, event, state);
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

function swapWarriorWeapons(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
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
  if (hasTrait(context, TRAIT.RECKLESS_DODGE)) {
    context.emit({
      type: "damage",
      at: context.effectiveEnd,
      source: "Warrior",
      sourceId: TRAIT.RECKLESS_DODGE,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Reckless Dodge",
      coefficient: 1.5,
    });
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.RECKLESS_DODGE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Reckless Dodge — Might",
      kind: "might",
      boon: "might",
      stacks: 2,
      duration: 5,
    });
  }
  return true;
}

export const warriorCoreSkillHandlers = Object.freeze({
  "warrior.resource": augmentSkillHandler(afterResourceSkill, {
    afterEffect: adjustResourceSkillEffect,
  }),
  "warrior.mighty-throw": augmentSkillHandler(null, {
    afterEffect: adjustMightyThrowTarget,
  }),
  "warrior.weapon-swap": replaceSkillHandler(swapWarriorWeapons),
  "warrior.gunstinger": augmentSkillHandler(null),
  "warrior.dragons-roar": replaceSkillHandler(consumeDragonRoarAmmo),
  "warrior.dodge": replaceSkillHandler(performWarriorDodge),
});
