import { defineProfession } from "../../platform/engine/profession.js";
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "./build.js";
import { mesmerCatalog } from "./catalog.js";
import {
  simulateRotation,
  simulateSequence,
} from "./simulation.js";
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
  },
  attributeRules: mesmerAttributeRules,
  schedulerHooks: {
    snapshot: context => snapshotMesmerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: mesmerResolverEventHandlers,
    eventReactions: mesmerResolverEventReactions,
  },
  ui: mesmerUi,
  simulation: Object.freeze({
    simulate: ({ rotation = [], config = {}, mode = "sequence" } = {}) =>
      mode === "rotation"
        ? simulateRotation(rotation, config)
        : simulateSequence(rotation, config),
  }),
});

export default mesmerProfession;
