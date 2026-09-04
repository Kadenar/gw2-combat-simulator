/**
 * Composes Core Ranger pet, slot, weapon, and simulator-action skill catalogs.
 * Persistent pet and weapon state remain in `core/mechanics/`.
 */
import type { Skill, SkillFragment } from '#gw2/platform/engine/skills/types.js';
import { RANGER_CORE_ACTION_SKILLS } from '#gw2/professions/ranger/core/skills/actions.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { RANGER_CORE_SLOT_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import {
  RANGER_CORE_AXE_EXTRA_SKILLS,
  RANGER_CORE_AXE_SKILL_MECHANICS
} from '#gw2/professions/ranger/core/skills/weapons/axe.js';
import { RANGER_CORE_DAGGER_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { RANGER_CORE_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/greatsword.js';
import { RANGER_CORE_HAMMER_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { RANGER_CORE_LONGBOW_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/longbow.js';
import { RANGER_CORE_MACE_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { RANGER_CORE_SHORTBOW_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import {
  RANGER_CORE_SPEAR_EXTRA_SKILLS,
  RANGER_CORE_SPEAR_SKILL_MECHANICS
} from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { RANGER_CORE_STAFF_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/staff.js';
import { RANGER_CORE_SWORD_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/sword.js';
import { RANGER_CORE_TORCH_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/torch.js';
import { RANGER_CORE_WARHORN_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/weapons/warhorn.js';

export const RANGER_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...RANGER_CORE_PET_SKILL_MECHANICS,
  ...RANGER_CORE_SLOT_SKILL_MECHANICS,
  ...RANGER_CORE_AXE_SKILL_MECHANICS,
  ...RANGER_CORE_DAGGER_SKILL_MECHANICS,
  ...RANGER_CORE_GREATSWORD_SKILL_MECHANICS,
  ...RANGER_CORE_HAMMER_SKILL_MECHANICS,
  ...RANGER_CORE_LONGBOW_SKILL_MECHANICS,
  ...RANGER_CORE_MACE_SKILL_MECHANICS,
  ...RANGER_CORE_SHORTBOW_SKILL_MECHANICS,
  ...RANGER_CORE_SPEAR_SKILL_MECHANICS,
  ...RANGER_CORE_STAFF_SKILL_MECHANICS,
  ...RANGER_CORE_SWORD_SKILL_MECHANICS,
  ...RANGER_CORE_TORCH_SKILL_MECHANICS,
  ...RANGER_CORE_WARHORN_SKILL_MECHANICS
});

/** Preserves the public supplemental-skill order while each family owns its identities. */
export const RANGER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  ...RANGER_CORE_SPEAR_EXTRA_SKILLS,
  ...RANGER_CORE_AXE_EXTRA_SKILLS,
  ...RANGER_CORE_ACTION_SKILLS
]);
