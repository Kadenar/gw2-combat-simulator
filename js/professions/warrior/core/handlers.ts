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
): number {
  const spent = applyWarriorSkillResource(context, skill);
  const state = professionCoreState(context);
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BURST_PRECISION)) {
    state.burstPrecisionDurations[context.reservationId] = spent >= 30 ? 4 : 2;
  }
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BERSERKERS_POWER)) {
    const stacks =
      skill.primalBurst || context.config.specialization === "Spellbreaker"
        ? 2
        : spent >= 30
          ? 4
          : spent >= 20
            ? 3
            : 2;
    grantBerserkersPower(
      context,
      stacks,
      context.effectiveEnd + context.epsilon,
      skill,
    );
  }
  return spent;
}

function adjustResourceSkillEffect(
  context: WarriorCastContext,
  skill: WarriorSkill,
  event: WarriorSimulationEvent,
  handlerState: unknown,
): void {
  const spent = Number(handlerState || 0);
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
      at: context.effectiveEnd,
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
  "warrior.weapon-swap": replaceSkillHandler(swapWarriorWeapons),
  "warrior.gunstinger": augmentSkillHandler(null),
  "warrior.dragons-roar": replaceSkillHandler(consumeDragonRoarAmmo),
  "warrior.dodge": replaceSkillHandler(performWarriorDodge),
});
