import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild,
} from "./build.js";
import { revenantCatalog } from "./catalog.js";
import { revenantCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import { conduitModule } from "./specializations/conduit/module.js";
import { heraldModule } from "./specializations/herald/module.js";
import { renegadeModule } from "./specializations/renegade/module.js";
import { vindicatorModule } from "./specializations/vindicator/module.js";
import type { RevenantRuntimeState } from "./types.js";

export const revenantProfession = defineProfessionFamily<RevenantRuntimeState>({
  id: "revenant",
  name: "Revenant",
  catalog: revenantCatalog,
  build: {
    createBuildDefaults: createRevenantBuildDefaults,
    migrateBuild: migrateRevenantBuild,
    validateBuild: validateRevenantBuild,
  },
  core: revenantCoreModule,
  specializations: {
    Herald: heraldModule,
    Renegade: renegadeModule,
    Vindicator: vindicatorModule,
    Conduit: conduitModule,
  },
});

export default revenantProfession;
