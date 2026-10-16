import type { Skill } from '#gw2/platform/skills/types.js';
import { CATALYST_AUGMENT_SKILLS } from '#gw2/professions/elementalist/specializations/catalyst/skills/augment-skills.js';
import { CATALYST_JADE_SPHERE_SKILLS } from '#gw2/professions/elementalist/specializations/catalyst/skills/jade-sphere.js';

/** Compose the sphere and augment skill families without duplicating their declarations. */
export const CATALYST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...CATALYST_JADE_SPHERE_SKILLS,
  ...CATALYST_AUGMENT_SKILLS
});
