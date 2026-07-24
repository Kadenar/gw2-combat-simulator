import { defineProfession } from "../../platform/engine/profession.js";
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild,
} from "./build.js";
import { mesmerCatalog } from "./catalog.js";
import {
  createDefaultConfig,
  simulateRotation,
  simulateSequence,
} from "./simulation.js";
import { createMesmerState, snapshotMesmerState } from "./state.js";
import { mesmerAttributeRules } from "./attribute-rules.js";
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
  castRules: {},
  schedulerHooks: {
    snapshot: context => snapshotMesmerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: {},
  },
  ui: mesmerUi,
  simulation: Object.freeze({
    createDefaultConfig,
    simulateRotation,
    simulateSequence,
  }),
});

export default mesmerProfession;
