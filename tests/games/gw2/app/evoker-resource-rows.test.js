import assert from 'node:assert/strict';
import test from 'node:test';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';

// Evoker snapshots and weapon gains use their own recorded capacity instead of the clone resource contract.
test('Evoker resource presentation distinguishes charge totals from gains', () => {
  const events = [
    { skillName: 'Calcify', value: 0, empowered: 1 },
    { skillName: 'Dazing Discharge', value: 1, empowered: 1, change: 1 },
    { skillName: 'Cyclone', value: 2, empowered: 1, change: 1 }
  ].map((event, index) => ({
    type: 'resource',
    kind: 'evoker-charges',
    source: event.skillName,
    sourceId: index + 1,
    actorType: 'player',
    at: index,
    eventOrder: index,
    maximum: 6,
    ...event
  }));
  const rows = simulationEventLogRows(
    { events, resolvedEvents: [] },
    { specialization: 'Evoker' },
    elementalistProfession
  );
  assert.deepEqual(
    rows.map((row) => row.description),
    [
      'FAMILIAR CHARGES → 0/6 · empowered 1',
      'FAMILIAR CHARGES (+1) → 1/6 · empowered 1',
      'FAMILIAR CHARGES (+1) → 2/6 · empowered 1'
    ]
  );
});

// The new profession hook leaves the existing named resource-spending contract intact.
test('generic resource spending retains the recorded amount and planning capacity', () => {
  const rows = simulationEventLogRows({
    events: [{ type: 'resource', resource: 'clones', amount: -2, value: 1, at: 0 }],
    resolvedEvents: [],
    planningState: { profession: { resourceDefinition: { maximum: 3 } } }
  });
  assert.equal(rows[0].description, 'CLONES SPENT x2 -> 1/3');
});
