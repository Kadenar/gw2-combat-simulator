/** Explicit ordered chains owned by Reaper necromancer; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_REAPER_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]
]);
