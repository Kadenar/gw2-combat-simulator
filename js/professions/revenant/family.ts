import { defineProfessionFamily } from "../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild,
} from "./build.js";
import { revenantAttributeRules } from "./attribute-rules.js";
import { revenantCatalog } from "./catalog.js";
import { revenantCoreModule } from "./core/module.js";
import {
  revenantCastRules,
  revenantSchedulerHooks,
} from "./core/rules.js";
import "./data/trait-coverage.js";
import {
  revenantResolverEventHandlers,
  revenantResolverEventReactions,
} from "./resolver.js";
import { conduitModule } from "./specializations/conduit/module.js";
import { heraldModule } from "./specializations/herald/module.js";
import { renegadeModule } from "./specializations/renegade/module.js";
import { vindicatorModule } from "./specializations/vindicator/module.js";
import {
  createRevenantResolverState,
  createRevenantState,
  projectRevenantEndState,
  snapshotRevenantState,
} from "./state.js";
import { createRevenantFamilyUi } from "./ui.js";
import type { RevenantSchedulerContext } from "./types.js";

const revenantUi = createRevenantFamilyUi(
  revenantCoreModule.ui || {},
  {
    Herald: heraldModule.ui || {},
    Renegade: renegadeModule.ui || {},
    Vindicator: vindicatorModule.ui || {},
    Conduit: conduitModule.ui || {},
  },
);

export const revenantProfession = defineProfessionFamily<SchedulerRecord>({
  id: "revenant",
  name: "Revenant",
  catalog: revenantCatalog,
  build: {
    createBuildDefaults: createRevenantBuildDefaults,
    migrateBuild: migrateRevenantBuild,
    validateBuild: validateRevenantBuild,
  },
  resources: {
    createProfessionState: createRevenantState,
    createResolverState: createRevenantResolverState,
    projectEndState: projectRevenantEndState,
  },
  attributeRules: revenantAttributeRules,
  castRules: revenantCastRules,
  schedulerHooks: {
    ...revenantSchedulerHooks,
    snapshot: (context: RevenantSchedulerContext) =>
      snapshotRevenantState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: revenantResolverEventHandlers,
    eventReactions: revenantResolverEventReactions,
  },
  core: revenantCoreModule,
  specializations: {
    Herald: heraldModule,
    Renegade: renegadeModule,
    Vindicator: vindicatorModule,
    Conduit: conduitModule,
  },
  ui: revenantUi,
});

export default revenantProfession;
