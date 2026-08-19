/**
 * Application-facing composition facade for module-owned Necromancer skill
 * mechanics. Source declarations live in Core and specialization skills.ts.
 */
import { NECROMANCER_CORE_BASE_SKILL_MECHANICS, NECROMANCER_CORE_EXTRA_SKILLS } from '../core/skills.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '../specializations/harbinger/skills.js';
import { REAPER_BASE_SKILL_MECHANICS } from '../specializations/reaper/skills.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from '../specializations/ritualist/skills.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from '../specializations/scourge/skills.js';
import type { Skill, SkillFragment } from '../../../platform/engine/types.js';

const NECROMANCER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  ...REAPER_BASE_SKILL_MECHANICS,
  ...SCOURGE_BASE_SKILL_MECHANICS,
  ...HARBINGER_BASE_SKILL_MECHANICS,
  ...RITUALIST_BASE_SKILL_MECHANICS
});

/**
 * Compatibility view derived from the timings declared on each skill.
 */
export const NECROMANCER_QUICKNESS_CAST_TIMES_MS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(NECROMANCER_BASE_SKILL_MECHANICS).flatMap(([skillId, mechanics]) =>
      mechanics.quicknessCastTimeMs == null ? [] : [[skillId, Number(mechanics.quicknessCastTimeMs)]]
    )
  )
);

function applyNecromancerSkillDefaults(
  mechanicsById: Readonly<Record<number, SkillFragment>>
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsById).map(([skillId, mechanics]) => {
        const shroudSkillWeapon = ['death', 'reaper', 'harbinger'].includes(String(mechanics.shroud || ''))
          ? 'Hammer'
          : null;
        if (!shroudSkillWeapon) {
          return [skillId, mechanics];
        }

        return [
          skillId,
          Object.freeze({
            ...mechanics,
            skillWeapon: shroudSkillWeapon
          })
        ];
      })
    )
  );
}

export const NECROMANCER_SKILL_MECHANICS = applyNecromancerSkillDefaults(NECROMANCER_BASE_SKILL_MECHANICS);

export const NECROMANCER_IMPLEMENTED_SKILL_IDS = Object.freeze(Object.keys(NECROMANCER_SKILL_MECHANICS).map(Number));

export const NECROMANCER_EXTRA_SKILLS: readonly Skill[] = NECROMANCER_CORE_EXTRA_SKILLS;
