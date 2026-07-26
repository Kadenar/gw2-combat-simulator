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
  guardianSchedulerHooks,
} from "./mechanics/contract.js";
import {
  guardianResolverEventHandlers,
  guardianResolverEventReactions,
} from "./resolver/event-handlers.js";
import {
  createGuardianResolverState,
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
    createResolverState: createGuardianResolverState,
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
  resolverHooks: {
    eventHandlers: guardianResolverEventHandlers,
    eventReactions: guardianResolverEventReactions,
  },
  ui: guardianUi,
});

export default guardianProfession;
