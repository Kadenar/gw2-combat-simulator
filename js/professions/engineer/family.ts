import { defineNativeProfession } from "../../platform/gw2/native-profession.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild,
} from "./build.js";
import "./data/trait-coverage.js";
import { engineerNativeModules } from "./modules.js";

export const engineerProfession =
  defineNativeProfession({
    id: "engineer",
    name: "Engineer",
    build: {
      createBuildDefaults: createEngineerBuildDefaults,
      migrateBuild: migrateEngineerBuild,
      validateBuild: validateEngineerBuild,
    },
    modules: engineerNativeModules,
  });

export default engineerProfession;
