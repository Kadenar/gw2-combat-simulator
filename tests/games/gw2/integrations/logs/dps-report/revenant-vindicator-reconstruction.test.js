import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

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
        { id: 62_730, skills: [{ castTime: 1300, duration: 200, timeGained: 0 }] }
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

// The reconstructed rotation executes on the registered live Revenant family.
function simulate(rotation, sigil) {
  const config = {
    specialization: 'Vindicator',
    selectedLegends: ['LegendaryAssassin', 'LegendaryAlliance'],
    startingLegend: 'LegendaryAssassin',
    initialEnergy: 50,
    sigilSets: [{ names: [sigil] }, { names: [] }],
    stats: { power: 2000, precision: 1500, ferocity: 500, vitality: 1000 },
    target: { armor: 2597, health: 4_000_000, conditions: {} }
  };
  return runGw2Runtime({ profession: revenantProfession.liveRuntimeFor(config), config, rotation });
}

const energyProcs = (result) => result.procSteps.filter((step) => step.skill === 'Sigil of Energy').length;

test('dps.report Vindicator reconstruction includes takeoff and recognizes Energy sigil', () => {
  const reconstruction = reconstructDpsReportRotation(report, revenantCatalog);
  const actionNames = reconstruction.actions.map((action) => action.name);
  const energy = simulate(reconstruction.rotation, 'Energy');
  const other = simulate(reconstruction.rotation, 'Air');

  assert.deepEqual(actionNames, ['Dodge Jump', 'Swap Legends', 'Dodge Jump']);
  // The source landing at 100 ms belongs to the jump beginning 600 ms earlier.
  assert.equal(reconstruction.timelineOriginMs, -500);
  const jump = energy.steps.find((step) => step.skill === 'Dodge Jump');
  assert.equal(jump.end - jump.start, 800);
  assert.equal(energyProcs(energy), 1);
  assert.equal(energyProcs(other), 0);
});
