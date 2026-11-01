/** Explicit ordered chains owned by Core thief; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const THIEF_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.DOUBLE_STRIKE, ID.WILD_STRIKE, ID.LOTUS_STRIKE],
  [ID.SLICE, ID.SLASH, ID.CRIPPLING_STRIKE],
  [ID.STAFF_STRIKE, ID.STAFF_BASH, ID.PUNISHING_STRIKES],
  [ID.SHADOW_BOLT, ID.DOUBLE_BOLT, ID.TRIPLE_BOLT],
  [ID.SPINNING_AXE_ID_71967, ID.SPINNING_AXE]
]);
