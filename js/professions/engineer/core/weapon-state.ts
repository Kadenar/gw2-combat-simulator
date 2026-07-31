import type {
  EngineerCastContext,
  EngineerSkill,
} from "../types.js";

export function updateEngineerWeaponState(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = context.state.profession;
  const chain = typeof skill.id === "number"
    ? context.catalog.autoattackChainPositions.get(skill.id)
    : undefined;
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
}
