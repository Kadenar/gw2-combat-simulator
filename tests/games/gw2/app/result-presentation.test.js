import assert from 'node:assert/strict';
import test from 'node:test';

import { nextResultSortState, SKILL_COLS, sortResultRows } from '#gw2/app/results/breakdown/model.js';
import { mountDamageBreakdown } from '#gw2/app/results/breakdown/view.js';
import { mountModifierContributions } from '#gw2/app/results/modifier-contributions-view.js';
import { mountRandomDistribution } from '#gw2/app/results/random-distribution-view.js';
import { mountResultSummary } from '#gw2/app/results/summary-view.js';
import { inertContainer } from '#tests/helpers/dom.js';

// Both breakdowns share total damage as their denominator, including entity and environment rows.
test('damage contribution percentages share a denominator and handle empty damage', () => {
  const container = inertContainer();
  const skillRows = [
    { name: 'Strike', group: 'Player', total: 60 },
    { name: 'Burn', group: 'Entities', total: 30 },
    { name: 'External', group: 'Environment', total: 10 }
  ];
  mountDamageBreakdown(container, {
    skillRows,
    skillColumns: SKILL_COLS,
    conditions: [{ name: 'Burning', damage: 30, dps: 3, averageStacks: 1 }],
    conditionTotal: { damage: 30, dps: 3 }
  });
  assert.match(container.innerHTML, /data-sort-col="damagePercent"[^>]*>Share/);
  assert.match(container.innerHTML, /<span>Condition<\/span><span>Damage<\/span><span>Share<\/span>/);
  assert.match(container.innerHTML, /Player Share: 60\.00%/);
  assert.match(container.innerHTML, /Entities Share: 30\.00%/);
  assert.match(container.innerHTML, /Environment Share: 10\.00%/);
  assert.match(
    container.innerHTML,
    /102849\.png" alt="" \/>Burning<\/span>\s*<span class="condi">30<\/span>\s*<span>30\.00%<\/span>/
  );
  assert.match(container.innerHTML, /<b>30\.00%<\/b>/);
  assert.equal(skillRows[0].damagePercent, undefined);

  container.innerHTML = '';
  mountDamageBreakdown(container, {
    skillRows: [{ name: 'No damage', total: 0 }],
    skillColumns: SKILL_COLS,
    conditions: []
  });
  assert.match(container.innerHTML, /<span>0\.00%<\/span>/);
  assert.doesNotMatch(container.innerHTML, /NaN|Infinity/);
});

test('result sorting handles defaults, numeric directions, strings, and cycling', () => {
  assert.deepEqual(
    SKILL_COLS.map((column) => column.key),
    ['name', 'strike', 'condition', 'total', 'damagePercent', 'dps', 'average', 'dct', 'casts', 'hits', 'critChance']
  );
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
    sortResultRows(rows, columns, 'dps', 'asc').map((row) => row.name),
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
});

test('shared results render summaries, totals, contributions, and icons', () => {
  const container = inertContainer();
  const resolved = [];

  mountResultSummary(container, {
    metrics: [
      { label: 'Player DPS', value: '1,234', className: 'dps' },
      { label: 'Environment Damage', value: '50', className: 'environment', group: 'target' },
      { label: 'Target Damage', value: '1,284', className: 'target-damage', group: 'target' }
    ],
    breakpoints: [{ healthPercent: 80, dps: 1234, elapsed: 3.25 }]
  });
  mountRandomDistribution(container, {
    randomDistributionRequested: true,
    randomDistribution: {
      trials: 500,
      mean: 1234,
      p01: 1000,
      p10: 1100,
      p50: 1225,
      p90: 1350,
      p99: 1500,
      explanation: {
        cohortPercent: 10,
        lowDpsMean: 1040,
        highDpsMean: 1460,
        drivers: [
          {
            label: 'Illusion critical hits',
            category: 'critical',
            unit: 'count',
            lowAverage: 18.2,
            highAverage: 25.4,
            delta: 7.2,
            estimatedDpsDelta: 360
          }
        ]
      }
    }
  });
  mountDamageBreakdown(
    container,
    {
      skillRows: [
        { name: 'Low', total: 10 },
        { name: 'High', total: 20 }
      ],
      skillColumns: [
        { key: 'name', label: 'Skill', numeric: false },
        { key: 'total', label: 'Total', numeric: true }
      ],
      conditions: [
        { name: 'Weak <slow>', damage: 0, dps: 0, averageStacks: 0.5 },
        { name: 'Burn <hot>', damage: 25, dps: 5, averageStacks: 1.25 }
      ],
      conditionTotal: { label: 'Total Conditions', damage: 25, dps: 5 }
    },
    {
      resolveSkillIcon: (row) => {
        resolved.push(row.name);

        return `icon-${row.name}.png`;
      }
    }
  );
  mountModifierContributions(container, {
    contributions: [
      {
        name: 'Bonus',
        dpsIncrease: 12,
        pctIncrease: 1.5,
        icon: 'bonus.png'
      },
      {
        name: 'Noise',
        dpsIncrease: -0.1,
        pctIncrease: -0.001
      },
      {
        name: 'Penalty',
        dpsIncrease: -12,
        pctIncrease: -1.5
      }
    ],
    contributionsStale: false
  });

  assert.match(container.innerHTML, /res-summary/);
  assert.equal((container.innerHTML.match(/res-stat-target-start/g) || []).length, 1);
  assert.match(container.innerHTML, /<details class="res-dps-snapshots">/);
  assert.match(container.innerHTML, /DPS snapshots/);
  assert.doesNotMatch(container.innerHTML, /res-breakpoints/);
  assert.match(container.innerHTML, /80%<\/b> target health/);
  assert.match(container.innerHTML, />1,234</);
  assert.match(container.innerHTML, /at 3\.250s/);
  assert.ok(container.innerHTML.indexOf('>High</span>') < container.innerHTML.indexOf('>Low</span>'));
  assert.match(container.innerHTML, /Total Conditions/);
  assert.equal((container.innerHTML.match(/class="res-breakdown-section"/g) || []).length, 1);
  assert.doesNotMatch(container.innerHTML, /res-section-title"><svg/);
  assert.ok(container.innerHTML.indexOf('Damage Breakdown') < container.innerHTML.indexOf('Conditions'));
  assert.ok(container.innerHTML.indexOf('Damaging Conditions') < container.innerHTML.indexOf('Burn &lt;hot&gt;'));
  assert.ok(container.innerHTML.indexOf('Burn &lt;hot&gt;') < container.innerHTML.indexOf('Other Conditions'));
  assert.ok(container.innerHTML.indexOf('Other Conditions') < container.innerHTML.indexOf('Weak &lt;slow&gt;'));
  assert.match(container.innerHTML, /\+12/);
  assert.match(container.innerHTML, /\+1\.50%/);
  // Check signed display values independently of the spans used to arrange mobile metrics.
  const resultText = container.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(resultText, /Noise DPS Increase 0 % Increase 0\.00%/);
  assert.match(resultText, /Penalty DPS Increase -12 % Increase -1\.50%/);
  assert.doesNotMatch(container.innerHTML, /-0(?:\.00)?%?/);
  assert.match(container.innerHTML, /<img src="bonus\.png" alt="" \/><span class="contrib-name-label">Bonus/);
  assert.match(container.innerHTML, /disabling each modifier and rerunning the simulation/);
  assert.match(container.innerHTML, /misleading if doing so breaks the rotation/);
  assert.match(container.innerHTML, /Randomized DPS range/);
  assert.match(container.innerHTML, /Recalculate/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /1st percentile 1,000/);
  assert.match(container.innerHTML, /99th percentile 1,500/);
  assert.match(container.innerHTML, /1,100&ndash;1,350/);
  assert.match(container.innerHTML, /What drove the difference\?/);
  assert.match(container.innerHTML, /Top 50 vs bottom 50 simulations/);
  assert.match(container.innerHTML, /The 50 highest-DPS simulations averaged 1,460 DPS/);
  assert.match(container.innerHTML, /The 50 lowest-DPS simulations averaged 1,040 DPS/);
  assert.match(container.innerHTML, /Illusion critical hits/);
  assert.match(container.innerHTML, /<td>25\.4<\/td>/);
  assert.match(container.innerHTML, /<td>18\.2<\/td>/);
  assert.match(container.innerHTML, /\+7\.2/);
  assert.match(container.innerHTML, /difference/);
  assert.match(container.innerHTML, /&asymp; \+360 DPS/);
  assert.match(container.innerHTML, /Est. DPS impact/);
  assert.match(container.innerHTML, /single-variable trend estimates/);
  assert.match(container.innerHTML, /averages across each group/);
  assert.match(container.innerHTML, /do not add them together/);
  assert.ok(container.innerHTML.indexOf('DPS snapshots') < container.innerHTML.indexOf('Randomized DPS range'));
  assert.deepEqual(resolved, ['High', 'Low']);

  assert.doesNotThrow(() => mountResultSummary(inertContainer(), { metrics: [] }));
});

test('skill damage rows group player damage before owned entities', () => {
  const container = inertContainer();

  mountDamageBreakdown(container, {
    skillRows: [
      {
        name: 'Player Low',
        strike: 6,
        condition: 4,
        total: 10,
        dps: 2,
        group: 'Player'
      },
      {
        name: 'Entity High',
        strike: 75,
        condition: 25,
        total: 100,
        dps: 20,
        group: 'Entities'
      },
      {
        name: 'Player High',
        strike: 15,
        condition: 5,
        total: 20,
        dps: 4,
        group: 'Player'
      },
      {
        name: 'Entity Low',
        strike: 30,
        condition: 20,
        total: 50,
        dps: 10,
        group: 'Entities'
      }
    ],
    skillColumns: [
      { key: 'name', label: 'Skill', numeric: false },
      { key: 'strike', label: 'Strike', numeric: true },
      {
        key: 'condition',
        label: 'Condition',
        numeric: true,
        className: 'condi'
      },
      { key: 'total', label: 'Total', numeric: true, className: 'total' },
      { key: 'dps', label: 'DPS', numeric: true, className: 'dps' }
    ],
    conditions: []
  });

  const html = container.innerHTML;
  const playerGroup = html.indexOf('data-skill-group="Player"');
  const entityGroup = html.indexOf('data-skill-group="Entities"');

  assert.ok(playerGroup >= 0);
  assert.ok(entityGroup > playerGroup);
  assert.ok(html.indexOf('Player High') < html.indexOf('Player Low'));
  assert.ok(html.indexOf('Player Low') < entityGroup);
  assert.ok(html.indexOf('Entity High') < html.indexOf('Entity Low'));
  assert.match(html, /aria-label="Player Strike: 21">21</);
  assert.match(html, /aria-label="Player Condition: 9">9</);
  assert.match(html, /aria-label="Player Total: 30">30</);
  assert.match(html, /aria-label="Player DPS: 6">6</);
  assert.match(html, /aria-label="Entities Strike: 105">105</);
  assert.match(html, /aria-label="Entities Condition: 45">45</);
  assert.match(html, /aria-label="Entities Total: 150">150</);
  assert.match(html, /aria-label="Entities DPS: 30">30</);
});

// Entity subtotals remain readable and names are escaped independently of skill labels.
test('entity damage renders named subsections beneath the combined entity total', () => {
  const container = inertContainer();
  mountDamageBreakdown(container, {
    skillRows: [
      { name: 'Shared attack', group: 'Entities', entityName: 'Pet <A>', total: 30 },
      { name: 'Shared attack', group: 'Entities', entityName: 'Pet B', total: 20 }
    ],
    skillColumns: [
      { key: 'name', label: 'Skill' },
      { key: 'total', label: 'Total', numeric: true }
    ],
    conditions: []
  });
  assert.match(container.innerHTML, /data-entity-group="Pet &lt;A&gt;"/);
  assert.match(container.innerHTML, /data-entity-group="Pet B"/);
  assert.match(container.innerHTML, /aria-label="Entities Total: 50"/);
  assert.match(container.innerHTML, /aria-label="Pet &lt;A&gt; Total: 30"/);
  assert.match(container.innerHTML, /aria-label="Pet B Total: 20"/);
});

// Player and entity subtotals share a collapsed composition panel while keeping ownership separate.
test('owner condition subtotals disclose escaped condition labels, damage, DPS, and owner-relative shares', () => {
  const container = inertContainer();
  mountDamageBreakdown(container, {
    skillRows: [
      { name: 'Player attack', group: 'Player', condition: 40, total: 50 },
      { name: 'Mixed attack', group: 'Entities', entityName: 'Pet <A>', condition: 80, total: 100 },
      { name: 'Strike', group: 'Entities', entityName: 'Pet B', condition: 0, total: 20 }
    ],
    skillColumns: SKILL_COLS,
    conditions: [],
    ownerConditions: [
      { ownerKey: 'Player', ownerName: 'Player', name: 'Burning', damage: 40, dps: 20, share: 100 },
      { ownerKey: 'Entities|Pet <A>', ownerName: 'Pet <A>', name: 'Bleeding', damage: 60, dps: 30, share: 75 },
      { ownerKey: 'Entities|Pet <A>', ownerName: 'Pet <A>', name: 'Condition <B>', damage: 20, dps: 10, share: 25 }
    ]
  });
  assert.match(container.innerHTML, /data-owner-conditions-toggle="Player" aria-expanded="false"/);
  assert.match(container.innerHTML, /data-owner-conditions-panel="Player"[^>]* hidden/);
  assert.match(container.innerHTML, /Share of player condition damage/);
  assert.match(container.innerHTML, /<td>40<\/td><td>20<\/td>/);
  assert.match(container.innerHTML, /data-owner-conditions-toggle="Entities\|Pet &lt;A&gt;" aria-expanded="false"/);
  assert.doesNotMatch(container.innerHTML, /data-owner-conditions-toggle="Entities\|Pet B"/);
  assert.match(container.innerHTML, /data-owner-conditions-panel="Entities\|Pet &lt;A&gt;"[^>]* hidden/);
  assert.match(container.innerHTML, /Share of entity condition damage/);
  assert.match(container.innerHTML, /Condition &lt;B&gt;/);
  assert.match(container.innerHTML, /<td>60<\/td><td>30<\/td>/);
  assert.match(container.innerHTML, /width: 75%/);
  assert.match(container.innerHTML, /75\.0%/);
});
