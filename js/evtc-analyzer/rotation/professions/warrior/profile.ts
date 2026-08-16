import type { ProfessionProfileSource } from "../../profiles.js";
import { BLADESWORN_BUFF_TRANSITIONS } from "./bladesworn.js";
import { PARAGON_SKILL_ID_ALIASES } from "./paragon.js";

export const warriorProfileSource: ProfessionProfileSource = {
  id: "warrior",
  name: "Warrior",
  specializations: {
    core: "Core",
    berserker: "Berserker",
    spellbreaker: "Spellbreaker",
    bladesworn: "Bladesworn",
    paragon: "Paragon",
  },
  skillIdAliasesBySpecialization: {
    paragon: PARAGON_SKILL_ID_ALIASES,
  },
  buffTransitionsBySpecialization: {
    bladesworn: BLADESWORN_BUFF_TRANSITIONS,
  },
};
