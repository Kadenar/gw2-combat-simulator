/** Explicit ordered chains owned by Core ranger; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.SLASH, ID.CRIPPLING_THRUST, ID.PRECISION_SWIPE],
  [ID.SLASH_ID_12474, ID.SLICE, ID.ENDURING_SWING],
  [ID.GROUNDWORK_GOUGE, ID.LEADING_SWIPE, ID.SERPENT_STAB, ID.DEADLY_DELIVERY],
  [ID.HAMMER_STRIKE, ID.HAMMER_SLAM, ID.HEAVY_SMASH],
  [ID.GERMINATE, ID.BURGEON, ID.CULTIVATE],
  [ID.DRAKES_SWIPE, ID.WYVERNS_LASH, ID.CHEETAHS_STRIKE]
]);
