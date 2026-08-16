import {
  defaultIsSkillAvailable,
  defineProfessionApp,
  preferOffhand,
} from "../../../app/profession/define-app.js";
import { applyElementalistBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { elementalistProfession } from "../definition.js";
import type {
  CatalystEmpowermentPool,
  ElementalistApplicationBuild,
} from "../types.js";
import type { Skill } from "../../../platform/engine/types.js";
import type {
  ProfessionAttributeData,
  ProfessionSkillAvailabilityContext,
} from "../../../app/profession/types.js";

const CATALYST_EMPOWERMENT_ATTRIBUTES = Object.freeze({
  power: "Power",
  precision: "Precision",
  ferocity: "Ferocity",
  conditionDamage: "Condition Damage",
  expertise: "Expertise",
  concentration: "Concentration",
} satisfies Readonly<Record<keyof CatalystEmpowermentPool, string>>);
const CATALYST_EMPOWERMENT_SOURCES = Object.freeze([
  "base",
  "gear",
  "runes",
  "infusions",
  "food",
] as const);

function catalystEmpowermentPool(
  attributeData: ProfessionAttributeData,
): CatalystEmpowermentPool {
  return Object.fromEntries(
    Object.entries(CATALYST_EMPOWERMENT_ATTRIBUTES).map(([key, name]) => {
      const attribute = attributeData.attributes[name] || {};
      return [
        key,
        CATALYST_EMPOWERMENT_SOURCES.reduce(
          (total, source) => total + Number(attribute[source] || 0),
          0,
        ),
      ];
    }),
  ) as unknown as CatalystEmpowermentPool;
}

function build(app: { build: unknown }): ElementalistApplicationBuild {
  return app.build as ElementalistApplicationBuild;
}

function isElementalistSkillAvailable(
  skill: Skill,
  context: ProfessionSkillAvailabilityContext = {},
): boolean {
  if (
    skill.type === "Weapon" &&
    String(skill.attunement || "").includes("+") &&
    context.specialization !== "Weaver"
  ) {
    return false;
  }
  return defaultIsSkillAvailable(skill, context);
}

export const elementalistApp = defineProfessionApp({
  profession: elementalistProfession,
  applyBuildAttributeRules: applyElementalistBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Fire",
  runtime: {
    buildConfigExtras: (app) => {
      const catalyst = build(app).specializations?.some(
        (specialization) => specialization.name === "Catalyst",
      );
      return {
        ...(catalyst
          ? {
              catalystEmpowermentPool: catalystEmpowermentPool(
                app.attributeData as ProfessionAttributeData,
              ),
            }
          : {}),
        startAttunement: build(app).startAttunement,
        secondaryAttunement: build(app).secondaryAttunement,
        initialCatalystEnergy: build(app).initialCatalystEnergy,
        evokerElement: build(app).evokerElement,
        initialEvokerCharges: build(app).initialEvokerCharges,
        initialEvokerEmpowered: build(app).initialEvokerEmpowered,
        pistolBullets: build(app).pistolBullets,
      };
    },
  },
  isSkillAvailable: isElementalistSkillAvailable,
  defaultOffhand: preferOffhand("Dagger"),
});

export const {
  appAdapter: elementalistAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = elementalistApp;
