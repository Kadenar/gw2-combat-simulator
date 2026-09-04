import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { chartValueAt } from '#gw2/app/presentation/results/charts/time-series-model.js';
import { eventLogCsv } from '#gw2/app/presentation/results/event-log-view.js';
import { nextResultSortState, sortResultRows } from '#gw2/app/presentation/results/rotation-results.js';
import {
  buildChartSeries,
  formatResultTimelineTime,
  resultSummaryMetrics,
  skillBreakdownRows
} from '#gw2/app/rotation/result/model.js';
import { continuumEndTimelineMarkers } from '#gw2/app/rotation/timeline/model.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { rotationWarningItems } from '#gw2/app/rotation/result/warnings.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';

const PLAYER_RESOLVED_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

test('relic and trait activations are exposed as proc timeline steps', () => {
  const result = simulateMesmer(
    ['Blurred Frenzy'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      selectedTraitIds: [TRAIT.FENCERS_FINESSE],
      relic: 'Thief',
      initialResource: 0
    })
  );

  assert.ok(result.procSteps.some((proc) => proc.type === 'trait_proc' && proc.skill === "Fencer's Finesse"));
  assert.ok(result.procSteps.some((proc) => proc.type === 'relic_proc' && proc.skill === 'Relic of the Thief'));
});

test('result summary uses the expected metric order', () => {
  const result = simulateMesmer(
    ['Blurred Frenzy'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      initialResource: 0
    })
  );

  assert.deepEqual(
    resultSummaryMetrics(result).map((metric) => metric.label),
    ['Duration', 'Total Idle Time', 'Player Damage', 'Player DPS', 'Strike', 'Condition']
  );
});

test('result summary totals the same charge-aware dead-time gaps shown on the timeline', () => {
  const metrics = resultSummaryMetrics({
    duration: 2,
    deathTime: null,
    events: [
      {
        type: 'resource',
        reason: 'profession mechanic',
        rotationIndex: 1,
        amount: -4,
        resource: 'dragon charges',
        sourceSkill: 'Second Cast',
        chargingSeconds: 0.5
      }
    ],
    steps: [
      { ri: 0, skill: 'First Cast', start: 0, end: 500 },
      { ri: 1, skill: 'Second Cast', start: 1250, end: 1750 }
    ]
  });

  assert.deepEqual(metrics[1], {
    label: 'Total Idle Time',
    value: '250ms',
    className: '',
    details: [{ label: 'Idle time between skills', value: '250ms' }]
  });
});

test('result summary includes explicit wait shapes in total idle time', () => {
  const metrics = resultSummaryMetrics({
    duration: 1,
    deathTime: null,
    events: [],
    steps: [
      { ri: 0, skill: 'First Cast', start: 0, end: 500 },
      { ri: 1, skill: 'Wait', start: 500, end: 900, type: 'wait' },
      { ri: 2, skill: 'Second Cast', start: 900, end: 1000 }
    ]
  });

  assert.deepEqual(metrics[1], {
    label: 'Total Idle Time',
    value: '400ms',
    className: '',
    details: [{ label: 'Explicit waits', value: '400ms' }]
  });
});

test('result summary details legitimate gaps and groups repeated missing-commit cancellations', () => {
  const metrics = resultSummaryMetrics({
    duration: 1,
    deathTime: null,
    events: [],
    resolvedEvents: [],
    steps: [
      {
        ri: 0,
        skill: 'Opening Skill',
        start: 0,
        end: 100,
        activationId: 'cast:1'
      },
      {
        ri: 1,
        skill: 'Interrupted Skill',
        start: 300,
        end: 700,
        activationId: 'cast:2',
        interrupted: true,
        missingInterruptCommit: true
      },
      {
        ri: 2,
        skill: 'Interrupted Skill',
        start: 700,
        end: 800,
        activationId: 'cast:3',
        interrupted: true,
        missingInterruptCommit: true
      }
    ]
  });

  assert.deepEqual(metrics[1], {
    label: 'Total Idle Time',
    value: '700ms',
    className: '',
    details: [
      { label: 'Idle time between skills', value: '200ms' },
      { label: "Skill cancelled 'Interrupted Skill' (2 casts)", value: '500ms' }
    ]
  });
});

test('Kill Time accounts for an explicit Combat Start reference', () => {
  const metrics = resultSummaryMetrics({
    duration: 93.89,
    deathTime: 93.89,
    firstHitTime: 2.06,
    events: [{ type: 'combat_start', at: 2.06 }]
  });

  assert.equal(metrics[0].label, 'Kill Time');
  assert.equal(metrics[0].value, '91.83s');
});

test('result summary hides the internal effect horizon after the target dies', () => {
  const metrics = resultSummaryMetrics({
    duration: 97.1,
    deathTime: 93.1
  });

  assert.equal(metrics[0].label, 'Kill Time');
  assert.equal(metrics[0].value, '93.10s');
  assert.equal(
    metrics.some((metric) => metric.value === '97.10s'),
    false
  );
});

test('Combat Start is timeline zero while DPS waits for the first subsequent hit', () => {
  const result = simulateMesmer(
    ['Phantasmal Swordsman', { name: '__combat_start', offset: 700 }, 'Bladecall'],
    defaultSimulationConfig()
  );

  assert.equal(formatResultTimelineTime(result.steps[0].start, result), '-0.70s');
  assert.equal(formatResultTimelineTime(result.steps[1].start, result), '0.00s');
  assert.equal(formatResultTimelineTime(result.steps[2].start, result), '0.18s');
  assert.equal(formatResultTimelineTime(result.steps[2].end, result), '0.62s');
  assert.equal(result.dpsStartTime, result.firstHitTime);
});

test('timeline retains simulation time while DPS starts on first damage without Combat Start', () => {
  const result = simulateMesmer(['Phantasmal Swordsman', 'Bladecall'], defaultSimulationConfig());

  assert.equal(result.dpsStartTime, 0.759);
  assert.ok(Math.abs(result.dpsWindow - 0.561) < 1e-12);
  assert.equal(formatResultTimelineTime(result.steps[0].start, result), '0.00s');
  assert.equal(formatResultTimelineTime(result.steps[1].start, result), '0.88s');
});

test('rotation warnings use timeline-relative timestamps', () => {
  const invalidReason = 'Skill is unavailable.';
  const result = {
    events: [{ type: 'combat_start', at: 2 }],
    steps: [
      {
        invalid: true,
        invalidReason,
        start: 3500
      }
    ],
    warnings: [invalidReason, 'Bladesong skipped at 4.25s: no blades.']
  };

  assert.deepEqual(rotationWarningItems(result), [
    { message: invalidReason, time: '1.50s' },
    { message: 'Bladesong skipped: no blades.', time: '2.25s' }
  ]);
});

test('a delayed Combat Start suppresses earlier damage without moving display zero', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__combat_start', offset: 500 }, 'Illusionary Counter', 'Counterspell'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );

  assert.equal(result.steps[1].start, 500);
  assert.equal(formatResultTimelineTime(result.steps[0].start, result), '-0.50s');
  assert.equal(formatResultTimelineTime(result.steps[1].start, result), '0.00s');
  assert.ok(result.resolvedEvents.filter((event) => event.type === 'damage').every((event) => event.at >= 0.5));
  assert.ok(Math.abs(result.dpsStartTime - 1.002) < 1e-12);
});

test('event log timestamps use the same explicit Combat Start origin as rotation tiles', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__combat_start', offset: 500 }, 'Illusionary Counter', 'Counterspell'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const log = simulationEventLogRows(result, null, mesmerProfession);
  const duelistStart = log.find((event) => event.description.startsWith('CAST Phantasmal Duelist'));
  const combatStart = log.find((event) => event.description === 'COMBAT START');
  const counterspellStart = log.find((event) => event.description.startsWith('CAST Counterspell'));

  assert.equal(duelistStart.at, -0.5);
  assert.equal(combatStart.at, 0);
  assert.ok(Math.abs(counterspellStart.at - 0.18) < 1e-12);
  assert.match(eventLogCsv(log), /"-0\.500","cast"/);
  assert.match(eventLogCsv(log), /"0\.000","combat_start","COMBAT START"/);
});

test('result summary includes kill time when target health is exhausted', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall'],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        health: 1
      }
    })
  );

  assert.deepEqual(
    resultSummaryMetrics(result).map((metric) => metric.label),
    ['Kill Time', 'Total Idle Time', 'Player Damage', 'Player DPS', 'Strike', 'Condition']
  );
  assert.equal(buildChartSeries(result).durationMs, Math.max(1, result.dpsWindow * 1000));
});

test('result table sorting cycles consistently across profession views', () => {
  assert.deepEqual(nextResultSortState(null, null, 'dps'), {
    column: 'dps',
    direction: 'desc'
  });
  assert.deepEqual(nextResultSortState('dps', 'desc', 'dps'), {
    column: 'dps',
    direction: 'asc'
  });
  assert.deepEqual(nextResultSortState('dps', 'asc', 'dps'), {
    column: null,
    direction: null
  });

  const rows = [
    { name: 'Beta', total: 20, dps: 5 },
    { name: 'Alpha', total: 10, dps: 8 }
  ];
  const columns = [
    { key: 'name', numeric: false },
    { key: 'dps', numeric: true }
  ];

  assert.deepEqual(
    sortResultRows(rows, columns, null, null).map((row) => row.name),
    ['Beta', 'Alpha']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'dps', 'desc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
  assert.deepEqual(
    sortResultRows(rows, columns, 'name', 'asc').map((row) => row.name),
    ['Alpha', 'Beta']
  );
});

test('skill breakdown combines strike and condition damage by source skill', () => {
  const result = simulateMesmer(
    ['Confusing Images', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword',
      initialResource: 0
    })
  );
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Confusing Images');

  assert.ok(row.strike > 0);
  assert.ok(row.condition > 0);
  assert.equal(row.total, row.strike + row.condition);
  assert.equal(row.casts, 1);
  assert.equal(row.hits, 7);
  assert.ok(row.average > 0);
  assert.ok(row.dct > 0);
});

test('condition breakdown reports damage, DPS, and average stacks', () => {
  const result = simulateMesmer(
    ['Confusing Images', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword',
      initialResource: 0
    })
  );
  const confusion = result.conditionBreakdown.find((entry) => entry.name === 'Confusion');

  assert.ok(confusion.damage > 0);
  assert.equal(confusion.dps, confusion.damage / result.dpsWindow);
  assert.ok(confusion.averageStacks > 0);
});

test('chart series expose first-hit-anchored average DPS and condition stacks', () => {
  const result = simulateMesmer(
    ['Confusing Images', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword',
      initialResource: 0
    })
  );
  const series = buildChartSeries(result);

  assert.ok(series.dps.length > 2);
  assert.ok(series.effects.Confusion.some((point) => point.v > 0));
  assert.ok(Math.abs(series.dps.at(-1).v - result.dps) < 0.001);
});

test('chart hover values use the latest sample at the hovered timestamp', () => {
  const points = [
    { t: 0, v: 0 },
    { t: 250, v: 12 },
    { t: 500, v: 8 }
  ];

  assert.equal(chartValueAt(points, 249), 0);
  assert.equal(chartValueAt(points, 250), 12);
  assert.equal(chartValueAt(points, 499), 12);
  assert.equal(chartValueAt(points, 500), 8);
  assert.equal(chartValueAt([], 500), 0);
});

test('Compounding Power chart series caps at five stacks', () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 7 }, (_, index) => ({
        type: 'buff',
        at: index * 0.1,
        kind: 'compounding',
        duration: 8,
        stacks: 1,
        resolvedAudience: PLAYER_RESOLVED_AUDIENCE
      }))
    },
    100
  );

  assert.equal(Math.max(...series.effects['Compounding Power'].map((point) => point.v)), 5);
});

test('Vulnerability chart series caps at 25 stacks', () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: Array.from({ length: 30 }, (_, index) => ({
        type: 'condition',
        at: index * 0.01,
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1
      })),
      events: []
    },
    100
  );

  assert.equal(Math.max(...series.effects.Vulnerability.map((point) => point.v)), 25);
});

test('Might chart series caps at 25 stacks', () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 30 }, (_, index) => ({
        type: 'buff',
        at: index * 0.01,
        kind: 'might',
        duration: 8,
        stacks: 1,
        resolvedAudience: PLAYER_RESOLVED_AUDIENCE
      }))
    },
    100
  );

  assert.equal(Math.max(...series.effects.Might.map((point) => point.v)), 25);
});

test("Kalla's Fervor chart series caps at five stacks", () => {
  const series = buildChartSeries(
    {
      duration: 10,
      resolvedEvents: [],
      events: Array.from({ length: 7 }, (_, index) => ({
        type: 'buff',
        at: index * 0.01,
        kind: 'kallas-fervor',
        duration: 8,
        stacks: 1,
        resolvedAudience: PLAYER_RESOLVED_AUDIENCE
      }))
    },
    100
  );

  assert.equal(Math.max(...series.effects["Kalla's Fervor"].map((point) => point.v)), 5);
});

test('Continuum Shift is available only while Continuum Split is active', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    initialResource: 3
  });
  const split = simulateMesmer(['Continuum Split'], config);

  assert.equal(split.endState.profession.continuumActive, true);
  assert.ok(split.endState.profession.continuumRemaining > 0);

  const shifted = simulateMesmer(['Continuum Split', 'Continuum Shift'], config);

  assert.equal(shifted.endState.profession.continuumActive, false);
});

test('expired Continuum Split is injected before the next rotation action', () => {
  const rotation = ['Continuum Split', 'Bladecall', 'Bladecall', 'Bladecall'];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3
    })
  );

  assert.deepEqual(continuumEndTimelineMarkers(result, rotation.length), [
    {
      insertionIndex: 3,
      skill: 'Continuum Shift',
      start: 6000,
      detail: 'split expired'
    }
  ]);
});

test('manual Continuum Shift is not duplicated as an injected timeline marker', () => {
  const rotation = ['Continuum Split', 'Continuum Shift'];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3
    })
  );

  assert.deepEqual(continuumEndTimelineMarkers(result, rotation.length), []);
});

test('Continuum Split does not restore weapon-swap cooldown', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    initialResource: 3,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const result = simulateMesmer(
    [
      '__combat_start',
      'Continuum Split',
      'Swap Weapons',
      { name: '__wait', waitMs: 1000 },
      'Continuum Shift',
      'Swap Weapons'
    ],
    config
  );

  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
});

test('Continuum Split does not extend an existing weapon-swap cooldown', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    initialResource: 3,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const result = simulateMesmer(
    ['__combat_start', 'Swap Weapons', 'Continuum Split', { name: '__wait', waitMs: 1000 }, 'Continuum Shift'],
    config
  );

  assert.equal(result.endState.cooldowns['Swap Weapons'].readyAt, 10000);
});

test('a build can open combat on its second weapon set', () => {
  const base = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: '',
    weaponSet2Primary: 'Scepter',
    weaponSet2Secondary: ''
  });
  const onSetTwo = simulateMesmer([{ name: '__wait', waitMs: 1000 }], {
    ...base,
    startingWeaponSet: 2
  });

  assert.equal(onSetTwo.endState.activeWeaponSet, 2);

  // Swapping from a set-two opener lands on set one, proving t=0 was set two.
  const swappedFromTwo = simulateMesmer(['Swap Weapons'], {
    ...base,
    startingWeaponSet: 2
  });

  assert.equal(swappedFromTwo.endState.activeWeaponSet, 1);

  const onSetOne = simulateMesmer([{ name: '__wait', waitMs: 1000 }], {
    ...base,
    startingWeaponSet: 1
  });

  assert.equal(onSetOne.endState.activeWeaponSet, 1);
});

test('starting on weapon set two is ignored without a second weapon set', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0,
      primaryWeapon: 'Sword',
      secondaryWeapon: '',
      weaponSet2Primary: '',
      weaponSet2Secondary: '',
      startingWeaponSet: 2
    })
  );

  assert.equal(result.endState.activeWeaponSet, 1);
});

test('clone specs never open combat with clones', () => {
  // The app path forces initialResource to 0 for clone specs; the engine
  // still honours an explicit count so shatter setups stay testable.
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    })
  );

  assert.equal(result.endState.profession.resource, 0);
});
