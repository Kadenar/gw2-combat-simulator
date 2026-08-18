import { WARRIOR_CORE_SKILL_MECHANICS } from '../core/skills.js';
import { BERSERKER_SKILL_MECHANICS } from '../specializations/berserker/skills.js';
import { SPELLBREAKER_SKILL_MECHANICS } from '../specializations/spellbreaker/skills.js';
import { BLADESWORN_SKILL_MECHANICS } from '../specializations/bladesworn/skills.js';
import { PARAGON_SKILL_MECHANICS } from '../specializations/paragon/skills.js';
import type { SkillFragment } from '../../../platform/engine/types.js';

export const WARRIOR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...WARRIOR_CORE_SKILL_MECHANICS,
  ...BERSERKER_SKILL_MECHANICS,
  ...SPELLBREAKER_SKILL_MECHANICS,
  ...BLADESWORN_SKILL_MECHANICS,
  ...PARAGON_SKILL_MECHANICS
});

export const WARRIOR_IMPLEMENTED_SKILL_IDS = Object.freeze(Object.keys(WARRIOR_SKILL_MECHANICS).map(Number));
