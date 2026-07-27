import {
  deriveAutoattackChains,
  indexAutoattackChains,
} from "../../../platform/engine/autoattack-chains.js";
import { SKILLS } from "../data/mesmer-api-metadata.js";
import { MESMER_SKILL_IDS as ID } from "../data/ids.js";

export const MESMER_AUTOATTACK_CHAINS = deriveAutoattackChains(SKILLS);

export const MESMER_PRESERVED_WEAPON_CHAIN_ROOT_IDS = Object.freeze([
  ID.ETHER_BOLT,
]);

export function mesmerPreservesAutoattackChain(rootId, skill) {
  return (
    (MESMER_PRESERVED_WEAPON_CHAIN_ROOT_IDS.includes(rootId) &&
      skill.type === "Weapon") ||
    (rootId === ID.LACERATING_CHOP && skill.id === ID.IMAGINARY_AXES)
  );
}

const AUTOATTACK_CHAIN_POSITIONS = indexAutoattackChains(
  MESMER_AUTOATTACK_CHAINS,
);

export function mesmerAutoattackChainPosition(skillId) {
  return AUTOATTACK_CHAIN_POSITIONS.get(Number(skillId));
}
