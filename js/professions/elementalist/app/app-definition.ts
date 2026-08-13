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

function assumptions(app: {
  build: unknown;
}): Readonly<Record<string, unknown>> {
  return (build(app).assumptions || {}) as Readonly<Record<string, unknown>>;
}

function explicitlyCastsGlyphOfElementals(
  rotation: readonly unknown[],
): boolean {
  return rotation.some((entry) => {
    if (entry === "Glyph of Elementals") return true;
    if (!entry || typeof entry !== "object") return false;
    const command = entry as Readonly<Record<string, unknown>>;
    if (command.name === "Glyph of Elementals") return true;
    if (command.type !== "cast") return false;
    return (
      elementalistProfession.catalog.skillsById.get(
        command.skillId as string | number,
      )?.name === "Glyph of Elementals"
    );
  });
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
      startingAttunementPreDwelled:
        assumptions(app).startingAttunementPreDwelled !== false,
      elementalSimulationProfile: String(
        assumptions(app).elementalSimulationProfile || "evtc",
      ),
      glyphBoonedElementals: Boolean(assumptions(app).glyphBoonedElementals),
      autoSummonFireElemental: !explicitlyCastsGlyphOfElementals(
        build(app).rotation,
      ),
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
