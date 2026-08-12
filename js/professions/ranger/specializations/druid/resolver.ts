import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type {
  RangerResolverContext,
  RangerResolverEvent,
} from "../../types.js";

function triggerBloodMoon(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (!hasTrait(context, TRAIT.BLOOD_MOON)) return;
  enqueueOrdered(context.queue, {
    type: "condition",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.BLOOD_MOON,
    actorType: "effect",
    skillId: TRAIT.BLOOD_MOON,
    skillName: "Blood Moon",
    name: "Blood Moon - Bleeding",
    condition: "Bleeding",
    duration: 4,
    stacks: 2,
    triggeredBy: event.skillName,
  });
}

export function reactToDruidControl(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  triggerBloodMoon(context, event);
}

export function reactToDruidCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
): void {
  if (event.condition === "Immobilized" || event.condition === "Immobile") {
    triggerBloodMoon(context, event);
  }
}
