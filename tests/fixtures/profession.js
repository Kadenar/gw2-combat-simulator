import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

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

export const testProfession = defineTestProfession({
  id: 'fixture',
  name: 'Fixture',
  catalog,
  resources: {
    createState: () => ({ charge: 0, controlEvents: 0 })
  },
  modifiers: {
    modifyAttributes: (context, attributes) => ({
      ...attributes,
      power: attributes.power + (context.config.selectedTraitIds?.includes('fixture.power') ? 100 : 0)
    })
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
    }
  }
});
