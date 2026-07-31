import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild,
} from "./build.js";
import { engineerCatalog } from "./catalog.js";
import { engineerCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import { amalgamModule } from "./specializations/amalgam/module.js";
import { holosmithModule } from "./specializations/holosmith/module.js";
import { mechanistModule } from "./specializations/mechanist/module.js";
import { scrapperModule } from "./specializations/scrapper/module.js";
import type { EngineerRuntimeState } from "./types.js";

export const engineerProfession =
  defineProfessionFamily<EngineerRuntimeState>({
    id: "engineer",
    name: "Engineer",
    catalog: engineerCatalog,
    build: {
      createBuildDefaults: createEngineerBuildDefaults,
      migrateBuild: migrateEngineerBuild,
      validateBuild: validateEngineerBuild,
    },
    core: engineerCoreModule,
    specializations: {
      Scrapper: scrapperModule,
      Holosmith: holosmithModule,
      Mechanist: mechanistModule,
      Amalgam: amalgamModule,
    },
  });

export default engineerProfession;
