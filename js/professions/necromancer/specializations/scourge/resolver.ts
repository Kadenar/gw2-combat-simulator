import { professionCoreState } from "../../../../platform/engine/profession.js";
import { isInternalCooldownReady } from "../../../../platform/engine/clock.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { NECROMANCER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { SCOURGE_MECHANICS as MECHANICS } from "./mechanics.js";
import { applyTraitCondition } from "../../core/traits.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
} from "../../types.js";

function reactToCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (
    event.condition !== "Torment" ||
    !hasTrait(context, TRAIT.DEMONIC_LORE) ||
    !isInternalCooldownReady(
      event.at,
      Number(professionCoreState(context).demonicLoreReadyAt || 0),
    )
  ) {
    return;
  }
  const proc = MECHANICS.traitProcs[TRAIT.DEMONIC_LORE];
  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  professionCoreState(context).demonicLoreReadyAt = event.at + proc.interval;
  applyTraitCondition(details, context, event, proc);
}

export const scourgeResolverEventReactions = Object.freeze({
  condition: reactToCondition,
});
