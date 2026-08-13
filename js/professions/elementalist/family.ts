import { defineNativeProfession } from "../../platform/gw2/native-profession.js";
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild,
} from "./build.js";
import { elementalistNativeModules } from "./modules.js";

export const elementalistProfession = defineNativeProfession({
  id: "elementalist",
  name: "Elementalist",
  build: {
    createBuildDefaults: createElementalistBuildDefaults,
    migrateBuild: migrateElementalistBuild,
    validateBuild: validateElementalistBuild,
  },
  modules: elementalistNativeModules,
  catalog: { skillNameCollision: "first" },
});

export default elementalistProfession;
