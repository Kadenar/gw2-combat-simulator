import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';
import { GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/profession-skills.js';
import { GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/slot-skills.js';
import { GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/axe.js';
import { GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/focus.js';
import { GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/greatsword.js';
import { GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/hammer.js';
import { GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/longbow.js';
import { GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/mace.js';
import { GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/pistol.js';
import { GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/scepter.js';
import { GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/shield.js';
import { GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/spear.js';
import { GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/staff.js';
import { GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/sword.js';
import { GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/content/professions/guardian/core/skills/weapons/torch.js';

export const GUARDIAN_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_STAFF_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_SWORD_SKILL_MECHANICS,
  ...GUARDIAN_WEAPONS_TORCH_SKILL_MECHANICS
});

export const GUARDIAN_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  Object.freeze({
    id: -3,
    name: 'Swap Weapons',
    icon: '',
    type: 'Action',
    slot: 'Action',
    weapon: '',
    specialization: undefined,
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    implemented: true,
    handlerId: 'guardian.weapon-swap',
    effects: []
  })
]);
