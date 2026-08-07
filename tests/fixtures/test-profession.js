import { createCanonicalCatalog } from "../../js/platform/engine/catalog.js";
import { defineProfession } from "../../js/platform/engine/profession.js";

const catalog = createCanonicalCatalog({
  generated: [
    {
      id: 900001,
      name: "Fixture Slash",
      type: "Weapon",
      weapon: "Fixture Blade",
      slot: 1,
      castTimeMs: 1000,
      effects: [
        { type: "strike", coefficient: 1, hits: 1 },
        { type: "control" },
      ],
    },
    {
      id: 900002,
      name: "Fixture Charge",
      type: "Utility",
      slot: 2,
      castTimeMs: 0,
      effects: [{
        type: "custom",
        eventType: "fixture.resource",
        event: { amount: 1 },
      }],
    },
  ],
  weapons: ["Fixture Blade"],
});

export const testProfession = defineProfession({
  id: "fixture",
  name: "Fixture",
  catalog,
  build: {
    createBuildDefaults: () => ({
      schemaVersion: 3,
      profession: "fixture",
      traitIds: ["fixture.power"],
      rotation: [],
    }),
    migrateBuild: saved => ({
      schemaVersion: 3,
      profession: "fixture",
      traitIds: Array.isArray(saved?.traitIds) ? saved.traitIds : [],
      rotation: Array.isArray(saved?.rotation) ? saved.rotation : [],
    }),
    validateBuild: build => ({
      valid: build?.profession === "fixture",
      errors: build?.profession === "fixture" ? [] : ["Wrong profession."],
    }),
  },
  resources: {
    createProfessionState: () => ({ charge: 0, controlEvents: 0 }),
  },
  attributeRules: {
    modifyAttributes: (context, attributes) => ({
      ...attributes,
      power: attributes.power
        + (context.config.traitIds?.includes("fixture.power") ? 100 : 0),
    }),
  },
  resolverHooks: {
    eventHandlers: {
      "fixture.resource": (context, event) => {
        context.profession.charge = Math.min(
          5,
          context.profession.charge + Number(event.amount || 0),
        );
      },
    },
    eventReactions: {
      "control.resolved": context => {
        context.profession.controlEvents += 1;
      },
    },
  },
  schedulerHooks: {
    snapshot: context => ({
      charge: context.state.profession.charge,
      controlEvents: context.state.profession.controlEvents,
    }),
  },
  ui: {
    paletteGroups: () => [{
      id: "fixture",
      label: "Fixture",
      skillIds: [900001, 900002],
    }],
    resourceViews: context => [{
      id: "charge",
      singular: "charge",
      plural: "charges",
      maximum: 5,
      value: context.state?.profession?.charge || 0,
    }],
  },
});
