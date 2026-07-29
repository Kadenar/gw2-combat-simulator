export function updateEngineerWeaponState(context, skill) {
  const state = context.state.profession;
  const chain = context.catalog.autoattackChainPositions.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
}
