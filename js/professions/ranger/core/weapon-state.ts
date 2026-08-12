import { professionCoreState } from "../../../platform/engine/profession.js";
import type { RangerCastContext, RangerSkill } from "../types.js";

export function updateRangerWeaponState(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;

  const state = professionCoreState(context);
  const chain =
    typeof skill.id === "number"
      ? context.catalog.autoattackChainPositions.get(skill.id)
      : undefined;
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
}
