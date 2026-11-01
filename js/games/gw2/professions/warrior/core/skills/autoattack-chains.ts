/** Explicit ordered chains owned by Core warrior; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.GREATSWORD_SWING, ID.GREATSWORD_SLICE, ID.BRUTAL_STRIKE],
  [ID.HAMMER_SWING, ID.HAMMER_BASH, ID.HAMMER_SMASH],
  [ID.SEVER_ARTERY, ID.GASH, ID.HAMSTRING],
  [ID.CHOP, ID.DOUBLE_CHOP, ID.TRIPLE_CHOP],
  [ID.MACE_SMASH, ID.MACE_BASH, ID.PULVERIZE],
  [ID.PRECISE_CUT, ID.FOCUSED_SLASH, ID.KEEN_STRIKE],
  [ID.BALANCED_STRIKE, ID.REVERSE_STRIKE, ID.INSPIRING_WHIRL]
]);
