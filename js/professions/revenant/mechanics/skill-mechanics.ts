/**
 * Application-facing composition facade for module-owned Revenant skill
 * mechanics. Source declarations live in Core and specialization skills.ts.
 */
import { REVENANT_CORE_BASE_SKILL_MECHANICS, REVENANT_CORE_EXTRA_SKILLS } from '../core/skills.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '../specializations/conduit/skills.js';
import { HERALD_BASE_SKILL_MECHANICS } from '../specializations/herald/skills.js';
import { RENEGADE_BASE_SKILL_MECHANICS } from '../specializations/renegade/skills.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '../specializations/vindicator/skills.js';
import type { Skill, SkillFragment } from '../../../platform/engine/types.js';

const fragments = Object.freeze([
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  HERALD_BASE_SKILL_MECHANICS,
  RENEGADE_BASE_SKILL_MECHANICS,
  VINDICATOR_BASE_SKILL_MECHANICS,
  CONDUIT_BASE_SKILL_MECHANICS
]);

function composeSkillMechanics(): Readonly<Record<string, SkillFragment>> {
  const entries: [string, SkillFragment][] = [];
  const owners = new Set<string>();
  for (const fragment of fragments) {
    for (const [skillId, mechanics] of Object.entries(fragment)) {
      if (owners.has(skillId)) {
        throw new TypeError(`Duplicate Revenant skill mechanics ${skillId}.`);
      }
      owners.add(skillId);
      entries.push([skillId, Object.freeze({ ...mechanics })]);
    }
  }
  return Object.freeze(Object.fromEntries(entries));
}

export const REVENANT_SKILL_MECHANICS = composeSkillMechanics();

export const REVENANT_IMPLEMENTED_SKILL_IDS = Object.freeze(Object.keys(REVENANT_SKILL_MECHANICS).map(Number));

export const REVENANT_EXTRA_SKILLS: readonly Skill[] = REVENANT_CORE_EXTRA_SKILLS;
