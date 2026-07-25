import { defineProfession } from "../../platform/engine/profession.js";
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "./build.js";
import { mesmerCatalog } from "./catalog.js";
import {
  mesmerCastRules,
  mesmerSchedulerHooks,
  projectMesmerEndState,
} from "./mechanics/contract.js";
import { createMesmerState, snapshotMesmerState } from "./state.js";
import { mesmerAttributeRules } from "./attribute-rules.js";
import {
  mesmerResolverEventHandlers,
  mesmerResolverEventReactions,
} from "./resolver/event-handlers.js";
import { mesmerUi } from "./ui.js";

export const mesmerProfession = defineProfession({
  id: "mesmer",
  name: "Mesmer",
  catalog: mesmerCatalog,
  build: {
    createBuildDefaults: createMesmerBuildDefaults,
    migrateBuild: migrateMesmerBuild,
    validateBuild: validateMesmerBuild,
  },
  resources: {
    createProfessionState: createMesmerState,
    createResolverState: () => ({
      ineptitudeReadyAt: 0,
      sharperImagesProgress: 0,
      bloodsongProgress: 0,
    }),
    projectEndState: projectMesmerEndState,
  },
  attributeRules: mesmerAttributeRules,
  castRules: mesmerCastRules,
  schedulerHooks: {
    ...mesmerSchedulerHooks,
    snapshot: context => snapshotMesmerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: mesmerResolverEventHandlers,
    eventReactions: mesmerResolverEventReactions,
  },
  ui: mesmerUi,
});

export default mesmerProfession;
