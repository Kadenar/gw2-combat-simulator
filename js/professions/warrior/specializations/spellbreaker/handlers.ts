import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { applyWarriorSkillResource } from "../../core/resources.js";
import { spellbreakerState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";

function fullCounter(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  spellbreakerState.from(context).fullCounterActiveUntil =
    context.effectiveEnd + 1;
}

export const spellbreakerSkillHandlers = Object.freeze({
  "warrior.full-counter": augmentSkillHandler(fullCounter),
});

export function observeSpellbreakerEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (
    event.type !== "control" ||
    event.actorType !== "player" ||
    !hasTrait(context, TRAIT.ATTACKERS_INSIGHT)
  )
    return;
  const state = spellbreakerState.from(context);
  state.attackerInsightExpiries.push(event.at + 15);
  state.attackerInsightExpiries = state.attackerInsightExpiries.slice(-5);
}

export const spellbreakerSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "warrior.attacker-insight",
    order: 20,
    handler: observeSpellbreakerEvent,
  },
});
