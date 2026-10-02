import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { SIGIL_DATA, SIGIL_BY_ID } from '#gw2/platform/equipment/sigils/data.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/catalog.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/data.js';
import { resolveProcIcon } from '#gw2/app/shared/icons.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';

// Selectable sigils need artwork, and proc views must inherit it without pinning asset hashes.
test('all selectable sigils provide an icon', () => {
  for (const name of SIGIL_NAMES) {
    assert.ok(SIGIL_DATA[name].icon, name);
  }
});

test('all proc sigils inherit their canonical sigil icon', () => {
  for (const [id, proc] of Object.entries(SIGIL_PROCS)) {
    assert.equal(proc.icon, SIGIL_BY_ID[Number(id)].icon, id);
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

// Doom's delayed activation must retain its own artwork across all proc consumers.
test('Sigil of Doom uses its catalog icon in proc views and combat breakdown', () => {
  const result = simulateMesmer(
    ['Bladecall', 'Swap Weapons', 'Psycut', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      sigilSets: [{ names: [] }, { names: ['Doom'], strike: 1, condition: 1 }]
    })
  );
  const proc = result.procSteps.find((step) => step.skill === 'Sigil of Doom');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sigil of Doom');
  const app = {
    results: result,
    skills: [],
    skillByName: new Map([[proc?.sourceSkill, { icon: 'trigger-skill-icon' }]])
  };

  assert.ok(proc);
  assert.ok(row);
  assert.equal(proc.icon, SIGIL_DATA.Doom.icon);
  assert.equal(resolveProcIcon(app, proc), SIGIL_DATA.Doom.icon);
  assert.equal(resultSkillIcon(app, row), SIGIL_DATA.Doom.icon);
});
