import { WEAPON } from '#gw2/platform/constants.js';
import { profession, createBuildContext, toApplicationBuild } from '#gw2/professions/elementalist/build/context.js';
import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';

import type { ProfessionSkillAvailabilityContext } from '#gw2/app/build/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Dual-attunement weapon skills share the catalog with the single-attunement ones, so
// hide them from every non-Weaver build before applying the shared availability rules.
function isElementalistSkillAvailable(skill: Skill, context: ProfessionSkillAvailabilityContext): boolean {
  if (skill.type === 'Weapon' && String(skill.attunement || '').includes('+') && context.specialization !== 'Weaver') {
    return false;
  }

  return true;
}

/**
 * The Elementalist's entry point into the browser application: pairs the profession
 * definition with its attribute rules, build adapters, and the per-run config extras
 * that carry the build's starting resources into the simulation.
 */
// Exposes Elementalist only through the shared browser application contract.
export const elementalistAppAdapter = defineProfessionApp({
  tooltips: elementalistTooltips,
  profession,
  createBuildContext,
  toApplicationBuild,
  isSkillAvailable: isElementalistSkillAvailable,
  defaultOffhand: preferOffhand(WEAPON.DAGGER)
});
