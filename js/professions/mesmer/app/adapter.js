import {
  WEAPON_DATA,
} from "../../../platform/gw2/gear-data.js";
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
import {
  renderResults,
  renderRotationBuilder,
} from "./app-rotation-ui.js";

const professionWeapons = Object.freeze(Object.fromEntries(
  [...mesmerProfession.catalog.weapons]
    .filter(name => WEAPON_DATA[name])
    .map(name => [name, WEAPON_DATA[name]]),
));

export const mesmerAppAdapter = Object.freeze({
  id: mesmerProfession.id,
  name: mesmerProfession.name,
  profession: mesmerProfession,
  storageKey: "gw2-mesmer-simulator-v2",
  globalName: "mesmerApp",
  filenames: Object.freeze({
    build: "mesmer-build.json",
    rotation: "mesmer-rotation.json",
    eventLog: "mesmer-event-log.csv",
  }),
  resetPrompt: "Reset the Mesmer build, skills, and rotation?",
  specializationFallback: "Domination",
  specializations: mesmerProfession.catalog.specializations,
  weaponData: professionWeapons,
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
    return !skill.ambush || specialization === "Mirage";
  },
  defaultOffhand() {
    return "Sword";
  },
});

export default mesmerAppAdapter;
