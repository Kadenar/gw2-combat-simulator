import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { guardianProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const guardianAppAdapter = createGw2AppAdapter({
  profession: guardianProfession,
  storageKey: "gw2-guardian-simulator-v3",
  globalName: "guardianApp",
  filenames: {
    build: "guardian-build.json",
    rotation: "guardian-rotation.json",
    eventLog: "guardian-event-log.csv",
  },
  resetPrompt: "Reset the Guardian build, skills, and rotation?",
  specializationFallback: "Zeal",
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
    return offHands.includes("Focus") ? "Focus" : offHands[0] || "";
  },
});

export default guardianAppAdapter;
