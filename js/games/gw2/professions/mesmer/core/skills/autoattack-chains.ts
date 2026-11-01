/** Explicit ordered chains owned by Core mesmer; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_SPIKE],
  [ID.ETHER_BOLT, ID.ETHER_BLAST, ID.ETHER_CLONE],
  [ID.LACERATING_CHOP, ID.ETHEREAL_CHOP, ID.MIRROR_STRIKES],
  [ID.PSYCUT, ID.PSYSTRIKE, ID.MIND_PIERCE]
]);
