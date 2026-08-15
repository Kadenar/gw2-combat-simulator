import { defineNativeProfession } from "../../platform/gw2/native-profession.js";
import { activePatchPreview } from "../../patches/active-preview.js";
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild,
} from "./build.js";
import "./data/trait-coverage.js";
import { revenantNativeModules } from "./modules.js";

export const revenantProfession = defineNativeProfession({
  id: "revenant",
  name: "Revenant",
  build: {
    createBuildDefaults: createRevenantBuildDefaults,
    migrateBuild: migrateRevenantBuild,
    validateBuild: validateRevenantBuild,
  },
  modules: revenantNativeModules,
  patchPreview: activePatchPreview,
});

export default revenantProfession;
