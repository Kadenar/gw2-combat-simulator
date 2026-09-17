/**
 * Composes the Holosmith sword, Photon Forge, and slot-skill catalogs.
 * Persistent specialization systems remain under `mechanics/`.
 */
import { HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/photon-forge-skills.js';
import { HOLOSMITH_SLOT_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import { HOLOSMITH_SWORD_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies the composed Holosmith skill catalog without owning family-specific fragments. */
export const HOLOSMITH_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  ...HOLOSMITH_SWORD_SKILL_MECHANICS,
  ...HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS,
  ...HOLOSMITH_SLOT_SKILL_MECHANICS
});

// Declare both Photon Forge autoattack variants through the catalog contract so
// scheduling and the shared palette projector advance the same chain state.
export const HOLOSMITH_AUTOATTACK_CHAINS = Object.freeze([
  Object.freeze([ID.LIGHT_STRIKE, ID.BRIGHT_SLASH, ID.FLASH_CUTTER]),
  Object.freeze([ID.LIGHT_STRIKE_STORM, ID.BRIGHT_SLASH_STORM, ID.FLASH_CUTTER_STORM])
]);
