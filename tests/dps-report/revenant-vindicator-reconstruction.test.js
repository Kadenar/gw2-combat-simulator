import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantCatalog } from '#gw2/content/professions/revenant/catalog.js';
import { revenantProfession } from '#gw2/content/professions/revenant/definition.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const report = parseDpsReport({
  durationMS: 2000,
  players: [
    {
      name: 'Fixture Vindicator',
      account: 'Fixture.1234',
      profession: 'Vindicator',
      rotation: [
        { id: 62_730, skills: [{ castTime: 100, duration: 200, timeGained: 0 }] },
        { id: 28_382, skills: [{ castTime: 400, duration: 0, timeGained: 0 }] },
        { id: 62_749, skills: [{ castTime: 401, duration: 0, timeGained: 0 }] },
        { id: 62_730, skills: [{ castTime: 500, duration: 200, timeGained: 0 }] }
      ]
    }
  ],
  phases: [{ start: 0, end: 2000, name: 'Full Fight', phaseType: 'Encounter' }],
  skillMap: {
    s62730: { name: 'Death Drop' },
    s28382: { name: 'Relinquish Power', isInstantCast: true },
    s62749: { name: 'Legendary Alliance', isInstantCast: true }
  }
});

function simulate(rotation, sigil) {
  return simulateGw2({
    profession: revenantProfession,
    rotation,
    config: {
      specialization: 'Vindicator',
      selectedLegends: ['LegendaryAssassin', 'LegendaryAlliance'],
      startingLegend: 'LegendaryAssassin',
      selectedDodge: 'Death Drop',
      initialEnergy: 50,
      sigilSets: [{ names: [sigil] }, { names: [] }],
      stats: { power: 2000, precision: 1500, ferocity: 500, vitality: 1000 },
      target: { armor: 2597, health: 4_000_000, conditions: {} }
    }
  });
}

test('dps.report Vindicator reconstruction maps Death Drop to Dodge and recognizes Energy sigil', () => {
  const reconstruction = reconstructDpsReportRotation(report, revenantCatalog);
  const actionNames = reconstruction.actions.map((action) => action.name);
  const energy = simulate(reconstruction.rotation, 'Energy');
  const other = simulate(reconstruction.rotation, 'Air');

  assert.deepEqual(actionNames, ['Dodge', 'Swap Legends', 'Dodge']);
  assert.equal(
    energy.events.filter((event) => event.type === 'resource' && event.sourceId === 'sigil.energy').length,
    1
  );
  assert.equal(
    other.events.filter((event) => event.type === 'resource' && event.sourceId === 'sigil.energy').length,
    0
  );
});
