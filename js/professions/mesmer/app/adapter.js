import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import { mesmerProfession } from "../definition.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

export const mesmerAppAdapter = createGw2AppAdapter({
  profession: mesmerProfession,
  storageKey: "gw2-mesmer-simulator-v2",
  globalName: "mesmerApp",
  filenames: {
    build: "mesmer-build.json",
    rotation: "mesmer-rotation.json",
    eventLog: "mesmer-event-log.csv",
  },
  resetPrompt: "Reset the Mesmer build, skills, and rotation?",
  specializationFallback: "Domination",
  createDefaultTargetConditions,
  toApplicationBuild,
  eliteSpecialization,
  recalculate,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  isSkillAvailable(skill, { specialization } = {}) {
    return !skill.ambush || specialization === "Mirage";
  },
  defaultOffhand() {
    return "Sword";
  },
});
