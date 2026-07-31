import { emitRevenantState } from "./shared.js";
import { REVENANT_CORE_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  RevenantCastContext,
  RevenantSkill,
} from "../types.js";

/** Arms the finite Enchanted Daggers charge/expiry state. */
export function activateEnchantedDaggers(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.enchantedDaggers;
  const at = context.effectiveEnd;
  context.state.profession.enchantedDaggers = {
    charges: profile.charges,
    expiresAt: at + profile.duration,
    readyAt: at,
  };
  context.emit({
    type: "buff",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Enchanted Daggers",
    kind: "enchanted-daggers",
    duration: profile.duration,
    stacks: profile.charges,
  });
  emitRevenantState(context, at, "enchanted-daggers");
}
