/**
 * Composes the Holosmith sword, Photon Forge, and slot-skill catalogs.
 * Persistent specialization systems remain under `mechanics/`.
 */
import { HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/photon-forge-skills.js';
import { HOLOSMITH_SLOT_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/slot-skills.js';
import { HOLOSMITH_SWORD_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/weapons/sword.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies the composed Holosmith skill catalog without owning family-specific fragments. */
export const HOLOSMITH_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  ...HOLOSMITH_SWORD_SKILL_MECHANICS,
  ...HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS,
  ...HOLOSMITH_SLOT_SKILL_MECHANICS
});
