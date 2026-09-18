import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/catalog.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';

// Selectable sigils need artwork, and proc views must inherit it without pinning asset hashes.
test('all selectable sigils provide an icon', () => {
  for (const name of SIGIL_NAMES) {
    assert.ok(SIGIL_DATA[name].icon, name);
  }
});

test('all proc sigils inherit their canonical sigil icon', () => {
  for (const [name, proc] of Object.entries(SIGIL_PROCS)) {
    assert.equal(proc.icon, SIGIL_DATA[name].icon, name);
  }
});

test('Sigil of Earth procs inherit the catalog icon', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall'],
    defaultSimulationConfig({
      stats: {
        ...defaults.stats,
        precision: 3100
      },
      boons: {
        ...defaults.boons,
        fury: true
      },
      sigilSets: [
        { names: ['Earth'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    })
  );
  const proc = result.procSteps.find((step) => step.skill === 'Sigil of Earth');

  assert.ok(SIGIL_DATA.Earth.icon);
  assert.equal(proc?.icon, SIGIL_DATA.Earth.icon);
});
