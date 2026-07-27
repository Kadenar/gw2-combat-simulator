import {
  createGw2AppAdapter,
} from "../../../app/create-app-adapter.js";
import {
  createDefaultTargetConditions,
  toApplicationBuild,
} from "../build.js";
import { necromancerProfession } from "../definition.js";
import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import { getActiveTraits } from "../data/traits-data.js";
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
  isSkillAvailable(skill, { specialization, build } = {}) {
    if (skill.implemented === false || skill.simulatorExcluded) return false;
    const lingeringCurse = getActiveTraits(build?.specializations || [])
      .some(trait => trait.name === "Lingering Curse");
    if (skill.id === ID.FEAST_OF_CORRUPTION) return !lingeringCurse;
    if (skill.id === ID.DEVOURING_DARKNESS) return lingeringCurse;
    // Weaponmaster Training allows elite-specialization weapons on every
    // Necromancer specialization. A weapon skill's specialization identifies
    // its source, not an equip restriction.
    if (skill.type === "Weapon") return true;
    return !skill.specialization || skill.specialization === specialization;
  },
  defaultOffhand({ offHands = [] } = {}) {
    return offHands.includes("Dagger") ? "Dagger" : offHands[0] || "";
  },
});
