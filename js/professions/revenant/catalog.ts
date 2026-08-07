import { assembleNativeApplicationCatalog } from "../../platform/gw2/native-profession.js";
import { revenantNativeModules } from "./modules.js";

export const REVENANT_ELITE_SPECIALIZATIONS = Object.freeze([
  "Herald", "Renegade", "Vindicator", "Conduit",
]);
export const revenantCatalog = assembleNativeApplicationCatalog(
  revenantNativeModules,
);
export const REVENANT_SKILLS = revenantCatalog.skills;
