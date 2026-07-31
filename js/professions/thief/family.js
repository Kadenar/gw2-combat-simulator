import { defineProfessionFamily } from "../../platform/engine/profession.js";
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild,
} from "./build.js";
import { thiefCatalog } from "./catalog.js";
import { thiefWeaponSkillMatchesSet } from "./catalog.js";
import { thiefCoreModule } from "./core/module.js";
import "./data/trait-coverage.js";
import { antiquaryModule } from "./specializations/antiquary/module.js";
import { daredevilModule } from "./specializations/daredevil/module.js";
import { deadeyeModule } from "./specializations/deadeye/module.js";
import { specterModule } from "./specializations/specter/module.js";

export const thiefProfession = defineProfessionFamily({
  id: "thief",
  name: "Thief",
  catalog: thiefCatalog,
  build: {
    createBuildDefaults: createThiefBuildDefaults,
    migrateBuild: migrateThiefBuild,
    validateBuild: validateThiefBuild,
  },
  core: thiefCoreModule,
  specializations: {
    Daredevil: daredevilModule,
    Deadeye: deadeyeModule,
    Specter: specterModule,
    Antiquary: antiquaryModule,
  },
  ui: {
    weaponSkillMatchesSet: thiefWeaponSkillMatchesSet,
  },
});

export default thiefProfession;
