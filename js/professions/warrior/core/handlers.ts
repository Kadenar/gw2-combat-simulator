import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { applyWarriorSkillResource } from "./resources.js";
import { gainWarriorAdrenaline } from "./resources.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../types.js";

function afterResourceSkill(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const spent = applyWarriorSkillResource(context, skill);
  const state = professionCoreState(context);
  if (skill.burst && spent > 0 && hasTrait(context, TRAIT.BERSERKERS_POWER)) {
    const stacks = Math.max(1, Math.min(3, Math.ceil(spent / 10)));
    state.burstPowerExpiries.push(
      ...Array(stacks).fill(context.effectiveEnd + 10),
    );
    state.burstPowerExpiries = state.burstPowerExpiries.slice(-3);
  }
  if (
    skill.categories?.includes("Signet") &&
    hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    state.signetMasteryExpiries.push(context.effectiveEnd + 20);
    state.signetMasteryExpiries = state.signetMasteryExpiries.slice(-5);
  }
}

function swapWarriorWeapons(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
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

export const warriorCoreSkillHandlers = Object.freeze({
  "warrior.resource": augmentSkillHandler(afterResourceSkill),
  "warrior.weapon-swap": replaceSkillHandler(swapWarriorWeapons),
});

export function observeWarriorEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (event.type === "control" && event.actorType === "player") {
    professionCoreState(context).targetControlledUntil = Math.max(
      professionCoreState(context).targetControlledUntil,
      event.at + Number(event.duration || 1),
    );
  }
  if (
    context.config.specialization === "Bladesworn" ||
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  )
    return;
  context.tasks.schedule({
    type: "warrior.adrenaline-hit",
    at: event.at,
    payload: { amount: 1 },
  });
}

export function updateWarriorCastState(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = professionCoreState(context);
  if (skill.id === -3 && hasTrait(context, TRAIT.VERSATILE_RAGE)) {
    gainWarriorAdrenaline(context, 5);
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
}
