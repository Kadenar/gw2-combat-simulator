/** Explicit ordered chains owned by Core guardian; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.SWORD_OF_WRATH, ID.SWORD_ARC, ID.SWORD_WAVE],
  [ID.TRUE_STRIKE, ID.PURE_STRIKE, ID.FAITHFUL_STRIKE],
  [ID.BOLT_OF_WRATH, ID.SEARING_LIGHT, ID.SEEKING_JUDGMENT],
  [ID.GREAT_SWORD_STRIKE, ID.GREAT_SWORD_VENGEFUL_STRIKE, ID.GREAT_SWORD_WRATHFUL_STRIKE],
  [ID.HAMMER_SWING, ID.HAMMER_BASH, ID.SYMBOL_OF_PROTECTION],
  [ID.CORE_CLEAVE, ID.BLEEDING_EDGE, ID.SEARING_SLASH]
]);
