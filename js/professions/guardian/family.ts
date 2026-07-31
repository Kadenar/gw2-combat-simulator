import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import { guardianCatalog } from "./catalog.js";
import { guardianCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import { dragonhunterModule } from "./specializations/dragonhunter/module.js";
import { firebrandModule } from "./specializations/firebrand/module.js";
import { luminaryModule } from "./specializations/luminary/module.js";
import { willbenderModule } from "./specializations/willbender/module.js";
import type { GuardianRuntimeState } from "./types.js";

export const guardianProfession = defineProfessionFamily<GuardianRuntimeState>({
  id: "guardian",
  name: "Guardian",
  catalog: guardianCatalog,
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild,
  },
  core: guardianCoreModule,
  specializations: {
    Dragonhunter: dragonhunterModule,
    Firebrand: firebrandModule,
    Willbender: willbenderModule,
    Luminary: luminaryModule,
  },
});

export default guardianProfession;
