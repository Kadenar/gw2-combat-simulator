/**
 * Application-facing composition facade for module-owned Necromancer skill
 * mechanics. Source declarations live in Core and specialization skills.ts.
 */
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS,
  NECROMANCER_CORE_QUICKNESS_CAST_TIMES_MS,
} from "../core/skills.js";
import {
  HARBINGER_BASE_SKILL_MECHANICS,
  HARBINGER_QUICKNESS_CAST_TIMES_MS,
} from "../specializations/harbinger/skills.js";
import {
  REAPER_BASE_SKILL_MECHANICS,
  REAPER_QUICKNESS_CAST_TIMES_MS,
} from "../specializations/reaper/skills.js";
import {
  RITUALIST_BASE_SKILL_MECHANICS,
  RITUALIST_QUICKNESS_CAST_TIMES_MS,
} from "../specializations/ritualist/skills.js";
import {
  SCOURGE_BASE_SKILL_MECHANICS,
  SCOURGE_QUICKNESS_CAST_TIMES_MS,
} from "../specializations/scourge/skills.js";
import type { Skill, SkillFragment } from "../../../platform/engine/types.js";

const NECROMANCER_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  ...NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  ...REAPER_BASE_SKILL_MECHANICS,
  ...SCOURGE_BASE_SKILL_MECHANICS,
  ...HARBINGER_BASE_SKILL_MECHANICS,
  ...RITUALIST_BASE_SKILL_MECHANICS,
});

/**
 * In-game cast durations measured with Quickness active. The individual
 * measurements are owned beside their module's base skill declaration.
 */
export const NECROMANCER_QUICKNESS_CAST_TIMES_MS: Readonly<
  Record<string, number>
> = Object.freeze({
  ...NECROMANCER_CORE_QUICKNESS_CAST_TIMES_MS,
  ...REAPER_QUICKNESS_CAST_TIMES_MS,
  ...SCOURGE_QUICKNESS_CAST_TIMES_MS,
  ...HARBINGER_QUICKNESS_CAST_TIMES_MS,
  ...RITUALIST_QUICKNESS_CAST_TIMES_MS,
});

function normalizeSkillMechanics(
  mechanicsById: Readonly<Record<number, SkillFragment>>,
  quicknessCastTimesById: Readonly<Record<string, number>>,
): Readonly<Record<string, SkillFragment>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(mechanicsById).map(([skillId, mechanics]) => {
        const quicknessCastTimeMs = quicknessCastTimesById[skillId];
        const shroudSkillWeapon = ["death", "reaper", "harbinger"].includes(
          String(mechanics.shroud || ""),
        )
          ? "Hammer"
          : null;
        if (quicknessCastTimeMs == null && !shroudSkillWeapon) {
          return [skillId, mechanics];
        }
        return [
          skillId,
          Object.freeze({
            ...mechanics,
            ...(shroudSkillWeapon ? { skillWeapon: shroudSkillWeapon } : {}),
            ...(quicknessCastTimeMs == null
              ? {}
              : {
                  castTimeMs: quicknessCastTimeMs * 1.5,
                  quicknessCastTimeMs,
                }),
          }),
        ];
      }),
    ),
  );
}

export const NECROMANCER_SKILL_MECHANICS = normalizeSkillMechanics(
  NECROMANCER_BASE_SKILL_MECHANICS,
  NECROMANCER_QUICKNESS_CAST_TIMES_MS,
);

export const NECROMANCER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(NECROMANCER_SKILL_MECHANICS).map(Number),
);

export const NECROMANCER_EXTRA_SKILLS: readonly Skill[] =
  NECROMANCER_CORE_EXTRA_SKILLS;
