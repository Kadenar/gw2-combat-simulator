/**
 * Composes Core Guardian weapon, profession, and slot-skill catalogs.
 * Synthetic actions live in `actions.ts`; runtime behavior lives under `mechanics/`.
 */
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_CORE_EXTRA_SKILLS } from '#gw2/professions/guardian/core/skills/actions.js';
import { GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/profession-skills.js';
import { GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/slot-skills.js';
import { GUARDIAN_CORE_TRAIT_SKILLS } from '#gw2/professions/guardian/core/skills/trait-skills.js';
import { GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/axe.js';
import { GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/focus.js';
import { GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/greatsword.js';
import { GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/hammer.js';
import { GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/longbow.js';
import { GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/mace.js';
import { GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/pistol.js';
import { GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/scepter.js';
import { GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/shield.js';
import { GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/spear.js';
import { GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/staff.js';
import { GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/sword.js';
import { GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/professions/guardian/core/skills/weapons/torch.js';

const GUARDIAN_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS,
  GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS,
  GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS
);

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const GUARDIAN_CORE_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(GUARDIAN_CORE_SKILL_MECHANICS),
  ...GUARDIAN_CORE_EXTRA_SKILLS,
  ...GUARDIAN_CORE_TRAIT_SKILLS
]);
