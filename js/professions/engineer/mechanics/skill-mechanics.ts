/**
 * Application-facing composition facade for module-owned Engineer skill
 * mechanics. Raw entries live in Core and specialization skills.ts files.
 */
import { ENGINEER_CORE_SKILL_MECHANICS } from '../core/skills.js';
import { AMALGAM_SKILL_MECHANICS } from '../specializations/amalgam/skills.js';
import { HOLOSMITH_SKILL_MECHANICS } from '../specializations/holosmith/skills.js';
import { MECHANIST_SKILL_MECHANICS } from '../specializations/mechanist/skills.js';
import { SCRAPPER_SKILL_MECHANICS } from '../specializations/scrapper/skills.js';
import type { SkillFragment } from '../../../platform/engine/types.js';

const fragments: readonly Readonly<Record<string, SkillFragment>>[] = Object.freeze([
  ENGINEER_CORE_SKILL_MECHANICS,
  SCRAPPER_SKILL_MECHANICS,
  HOLOSMITH_SKILL_MECHANICS,
  MECHANIST_SKILL_MECHANICS,
  AMALGAM_SKILL_MECHANICS
]);

function mergeMechanicsFragments(): Readonly<Record<string, SkillFragment>> {
  const result: Record<string, SkillFragment> = {};
  for (const fragment of fragments) {
    for (const [skillId, mechanics] of Object.entries(fragment)) {
      if (Object.hasOwn(result, skillId)) {
        throw new TypeError(`Duplicate Engineer skill mechanics id ${skillId}.`);
      }
      result[skillId] = mechanics;
    }
  }
  return Object.freeze(result);
}

export const ENGINEER_SKILL_MECHANICS = mergeMechanicsFragments();

export const ENGINEER_IMPLEMENTED_SKILL_IDS = Object.freeze(Object.keys(ENGINEER_SKILL_MECHANICS).map(Number));

export { ENGINEER_TRIGGERED_MECHANICS } from '../specializations/mechanist/mechanics.js';
