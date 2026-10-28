import { effectFields } from '#tests/helpers/effect-report.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eventLogCsv, mountEventLog } from '#ui/results/event-log.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

test('event log CSV escapes cells', () => {
  const rows = [{ at: 0, type: 'action', description: 'CAST Quote "skill"' }];

  assert.match(eventLogCsv(rows), /"CAST Quote ""skill"""/);
});

// Same-time rows follow activation order, including instant casts and derived hits with different names.
test('event log finishes an activation before the next same-time cast', () => {
  const rows = simulationEventLogRows({
    events: [
      { type: 'action', activationId: 'first', at: 0, endsAt: 0, name: 'Z' },
      { type: 'action', activationId: 'second', at: 0, endsAt: 0, name: 'A' },
      { type: 'action', activationId: 'third', at: 0, endsAt: 1, name: 'Z' },
      { type: 'action', activationId: 'fourth', at: 1, endsAt: 2, name: 'B' },
      { type: 'combat_start', at: 0 }
    ],
    resolvedEvents: [
      { type: 'damage', activationId: 'third', at: 1, name: 'Derived hit', damage: 1 },
      { type: 'damage', activationId: 'fourth', at: 1, name: 'Opening hit', damage: 1 },
      { type: 'damage', activationId: 'first', at: 1.5, name: 'Delayed hit', damage: 1 }
    ]
  });

  assert.deepEqual(
    rows.map(({ at, description }) => [at, description]),
    [
      [0, 'COMBAT START'],
      [0, 'CAST Z (0ms)'],
      [0, 'END Z'],
      [0, 'CAST A (0ms)'],
      [0, 'END A'],
      [0, 'CAST Z (1000ms)'],
      [1, 'HIT Derived hit x1 -> 1 damage'],
      [1, 'END Z'],
      [1, 'CAST B (1000ms)'],
      [1, 'HIT Opening hit x1 -> 1 damage'],
      [1.5, 'HIT Delayed hit x1 -> 1 damage'],
      [2, 'END B']
    ]
  );
});

// A remount keeps the previous search, so only matching rows render with their escaped details.
test('event-log mounting keeps the search, escapes descriptions, and configures filename', () => {
  let html = '';
  let mounted = false;
  const container = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      mounted = true;
    },
    querySelector(selector) {
      if (mounted) return null;

      if (selector.includes('event-log-details')) return { open: true };

      if (selector.includes('event-log-search')) return { value: 'safe' };

      return null;
    },
    querySelectorAll() {
      return [];
    }
  };

  mountEventLog(
    container,
    [
      { at: 0, type: 'one', description: 'Keep <safe>', details: ['Power <1000>'] },
      { at: 1, type: 'two', description: 'Drop me' }
    ],
    { filename: 'custom"name.csv' }
  );

  assert.match(html, /<details class="log-desc"><summary>Keep &lt;<mark>safe<\/mark>&gt;<\/summary>/);
  assert.match(html, /<li>Power &lt;1000&gt;<\/li>/);
  assert.doesNotMatch(html, /Drop me/);
  assert.match(html, /data-filename="custom&quot;name\.csv"/);
  assert.match(html, /value="safe"/);
});

// Calculation details retain microseconds and actual factors without changing rows from older results.
test('event log exposes optional damage calculations at full simulation precision', () => {
  const event = {
    type: 'damage',
    at: 0.600001,
    source: 'Player',
    sourceId: 'hit',
    actorType: 'player',
    name: 'Hit',
    flatDamage: 10,
    damage: 10,
    criticalChance: 0
  };
  const result = { events: [], ...effectFields([event], 120) };
  assert.equal(simulationEventLogRows(result)[0].details, undefined);
  const damageCalculation = {
    phase: 'Ordinary',
    targetHealthBefore: null,
    targetHealthFractionBefore: null,
    power: 1000,
    coefficientMultiplier: 1,
    baseDamage: 10,
    criticalMultiplier: 1,
    outgoingMultiplier: 1,
    unroundedDamage: 10,
    rounding: 'floor'
  };
  const row = simulationEventLogRows({ ...result, ...effectFields([{ ...event, damageCalculation }], 120) })[0];
  assert.ok(row.details.includes('Simulation time: 0.600001s; phase: Ordinary'));
  assert.ok(row.details.includes('Target health before: unbounded; fraction: unbounded'));
  assert.ok(row.details.includes('Unrounded damage: 10; rounding: floor; damage: 10'));
  assert.ok(!row.details.some((detail) => detail.startsWith('Weapon strength:')));
});

test('event log distinguishes phantasm summon, attack, and clone conversion', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const log = simulationEventLogRows(result, null, withPatchPreview(mesmerProfession));

  assert.ok(
    log.some(
      (event) => Math.abs(event.at - 0.56) < 0.00001 && event.description === 'PHANTASM SUMMONED Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 2.8) < 0.00001 && event.description === 'PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 3.36) < 0.00001 &&
        event.description.includes('CLONE SPAWNED x1') &&
        event.description.includes('Phantasmal Duelist phantasm conversion')
    )
  );
  assert.match(eventLogCsv(log), /Phantasmal Duelist phantasm conversion/);
});
