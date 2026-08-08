import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
  RangerSkill,
} from "../types.js";

function eventSkill(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): RangerSkill | undefined {
  return event.skillId == null
    ? undefined
    : (context.helpers.skillsById?.get(event.skillId) as
        RangerSkill | undefined);
}

function queueBleeding(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  duration: number,
  sourceId: number,
  name: string,
): void {
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: name,
    name: `${name} — Bleeding`,
    condition: "Bleeding",
    duration,
    stacks: 1,
    triggeredBy: event.skillName,
  });
}

export const rangerCoreCriticalReactions = Object.freeze({
  id: "ranger.sharpened-edges",
  order: 20,
  chanceOnCriticalHit: 0.33,
  actorTypes: ["player", "summon"] as const,
  when(context: RangerResolverContext, event: RangerResolverEvent): boolean {
    return (
      hasTrait(context, TRAIT.SHARPENED_EDGES) &&
      (event.actorType === "player" || event.source === "ranger-pet")
    );
  },
  expectedProgress: {
    get(context: RangerResolverContext): number {
      return professionCoreState(context).sharpenedEdgesProgress;
    },
    set(context: RangerResolverContext, value: number): void {
      professionCoreState(context).sharpenedEdgesProgress = value;
    },
  },
  attribution: {
    kind: "trait" as const,
    id: TRAIT.SHARPENED_EDGES,
  },
  handler(context: RangerResolverContext, event: RangerResolverEvent): void {
    queueBleeding(context, event, 3, TRAIT.SHARPENED_EDGES, "Sharpened Edges");
  },
});

export function handleRangerBloodThirst(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  professionCoreState(context).bloodThirstCharges = Math.max(
    0,
    Number(event.charges || 0),
  );
}

export function handleRangerWinterBiteReady(
  context: RangerResolverContext,
  _event: RangerResolverEvent,
): void {
  professionCoreState(context).winterBiteReady = true;
}

export const rangerCoreEventHandlers = Object.freeze({
  "ranger.blood-thirst": handleRangerBloodThirst,
  "ranger.winter-bite-ready": handleRangerWinterBiteReady,
});

export function reactToRangerCoreDamage(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!(Number(event.coefficient) > 0) || event.actorType === "effect") return;
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  if (
    skill?.categories?.includes("Trap") &&
    event.activationId &&
    !state.trapCrippleActivations[event.activationId] &&
    hasTrait(context, TRAIT.TRAPPERS_EXPERTISE)
  ) {
    state.trapCrippleActivations[event.activationId] = true;
    enqueueOrdered(context.queue, {
      type: "condition",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.TRAPPERS_EXPERTISE,
      actorType: "effect",
      skillId: TRAIT.TRAPPERS_EXPERTISE,
      skillName: "Trapper's Expertise",
      name: "Trapper's Expertise — Crippled",
      condition: "Crippled",
      duration: 3,
      stacks: 1,
      fixedDuration: true,
      triggeredBy: event.skillName,
    });
  }
  if (state.bloodThirstCharges > 0 && event.sourceId !== ID.CRIPPLING_SHOT) {
    state.bloodThirstCharges -= 1;
    queueBleeding(context, event, 12, ID.CRIPPLING_SHOT, "Blood Thirst");
  }
  if (
    skill?.id === ID.CONCUSSION_SHOT &&
    hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET) &&
    (context.config?.target?.defiant ||
      context.config?.target?.flanking ||
      context.config?.target?.behind)
  ) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
      actorType: "effect",
      skillId: TRAIT.LIGHT_ON_YOUR_FEET,
      skillName: "Light on your Feet",
      name: "Light on your Feet — Vulnerability",
      kind: "target-vulnerability",
      duration: 1,
      stacks: 10,
      triggeredBy: event.skillName,
    });
  }
}
