import { defaultIsSkillAvailable, defineProfessionApp, preferOffhand } from '#gw2/app/create-adapter.js';
import { applyElementalistBuildAttributeRules } from '#gw2/content/professions/elementalist/build/attributes.js';
import { toApplicationBuild } from '#gw2/content/professions/elementalist/build/build.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';

import type { Skill } from '#gw2/platform/engine/types.js';
import type { ProfessionAttributeData, ProfessionSkillAvailabilityContext } from '#gw2/app/types.js';
import type {
  CatalystEmpowermentPool,
  ElementalistApplicationBuild
} from '#gw2/content/professions/elementalist/build/types.js';

// Elemental Empowerment scales these six attributes, and only from the build's own
// sources - buffs applied during the fight must not compound into the bonus.
const CATALYST_EMPOWERMENT_ATTRIBUTES = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  ferocity: 'Ferocity',
  conditionDamage: 'Condition Damage',
  expertise: 'Expertise',
  concentration: 'Concentration'
} satisfies Readonly<Record<keyof CatalystEmpowermentPool, string>>);
const CATALYST_EMPOWERMENT_SOURCES = Object.freeze(['base', 'gear', 'runes', 'infusions', 'food'] as const);

// Sums each scaled attribute across the build-time sources into the pool the Catalyst
// module reads out of the run config.
function catalystEmpowermentPool(attributeData: ProfessionAttributeData): CatalystEmpowermentPool {
  return Object.fromEntries(
    Object.entries(CATALYST_EMPOWERMENT_ATTRIBUTES).map(([key, name]) => {
      const attribute = attributeData.attributes[name] || {};
      return [key, CATALYST_EMPOWERMENT_SOURCES.reduce((total, source) => total + Number(attribute[source] || 0), 0)];
    })
  ) as unknown as CatalystEmpowermentPool;
}

function build(app: { build: unknown }): ElementalistApplicationBuild {
  return app.build as ElementalistApplicationBuild;
}

// Dual-attunement weapon skills share the catalog with the single-attunement ones, so
// hide them from every non-Weaver build before applying the shared availability rules.
function isElementalistSkillAvailable(skill: Skill, context: ProfessionSkillAvailabilityContext = {}): boolean {
  if (skill.type === 'Weapon' && String(skill.attunement || '').includes('+') && context.specialization !== 'Weaver') {
    return false;
  }

  return defaultIsSkillAvailable(skill, context);
}

/**
 * The Elementalist's entry point into the browser application: pairs the profession
 * definition with its attribute rules, build adapters, and the per-run config extras
 * that carry the build's starting resources into the simulation.
 */
// Exposes Elementalist only through the shared browser application contract.
export const elementalistAppAdapter = defineProfessionApp({
  profession: elementalistProfession,
  applyBuildAttributeRules: applyElementalistBuildAttributeRules,
  toApplicationBuild,
  specializationFallback: 'Fire',
  runtime: {
    buildConfigExtras: (app, { attributeData }) => {
      const catalyst = build(app).specializations?.some((specialization) => specialization.name === 'Catalyst');
      return {
        ...(catalyst
          ? {
              catalystEmpowermentPool: catalystEmpowermentPool(attributeData)
            }
          : {}),
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
