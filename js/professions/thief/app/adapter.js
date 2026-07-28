import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { thiefProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const thiefAppAdapter = createGw2AppAdapter({
  profession: thiefProfession,
  storageKey: "gw2-thief-simulator-v3",
  globalName: "thiefApp",
  filenames: {
    build: "thief-build.json",
    rotation: "thief-rotation.json",
    eventLog: "thief-event-log.csv",
  },
  resetPrompt: "Reset the Thief build, assumptions, and rotation?",
  specializationFallback: "Trickery",
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
  defaultOffhand({ mainHand, offHands = [] } = {}) {
    if (["Dagger", "Pistol"].includes(mainHand)) {
      return offHands.includes("Pistol") ? "Pistol" : offHands[0] || "";
    }
    return offHands[0] || "";
  },
});
