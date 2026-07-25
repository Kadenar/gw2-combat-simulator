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
import { necromancerProfession } from "../definition.js";
import {
  calculateModifierContributions,
  eliteSpecialization,
  modifierContributionRequest,
  recalculate,
  runSimulation,
} from "./app-runtime.js";

const professionWeapons = createProfessionWeaponData(
  necromancerProfession.catalog,
  { weaponData: WEAPON_DATA },
);

export const necromancerAppAdapter = Object.freeze({
  id: necromancerProfession.id,
  name: necromancerProfession.name,
  profession: necromancerProfession,
  storageKey: "gw2-necromancer-simulator-v3",
  globalName: "necromancerApp",
  filenames: Object.freeze({
    build: "necromancer-build.json",
    rotation: "necromancer-rotation.json",
    eventLog: "necromancer-event-log.csv",
  }),
  resetPrompt: "Reset the Necromancer build, skills, and rotation?",
  specializationFallback: "Spite",
  specializations: necromancerProfession.catalog.specializations,
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
    return !skill.specialization || skill.specialization === specialization;
  },
  defaultOffhand({ offHands = [] } = {}) {
    return offHands.includes("Dagger") ? "Dagger" : offHands[0] || "";
  },
});

export default necromancerAppAdapter;
