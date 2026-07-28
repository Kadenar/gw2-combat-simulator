import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { revenantProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const revenantAppAdapter = createGw2AppAdapter({
  profession: revenantProfession,
  storageKey: "gw2-revenant-simulator-v3",
  globalName: "revenantApp",
  filenames: {
    build: "revenant-build.json",
    rotation: "revenant-rotation.json",
    eventLog: "revenant-event-log.csv",
  },
  resetPrompt: "Reset the Revenant build, legends, and rotation?",
  specializationFallback: "Invocation",
  createDefaultTargetConditions,
  toApplicationBuild,
  eliteSpecialization,
  recalculate,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  isSkillAvailable(skill, { specialization } = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    if (skill.type === "Weapon") return true;
    return !skill.specialization || skill.specialization === specialization;
  },
  defaultOffhand({ offHands = [] } = {}) {
    return offHands.includes("Sword") ? "Sword" : offHands[0] || "";
  },
});

