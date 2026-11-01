/** Explicit ordered chains owned by Bladesworn warrior; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_BLADESWORN_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST],
  [ID.SHARP_SWIFT_CUT, ID.SHARP_STEEL_DIVIDE, ID.SHARP_EXPLOSIVE_THRUST]
]);
