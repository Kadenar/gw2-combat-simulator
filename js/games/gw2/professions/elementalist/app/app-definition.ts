import { defineProfessionApp, preferOffhand } from '#gw2/app/define-profession-app.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import { applyElementalistBuildAttributeRules } from '#gw2/professions/elementalist/build/attributes.js';
import { toApplicationBuild } from '#gw2/professions/elementalist/build/build.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';

import type { ProfessionSkillAvailabilityContext } from '#gw2/app/build/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistCanonicalBuild } from '#gw2/professions/elementalist/build/types.js';

function build(app: { build: unknown }): ElementalistCanonicalBuild {
  return app.build as ElementalistCanonicalBuild;
}

// Dual-attunement weapon skills share the catalog with the single-attunement ones, so
// hide them from every non-Weaver build before applying the shared availability rules.
function isElementalistSkillAvailable(skill: Skill, context: ProfessionSkillAvailabilityContext = {}): boolean {
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
  profession: elementalistProfession,
  applyBuildAttributeRules: applyElementalistBuildAttributeRules,
  toApplicationBuild,
  runtime: {
    buildConfigExtras: (app) => {
      return {
        startAttunement: build(app).startAttunement,
        secondaryAttunement: build(app).secondaryAttunement,
        initialCatalystEnergy: build(app).initialCatalystEnergy,
        evokerElement: build(app).evokerElement,
        initialEvokerCharges: build(app).initialEvokerCharges,
        initialEvokerEmpowered: build(app).initialEvokerEmpowered,
        pistolBullets: build(app).pistolBullets
      };
    }
  },
  isSkillAvailable: isElementalistSkillAvailable,
  defaultOffhand: preferOffhand('Dagger')
});
