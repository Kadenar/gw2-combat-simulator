import { defineProfession } from "../../platform/engine/profession.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "./build.js";
import {
  guardianAttributeRules,
  guardianCastModifiers,
} from "./attribute-rules.js";
import { guardianCatalog } from "./catalog.js";
import {
  guardianCastRules,
  guardianResolverHooks,
  guardianSchedulerHooks,
} from "./mechanics/contract.js";
import {
  createGuardianState,
  snapshotGuardianState,
} from "./state.js";
import { guardianUi } from "./ui.js";

export const guardianProfession = defineProfession({
  id: "guardian",
  name: "Guardian",
  catalog: guardianCatalog,
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild,
  },
  resources: {
    createProfessionState: createGuardianState,
  },
  attributeRules: guardianAttributeRules,
  castRules: {
    ...guardianCastRules,
    ...guardianCastModifiers,
  },
  schedulerHooks: {
    ...guardianSchedulerHooks,
    snapshot: context => snapshotGuardianState(context.state.profession),
  },
  resolverHooks: guardianResolverHooks,
  ui: guardianUi,
});

export default guardianProfession;
