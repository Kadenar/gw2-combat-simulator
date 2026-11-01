/** Explicit ordered chains owned by Core necromancer; shared catalog assembly derives their metadata. */
import type { AutoattackChains } from '#gw2/platform/skills/catalog.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_CORE_AUTOATTACK_CHAINS: AutoattackChains = Object.freeze([
  [ID.BLOOD_CURSE, ID.RENDING_CURSE, ID.PUTRID_CURSE],
  [ID.NECROTIC_SLASH, ID.NECROTIC_STAB, ID.NECROTIC_BITE],
  [ID.DUSK_STRIKE, ID.FADING_TWILIGHT, ID.CHILLING_SCYTHE],
  [ID.DARK_SLASH, ID.DEADLY_SLICE, ID.SINISTER_STAB],
  [ID.ENERVATION_BLADE, ID.ENERVATION_ECHO, ID.DEATHLY_ENERVATION]
]);
