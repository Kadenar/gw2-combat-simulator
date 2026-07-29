// Browser-facing Mesmer composition. It adds attribute calculation, runtime
// config mapping, persistence metadata, and shared-shell adapter behavior to
// the engine contract exported by ../definition.js.

import { defineProfessionApp } from "../../../app/define-profession-app.js";
import { applyMesmerBuildAttributeRules } from "../build-attributes.js";
import { createDefaultTargetConditions, toApplicationBuild } from "../build.js";
import { mesmerProfession } from "../definition.js";
import { mesmerResourceDefinition as getResourceDefinition } from "../ui.js";

export const mesmerApp = defineProfessionApp({
  profession: mesmerProfession,
  applyBuildAttributeRules: applyMesmerBuildAttributeRules,
  createDefaultTargetConditions,
  toApplicationBuild,
  specializationFallback: "Domination",
  storageVersion: 2,
  runtime: {
    buildConfigInputs(app, { specialization, activeTraits }) {
      const startsWithClones =
        getResourceDefinition(specialization).singular === "clone";
      const hasMaliciousSorcery = activeTraits.some(
        (trait) => trait.name === "Malicious Sorcery",
      );
      return {
        initialResource: startsWithClones ? 0 : app.build.initialResource,
        // This trait is resolved at hit time, not as an equipment bonus.
        adjustConditionDurationBonus(name, bonus) {
          return name === "Confusion" && hasMaliciousSorcery
            ? bonus - 25
            : bonus;
        },
      };
    },
    buildConfigExtras() {
      return { weaponmasterTraining: true };
    },
  },
  isSkillAvailable(skill, { specialization } = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    return !skill.ambush || specialization === "Mirage";
  },
  defaultOffhand() {
    return "Sword";
  },
});

export const {
  appAdapter: mesmerAppAdapter,
  calculateAttributes,
  eliteSpecialization,
  recalculate,
  simulationConfig,
  modifierCandidates,
  modifierContributionRequest,
  calculateModifierContributions,
  computeModifierContributions,
  runSimulation,
} = mesmerApp;
