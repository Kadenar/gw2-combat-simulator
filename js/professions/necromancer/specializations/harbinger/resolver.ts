import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { HARBINGER_MECHANICS as MECHANICS } from "./mechanics.js";
import {
  applyTraitCondition,
  applyTraitVulnerability,
} from "../../core/resolver.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
} from "../../types.js";

function reactToDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) return;
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (
    hasTrait(context, TRAIT.DOOM_APPROACHES) &&
    firstHit &&
    skill?.id === ID.TAINTED_BOLTS
  ) {
    applyTraitVulnerability(context, event, {
      name: "Doom Approaches",
      traitId: TRAIT.DOOM_APPROACHES,
      stacks: 2,
      duration: 6,
    });
  }
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION) && skill?.shroudSlot === 2) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.SEPTIC_CORRUPTION],
    );
  }
}

export const harbingerResolverEventReactions = Object.freeze({
  damage: reactToDamage,
});
