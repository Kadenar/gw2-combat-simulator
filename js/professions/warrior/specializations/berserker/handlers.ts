import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { applyWarriorSkillResource } from "../../core/resources.js";
import { berserkerState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSkill,
} from "../../types.js";

function enterBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const state = berserkerState.from(context);
  state.berserkActive = true;
  state.berserkUntil =
    context.effectiveEnd + (hasTrait(context, TRAIT.SMASH_BRAWLER) ? 20 : 15);
}

export const berserkerSkillHandlers = Object.freeze({
  "warrior.berserk": augmentSkillHandler(enterBerserk),
});

export function advanceBerserker(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = berserkerState.from(context);
  if (state.berserkActive && state.berserkUntil <= target) {
    state.berserkActive = false;
    state.berserkUntil = 0;
  }
}

export function extendBerserk(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = berserkerState.from(context);
  if (!state.berserkActive) return;
  if (skill.primalBurst && hasTrait(context, TRAIT.SMASH_BRAWLER))
    state.berserkUntil += 2;
  if (skill.categories?.includes("Rage")) {
    state.berserkUntil += hasTrait(context, TRAIT.LAST_BLAZE) ? 3 : 2;
  }
}

export const berserkerSchedulerHooks = Object.freeze({
  advance: {
    id: "warrior.berserker-advance",
    order: 20,
    handler: advanceBerserker,
  },
  afterCast: {
    id: "warrior.berserker-duration",
    order: 20,
    handler: extendBerserk,
  },
});
