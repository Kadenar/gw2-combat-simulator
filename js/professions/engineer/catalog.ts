import { assembleNativeApplicationCatalog } from "../../platform/gw2/native-profession.js";
import { ENGINEER_GENERATED_SKILL_IDS } from "./catalog-data.js";
import { engineerNativeModules } from "./modules.js";

export { ENGINEER_GENERATED_SKILL_IDS };

export const ENGINEER_ELITE_SPECIALIZATIONS = Object.freeze([
  "Scrapper", "Holosmith", "Mechanist", "Amalgam",
]);

export const engineerCatalog = assembleNativeApplicationCatalog(
  engineerNativeModules,
);
export const ENGINEER_SKILLS = engineerCatalog.skills;
