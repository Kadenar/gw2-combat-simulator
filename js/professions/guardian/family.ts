import { defineNativeProfession } from "../../platform/gw2/native-profession.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import "./data/trait-coverage.js";
import { guardianNativeModules } from "./modules.js";

export const guardianProfession = defineNativeProfession({
  id: "guardian",
  name: "Guardian",
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild,
  },
  modules: guardianNativeModules,
});

export default guardianProfession;
