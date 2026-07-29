// Engine-facing Revenant contract. Keep browser persistence, rendering, and
// build-to-simulation orchestration in app/app-definition.js.

import { defineProfession } from "../../platform/engine/profession.js";
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild,
} from "./build.js";
import { revenantAttributeRules } from "./attribute-rules.js";
import { revenantCatalog } from "./catalog.js";
import {
  revenantCastRules,
  revenantSchedulerHooks,
} from "./mechanics/contract.js";
import { revenantResolverEventHandlers } from "./resolver/event-handlers.js";
import { revenantResolverEventReactions } from "./resolver/event-reactions.js";
import {
  createRevenantState,
  projectRevenantEndState,
  snapshotRevenantState,
} from "./state.js";
import { revenantUi } from "./ui.js";
import "./data/trait-coverage.js";

export const revenantProfession = defineProfession({
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
    createResolverState: createRevenantState,
    projectEndState: projectRevenantEndState,
  },
  attributeRules: revenantAttributeRules,
  castRules: revenantCastRules,
  schedulerHooks: {
    ...revenantSchedulerHooks,
    snapshot: (context) => snapshotRevenantState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: revenantResolverEventHandlers,
    eventReactions: revenantResolverEventReactions,
  },
  ui: revenantUi,
});
export default revenantProfession;
