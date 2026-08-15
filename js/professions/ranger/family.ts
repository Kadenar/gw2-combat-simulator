import { defineNativeProfession } from "../../platform/gw2/native-profession.js";
import { activePatchPreview } from "../../patches/active-preview.js";
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild,
} from "./build.js";
import "./data/trait-coverage.js";
import { rangerNativeModules } from "./modules.js";

export const rangerProfession = defineNativeProfession({
  id: "ranger",
  name: "Ranger",
  build: {
    createBuildDefaults: createRangerBuildDefaults,
    migrateBuild: migrateRangerBuild,
    validateBuild: validateRangerBuild,
  },
  modules: rangerNativeModules,
  patchPreview: activePatchPreview,
});

export default rangerProfession;
