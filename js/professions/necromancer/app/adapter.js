import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { necromancerProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const necromancerAppAdapter = createGw2AppAdapter({
  profession: necromancerProfession,
  storageKey: "gw2-necromancer-simulator-v3",
  globalName: "necromancerApp",
  filenames: {
    build: "necromancer-build.json",
    rotation: "necromancer-rotation.json",
    eventLog: "necromancer-event-log.csv",
  },
  resetPrompt: "Reset the Necromancer build, skills, and rotation?",
  specializationFallback: "Spite",
  createDefaultTargetConditions,
  toApplicationBuild,
  eliteSpecialization,
  recalculate,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  isSkillAvailable(skill, { specialization } = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    return !skill.specialization || skill.specialization === specialization;
  },
  defaultOffhand({ offHands = [] } = {}) {
    return offHands.includes("Dagger") ? "Dagger" : offHands[0] || "";
  },
});

export default necromancerAppAdapter;
