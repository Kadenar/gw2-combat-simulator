import { amalgamState } from "./state.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  applyCondition,
  procState,
  queueDamage,
  recordTrait,
  resolverSkill,
} from "../../core/resolver.js";
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails,
} from "../../types.js";

function isAmalgamSkillHit(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): boolean {
  if (event.actorType === "summon") return false;
  if (event.actorType === "effect") {
    return event.name === "Rapacious Strain";
  }
  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.specialization === "Amalgam" ||
    skill?.categories?.includes("Amalgam") ||
    skill?.categories?.includes("Morph"),
  );
}

function reactToAmalgamDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  details: EngineerResolverReactionDetails = {},
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  if (
    hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) &&
    isAmalgamSkillHit(context, event)
  ) {
    applyCondition(details, context, event, {
      name: "Carbolic Composition",
      condition: "Poisoned",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.CARBOLIC_COMPOSITION,
      actorType: "effect",
    });
  }
  if (
    event.actorType !== "summon" &&
    Number(amalgamState.from(context).rapaciousUntil || 0) > event.at &&
    Number(state.rapacious || 0) <= event.at
  ) {
    state.rapacious = event.at + 0.6;
    queueDamage(context, event, {
      name: "Rapacious Strain",
      coefficient: 0.3,
      sourceId: "engineer.rapacious-strain",
      actorType: "effect",
    });
    recordTrait(
      context,
      "Rapacious Strain",
      event,
      "https://render.guildwars2.com/file/" +
        "5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png",
    );
  }
}

export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage,
});
