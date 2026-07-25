import {
  WEAPON_DATA,
  createProfessionWeaponData,
  RELIC_NAMES,
} from "../../../platform/gw2/gear-data.js";
import {
  renderResults,
  renderRotationBuilder,
} from "../../../app/rotation-ui.js";
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

const professionWeapons = createProfessionWeaponData(
  guardianProfession.catalog,
  { weaponData: WEAPON_DATA },
);

export const guardianAppAdapter = Object.freeze({
  id: guardianProfession.id,
  name: guardianProfession.name,
  profession: guardianProfession,
  storageKey: "gw2-guardian-simulator-v3",
  globalName: "guardianApp",
  filenames: Object.freeze({
    build: "guardian-build.json",
    rotation: "guardian-rotation.json",
    eventLog: "guardian-event-log.csv",
  }),
  resetPrompt: "Reset the Guardian build, skills, and rotation?",
  specializationFallback: "Zeal",
  specializations: guardianProfession.catalog.specializations,
  weaponData: professionWeapons,
  relicNames: RELIC_NAMES,
  createDefaultTargetConditions,
  toApplicationBuild,
  eliteSpecialization,
  recalculate,
  runSimulation,
  modifierContributionRequest,
  calculateModifierContributions,
  renderResults,
  renderRotationBuilder,
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
