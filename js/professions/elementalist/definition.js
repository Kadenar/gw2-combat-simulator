import { defineProfession } from "../../platform/engine/profession.js";
import { loadAllData } from "./data/csv-loader.js";
import { SPECIALIZATIONS, TRAITS } from "./data/traits-data.js";
import { WEAPON_DATA } from "./data/gear-data.js";
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild,
} from "./build.js";
import { SimulationEngine } from "./simulation.js";
import {
  createElementalistState,
  snapshotElementalistState,
} from "./state.js";

const specializations = SPECIALIZATIONS.map(specialization => ({ ...specialization }));
const traits = TRAITS.map(trait => ({ ...trait }));
const weapons = Object.keys(WEAPON_DATA);

export const elementalistCatalog = Object.freeze({
  skills: Object.freeze([]),
  skillsById: new Map(),
  skillsByName: new Map(),
  traits: Object.freeze(traits),
  specializations: Object.freeze(specializations),
  weapons: Object.freeze(weapons),
  load: loadAllData,
});

export const elementalistProfession = defineProfession({
  id: "elementalist",
  name: "Elementalist",
  catalog: elementalistCatalog,
  build: {
    createBuildDefaults: createElementalistBuildDefaults,
    migrateBuild: migrateElementalistBuild,
    validateBuild: validateElementalistBuild,
  },
  resources: {
    createProfessionState: createElementalistState,
  },
  schedulerHooks: {
    snapshot: context => snapshotElementalistState(context.state.profession),
  },
  ui: {
    paletteGroups: () => [],
    resourceView: ({ specialization } = {}) => {
      if (specialization === "Catalyst") {
        return {
          singular: "energy",
          plural: "energy",
          maximum: 30,
          shortLabel: "Energy",
          statusLabel: "Catalyst",
        };
      }
      if (specialization === "Evoker") {
        return {
          singular: "charge",
          plural: "charges",
          maximum: 6,
          shortLabel: "Charges",
          statusLabel: "Evoker",
        };
      }
      return null;
    },
  },
  simulation: Object.freeze({
    loadData: loadAllData,
    Engine: SimulationEngine,
  }),
});

export default elementalistProfession;
