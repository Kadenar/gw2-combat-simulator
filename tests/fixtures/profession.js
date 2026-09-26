import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';

// Shared fixture only; its filename keeps Node from reporting this helper as an empty test.
const catalog = createCanonicalCatalog({
  generated: [
    {
      id: 900001,
      name: 'Fixture Slash',
      type: 'Weapon',
      // Use a canonical profile so the fixture exercises the production strength contract.
      weapon: 'Sword',
      slot: 1,
      castTimeMs: 1000,
      effects: [{ type: 'strike', coefficient: 1, hits: 1 }, { type: 'control' }]
    },
    {
      id: 900002,
      name: 'Fixture Charge',
      type: 'Utility',
      slot: 2,
      castTimeMs: 0,
      effects: [
        {
          type: 'custom',
          eventType: 'fixture.resource',
          event: { amount: 1 }
        }
      ]
    }
  ],
  weapons: ['Sword']
});

export const testProfession = defineProfession({
  id: 'fixture',
  name: 'Fixture',
  catalog,
  build: {
    // Keep the fixture on the supported trait-selection contract so generic
    // architecture tests exercise the same configuration shape as GW2 builds.
    createBuildDefaults: () => ({
      schemaVersion: 3,
      profession: 'fixture',
      selectedTraitIds: ['fixture.power'],
      rotation: []
    }),
    migrateBuild: (saved) => ({
      schemaVersion: 3,
      profession: 'fixture',
      selectedTraitIds: Array.isArray(saved?.selectedTraitIds) ? saved.selectedTraitIds : [],
      rotation: Array.isArray(saved?.rotation) ? saved.rotation : []
    }),
    validateBuild: (build) => ({
      valid: build?.profession === 'fixture',
      errors: build?.profession === 'fixture' ? [] : ['Wrong profession.']
    })
  },
  resources: {
    createState: () => ({ charge: 0, controlEvents: 0 })
  },
  attributeRules: {
    modifyAttributes: (context, attributes) => ({
      ...attributes,
      power: attributes.power + (context.config.selectedTraitIds?.includes('fixture.power') ? 100 : 0)
    })
  },
  ui: {
    paletteGroups: () => [
      {
        id: 'fixture',
        label: 'Fixture',
        skillIds: [900001, 900002]
      }
    ],
    resourceViews: (context) => [
      {
        id: 'charge',
        singular: 'charge',
        plural: 'charges',
        maximum: 5,
        value: context.state?.profession?.charge || 0
      }
    ]
  },
  hooks: {
    eventHandlers: {
      'fixture.resource': (context, event) => {
        context.profession.charge = Math.min(5, context.profession.charge + Number(event.amount || 0));
      }
    },
    reactions: {
      'control.resolved': (context) => {
        context.profession.controlEvents += 1;
      }
    },
    snapshot: (context) => ({
      charge: context.profession.charge,
      controlEvents: context.profession.controlEvents
    })
  }
});
