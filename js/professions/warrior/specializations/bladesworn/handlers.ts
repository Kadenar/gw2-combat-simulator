import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { bladeswornState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSkill,
} from "../../types.js";

function enterGunsaber(context: WarriorCastContext): void {
  bladeswornState.from(context).gunsaberActive = true;
}

function exitGunsaber(context: WarriorCastContext): void {
  bladeswornState.from(context).gunsaberActive = false;
}

function enterDragonTrigger(context: WarriorCastContext): void {
  const state = bladeswornState.from(context);
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = context.effectiveEnd;
  state.flowUpdatedAt = context.effectiveEnd;
  state.dragonCharges = 0;
}

function useDragonSlash(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  const maximumCharges = hasTrait(context, TRAIT.DARING_DRAGON) ? 5 : 10;
  const charges = Math.max(1, Math.min(maximumCharges, state.dragonCharges));
  const coefficient =
    Number(skill.dragonSlashMaximumCoefficient || 17) *
    (charges / maximumCharges);
  context.emit({
    type: "damage",
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: "Warrior",
    actorType: "player",
    coefficient,
    skillWeapon: "Gunsaber",
  });
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonCharges = 0;
}

export const bladeswornSkillHandlers = Object.freeze({
  "warrior.gunsaber-enter": augmentSkillHandler(enterGunsaber),
  "warrior.gunsaber-exit": augmentSkillHandler(exitGunsaber),
  "warrior.dragon-trigger": augmentSkillHandler(enterDragonTrigger),
  "warrior.dragon-slash": replaceSkillHandler(useDragonSlash),
});

export function advanceBladesworn(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = bladeswornState.from(context);
  if (target <= state.flowUpdatedAt) return;
  if (!state.dragonTriggerActive) {
    state.flow = Math.min(
      state.maximumFlow,
      state.flow + (target - state.flowUpdatedAt),
    );
    state.flowUpdatedAt = target;
    return;
  }
  const maximumCharges = hasTrait(context, TRAIT.DARING_DRAGON) ? 5 : 10;
  while (
    state.flowUpdatedAt + 0.5 <= target &&
    state.flow >= 10 &&
    state.dragonCharges < maximumCharges
  ) {
    state.flow -= 10;
    state.dragonCharges += 1;
    state.flowUpdatedAt += 0.5;
  }
  state.flowUpdatedAt = target;
}

export function applyBladeswornCastState(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  if (Number(skill.flowGain || 0) > 0) {
    state.flow = Math.min(
      state.maximumFlow,
      state.flow + Number(skill.flowGain),
    );
  }
  if (Number(skill.ammo || 0) > 0 && hasTrait(context, TRAIT.FIERCE_AS_FIRE)) {
    state.fierceAsFireExpiries.push(context.effectiveEnd + 10);
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.slice(-10);
  }
  if (
    hasTrait(context, TRAIT.GUNS_AND_GLORY) &&
    (skill.effects || []).some((effect) =>
      /explosion/i.test(String(effect.name || "")),
    )
  ) {
    state.gunsAndGloryUntil = context.effectiveEnd + 10;
  }
}

export const bladeswornSchedulerHooks = Object.freeze({
  advance: { id: "warrior.flow", order: 20, handler: advanceBladesworn },
  afterCast: {
    id: "warrior.bladesworn-state",
    order: 20,
    handler: applyBladeswornCastState,
  },
});
