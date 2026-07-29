import { ENGINEER_AUTOATTACK_CHAINS } from "../../catalog.js";
import {
  indexAutoattackChains,
} from "../../../../platform/engine/autoattack-chains.js";

const CHAIN_BY_ID = indexAutoattackChains(ENGINEER_AUTOATTACK_CHAINS);

export function updateEngineerWeaponState(context, skill) {
  const state = context.state.profession;
  const chain = CHAIN_BY_ID.get(skill.id);
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === "Weapon") {
    state.autoattackChains = {};
  }
}
