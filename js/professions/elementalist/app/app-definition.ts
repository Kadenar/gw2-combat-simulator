import {
  defaultIsSkillAvailable,
  defineProfessionApp,
  preferOffhand,
} from "../../../app/profession/define-app.js";
import { applyElementalistBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { elementalistProfession } from "../definition.js";
import type { ElementalistApplicationBuild } from "../types.js";
import type { Skill } from "../../../platform/engine/types.js";
import type { ProfessionSkillAvailabilityContext } from "../../../app/profession/types.js";

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
    buildConfigExtras: (app) => ({
      startAttunement: build(app).startAttunement,
      secondaryAttunement: build(app).secondaryAttunement,
      initialCatalystEnergy: build(app).initialCatalystEnergy,
      evokerElement: build(app).evokerElement,
      initialEvokerCharges: build(app).initialEvokerCharges,
      initialEvokerEmpowered: build(app).initialEvokerEmpowered,
    }),
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
