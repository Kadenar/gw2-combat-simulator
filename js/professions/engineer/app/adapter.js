import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { engineerProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const engineerAppAdapter = createGw2AppAdapter({
  profession: engineerProfession,
  storageKey: "gw2-engineer-simulator-v3",
  globalName: "engineerApp",
  filenames: {
    build: "engineer-build.json",
    rotation: "engineer-rotation.json",
    eventLog: "engineer-event-log.csv",
  },
  resetPrompt: "Reset the Engineer build, skills, and rotation?",
  specializationFallback: "Explosives",
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
    return offHands.includes("Pistol") ? "Pistol" : offHands[0] || "";
  },
});

