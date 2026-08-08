import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  applyWarriorSkillResource,
  gainWarriorAdrenaline,
} from "../../core/resources.js";
import { paragonState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSkill,
} from "../../types.js";

function gainMotivation(
  context: WarriorSchedulerContext,
  amount: number,
): void {
  const state = paragonState.from(context);
  state.motivation = Math.min(
    state.maximumMotivation,
    state.motivation + Math.max(0, amount),
  );
}

function activateChant(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const state = paragonState.from(context);
  state.activeRefrain = skill.name;
  state.nextRefrainAt = context.effectiveEnd + 3;
  gainMotivation(context, hasTrait(context, TRAIT.ENDURING_REFRAIN) ? 3 : 2);
}

export const paragonSkillHandlers = Object.freeze({
  "warrior.chant": augmentSkillHandler(activateChant),
});

export function advanceParagon(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = paragonState.from(context);
  while (
    state.activeRefrain &&
    state.motivation > 0 &&
    state.nextRefrainAt <= target
  ) {
    state.motivation -= 1;
    state.nextRefrainAt += 3;
  }
  if (state.motivation <= 0) {
    state.motivation = 0;
    state.activeRefrain = "";
    state.nextRefrainAt = 0;
  }
}

export function updateParagonCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = paragonState.from(context);
  if (
    skill.burst &&
    skill.handlerId !== "warrior.chant" &&
    state.activeRefrain
  ) {
    gainMotivation(context, 1);
  }
  if (skill.id === -3 && hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS)) {
    gainWarriorAdrenaline(context, 5);
    if (state.activeRefrain) gainMotivation(context, 1);
  }
}

export const paragonSchedulerHooks = Object.freeze({
  advance: {
    id: "warrior.paragon-refrain",
    order: 20,
    handler: advanceParagon,
  },
  afterCast: {
    id: "warrior.paragon-motivation",
    order: 20,
    handler: updateParagonCast,
  },
});
