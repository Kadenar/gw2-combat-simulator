import { assembleNativeApplicationCatalog } from "../../platform/gw2/native-profession.js";
import { elementalistNativeModules } from "./modules.js";

export const ELEMENTALIST_ELITE_SPECIALIZATIONS = Object.freeze([
  "Tempest",
  "Weaver",
  "Catalyst",
  "Evoker",
]);

export const elementalistCatalog = assembleNativeApplicationCatalog(
  elementalistNativeModules,
  { skillNameCollision: "first" },
);

export const ELEMENTALIST_SKILLS = elementalistCatalog.skills;
