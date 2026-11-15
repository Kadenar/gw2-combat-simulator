// Shared-window contracts and presentation use small scenarios independent of saved benchmarks.
import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import { bindRelicComparisonChartHover, relicComparisonChartSvg } from '#gw2/app/optimizer/relic-comparison/chart.js';
import { mountRelicComparison } from '#gw2/app/optimizer/relic-comparison/panel.js';
import {
  buildRelicComparisonModel,
  relicComparisonAvailable
} from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import { MAX_RELIC_COMPARISON_ALTERNATIVES } from '#gw2/app/optimizer/relic-comparison/types.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { inertContainer } from '#tests/helpers/dom.js';

function comparisonModel(opponentDps, targetDps, options = {}) {
  const zero = opponentDps.map(({ t }) => ({ t, v: 0 }));
  return buildRelicComparisonModel({
    runs: [
      {
        relic: 'Fractal',
        dps: opponentDps,
        directDps: options.opponentDirectDps ?? zero,
        kill: { killTimeMs: 1880, observedMs: 1880 }
      },
      {
        relic: 'Akeem',
        dps: targetDps,
        directDps: options.targetDirectDps ?? zero,
        kill: { killTimeMs: null, observedMs: 2000 }
      },
      ...(options.extraRuns ?? [])
    ],
    withoutRelicDps: options.withoutRelicDps ?? zero,
    targetHealthPercent: 100
  });
}

test('fixed-health comparison survives a lethal target and measures condition payouts through the shared endpoint', () => {
  const config = {
    relic: 'Last Tyrant',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Torch',
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, conditionDamage: 1000 }),
    target: { health: 1, armor: 2597 }
  };
  const rotation = ['Purging Flames', "Zealot's Flame", { type: 'wait', durationMs: 6000 }];
  const baseline = simulateGw2({ profession: guardianProfession, config, rotation });
  const runs = [];
  const comparison = calculateRelicComparison(
    {
      rotation,
      baseConfig: config,
      equippedRelic: 'Last Tyrant',
      comparisonRelics: ['Fractal', 'Thorns'],
      baselineResult: baseline,
      initialStacks: 0
    },
    guardianProfession,
    (options) => {
      const result = simulateGw2(options);

      if (options.output !== 'score') runs.push(result);

      return result;
    }
  );
  assert.notEqual(baseline.deathTime, null);
  assert.ok(comparison.durationMs > comparison.relics[0].kill.killTimeMs);
  assert.equal(runs.length, 4);
  for (const result of runs) {
    assert.equal(result.output, 'observations');
    assert.equal('breakdown' in result, false);
    assert.equal(result.deathTime, null);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.combatEndTime, runs[0].combatEndTime);
  }

  const final = comparison.points.at(-1);
  // Observation-only output must retain the same condition payouts as detailed results.
  const detailed = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: { ...config, target: { ...config.target, health: 0, fixedHealthFraction: 1 } },
    collectChartData: false
  });
  assert.equal(runs[0].totalDamage, detailed.totalDamage);
  const relicDamage = detailed.breakdown
    .filter((entry) => entry.source === 'Relic' || entry.name.startsWith('Relic of '))
    .reduce((sum, entry) => sum + entry.damage, 0);
  assert.ok(relicDamage > 0);
  assert.ok(Math.abs((final.samples[0].directDps * comparison.durationMs) / 1000 - relicDamage) < 0.000001);
  assert.ok(
    Math.abs(
      final.samples[0].gainedDps - (runs[0].totalDamage - runs.at(-1).totalDamage) / (comparison.durationMs / 1000)
    ) < 0.000001
  );
});

// Clip recorded payouts on one clock, including an exact endpoint between regular chart samples.
test('the earliest rotation bounds every series without erasing damage earned by finishing sooner', () => {
  for (const fastest of ['Fractal', 'Thorns', '']) {
    const calls = [];
    const comparison = calculateRelicComparison(
      {
        rotation: [],
        baseConfig: {},
        equippedRelic: 'Fractal',
        comparisonRelics: ['Thorns'],
        initialStacks: 0,
        baselineResult: { deathTime: 6, dpsStartTime: 0.5, combatEndTime: 6 }
      },
      {},
      (options) => {
        calls.push(options);

        if (options.output === 'score') return { deathTime: 7, dpsStartTime: 1, combatEndTime: 7 };

        const end = options.config.relic === fastest ? 4.125 : 5.125;
        return {
          dpsStartTime: options.config.relic === 'Thorns' ? 1 : 0.5,
          firstHitTime: 1,
          rotationEndTime: end,
          observationEndTime: end,
          combatEndTime: end,
          resolvedEvents: [
            { type: 'damage', at: 1, damage: 1000 },
            { type: 'damage', at: end, damage: 1000 },
            {
              type: 'condition',
              at: 1,
              source: options.config.relic ? 'Relic' : 'Skill',
              damage: end > 4.125 ? 950 : 150,
              damageTicks: [
                { at: 3.5, damage: 100 },
                { at: 4.125, damage: 50 },
                ...(end > 4.125 ? [{ at: 4.25, damage: 800 }] : [])
              ]
            }
          ]
        };
      }
    );
    assert.equal(calls.length, 4);
    assert.ok(
      calls.every((call) => !call.observationPolicy),
      'comparison needs no padded simulation runs'
    );
    assert.equal(comparison.durationMs, 3625);
    const final = comparison.points.at(-1);
    assert.equal(final.tMs, 3625);
    const seconds = comparison.durationMs / 1000;
    const baselineDamage = fastest === '' ? 2150 : 1150;
    for (const [index, relic] of ['Fractal', 'Thorns'].entries()) {
      const damage = relic === fastest ? 2150 : 1150;
      assert.equal(final.samples[index].buildDps, damage / seconds);
      assert.equal(final.samples[index].directDps, 150 / seconds);
      assert.equal(final.samples[index].gainedDps, damage / seconds - baselineDamage / seconds);
    }

    assert.equal(comparison.relics[0].kill.killTimeMs, 5500);
    assert.equal(comparison.relics[1].kill.killTimeMs, 6000);
  }
});

test('relic comparison requires two distinct supported relics', () => {
  const names = ['Fractal', 'Thorns', 'Akeem'];
  assert.equal(relicComparisonAvailable('Fractal', ['Thorns', 'Akeem'], names), true);
  for (const [equipped, target] of [
    ['Thorns', 'Thorns'],
    ['', 'Akeem'],
    [null, 'Akeem'],
    ['Fractal', 'Unknown']
  ])
    assert.equal(relicComparisonAvailable(equipped, [target], names), false);
});

test('comparison attributes direct and indirect effects against the same no-relic sample', () => {
  const model = comparisonModel(
    [
      { t: 1000, v: 1200 },
      { t: 2000, v: 1100 }
    ],
    [
      { t: 1000, v: 1000 },
      { t: 2000, v: 900 }
    ],
    {
      withoutRelicDps: [
        { t: 1000, v: 1000 },
        { t: 2000, v: 1000 }
      ],
      opponentDirectDps: [
        { t: 1000, v: 150 },
        { t: 2000, v: 50 }
      ]
    }
  );
  assert.deepEqual(model.points[0], {
    tMs: 1000,
    samples: [
      { buildDps: 1200, directDps: 150, gainedDps: 200 },
      { buildDps: 1000, directDps: 0, gainedDps: 0 }
    ]
  });
  assert.equal(model.points[1].samples[1].gainedDps, -100);
  assert.equal(model.points[1].samples[0].gainedDps, 100);
  const markup = relicComparisonChartSvg(model);
  assert.match(markup, /Results at 2.0s/);
  assert.match(markup, /Direct relic DPS/);
  assert.match(markup, /Total DPS gained/);
  assert.match(markup, /1.88s/);
  assert.match(markup, /No kill within 2.0s/);
  assert.doesNotMatch(markup, /Longer fights favour|Final simulation results/);
});

test('comparison bounds samples by all three observation windows', () => {
  const model = comparisonModel(
    [
      { t: 1000, v: 1200 },
      { t: 2000, v: 1300 }
    ],
    [
      { t: 1000, v: 1000 },
      { t: 2000, v: 1100 }
    ],
    {
      withoutRelicDps: [
        { t: 1000, v: 900 },
        { t: 1500, v: 950 }
      ]
    }
  );
  assert.equal(model.durationMs, 1500);
  assert.deepEqual(
    model.points.map(({ tMs }) => tMs),
    [1000, 1500]
  );
  assert.equal(model.points.at(-1).samples[0].gainedDps, 250);
  assert.equal(comparisonModel([{ t: 1000, v: 1200 }], []).points.length, 0);
});

test('crossovers describe only the displayed window and retain the last crossing', () => {
  const opponent = [2000, 8000, 10000, 12000, 14000].map((t) => ({ t, v: 1000 }));
  const cases = [
    { values: [900, 1100, 1100, 1100, 1100], crossing: null },
    { values: [1100, 900, 1100, 900, 1100], crossing: 13000 },
    { values: [900, 900, 900, 900, 900], crossing: null },
    { values: [900, 1000, 1000, 1000, 1000], crossing: null }
  ];
  for (const { values, crossing } of cases) {
    const model = comparisonModel(
      opponent,
      opponent.map(({ t }, i) => ({ t, v: values[i] }))
    );
    assert.equal(model.relics[1].crossoverMs, crossing);
    assert.equal(model.evaluationStartMs, 8000);
    assert.doesNotMatch(relicComparisonChartSvg(model), /Longer fights|shorter fights|entire/);
  }
});

test('hover and keyboard inspection share a sample across tooltip and table, restoring the selection on exit', () => {
  const tooltip = { innerHTML: '', style: {} };
  const table = { innerHTML: '' };
  const svg = { getBoundingClientRect: () => ({ height: 260, left: 0, top: 0, width: 640 }) };
  const elements = {
    'relic-comparison-chart': svg,
    'relic-comparison-tooltip': tooltip,
    'relic-comparison-results': table
  };
  const container = { querySelector: (selector) => elements[selector.match(/data-role="([^"]+)"/)[1]] ?? null };
  const model = comparisonModel(
    [
      { t: 1000, v: 1000 },
      { t: 2000, v: 1200 },
      { t: 3000, v: 1300 }
    ],
    [
      { t: 1000, v: 900 },
      { t: 2000, v: 1100 },
      { t: 3000, v: 1200 }
    ],
    {
      withoutRelicDps: [
        { t: 1000, v: 800 },
        { t: 2000, v: 800 },
        { t: 3000, v: 800 }
      ]
    }
  );
  bindRelicComparisonChartHover(container, model);
  svg.onmousemove({ clientX: 341, clientY: 100 });
  assert.match(tooltip.innerHTML, /2.000s/);
  assert.match(tooltip.innerHTML, /Fractal<\/span>: 400 DPS gained/);
  assert.match(table.innerHTML, /Results at 2.0s/);
  assert.match(table.innerHTML, /1,200/);
  svg.onmouseleave();
  assert.match(table.innerHTML, /Results at 3.0s/);
  assert.equal(tooltip.style.display, 'none');
  svg.onkeydown({ key: 'Home', preventDefault() {} });
  assert.match(table.innerHTML, /Results at 1.0s/);
  svg.onmousemove({ clientX: 341, clientY: 100 });
  svg.onmouseleave();
  assert.match(table.innerHTML, /Results at 1.0s/);
});

test('multiple relics share the baseline while retaining their own crossover and direct damage', () => {
  const model = comparisonModel(
    [
      { t: 1000, v: 1000 },
      { t: 2000, v: 1000 }
    ],
    [
      { t: 1000, v: 900 },
      { t: 2000, v: 1100 }
    ],
    {
      withoutRelicDps: [
        { t: 1000, v: 800 },
        { t: 2000, v: 800 }
      ],
      extraRuns: [
        {
          relic: 'Thorns',
          dps: [
            { t: 1000, v: 1200 },
            { t: 2000, v: 1300 }
          ],
          directDps: [
            { t: 1000, v: 0 },
            { t: 2000, v: 0 }
          ],
          kill: { killTimeMs: 1900, observedMs: 1900 }
        }
      ]
    }
  );
  assert.deepEqual(
    model.points.at(-1).samples.map((sample) => sample.gainedDps),
    [200, 300, 500]
  );
  assert.equal(model.relics[1].crossoverMs, 1500);
  assert.equal(model.relics[2].crossoverMs, null);
  const markup = relicComparisonChartSvg(model);
  assert.equal([...markup.matchAll(/<polyline/g)].length, 3);
  assert.match(markup, /Relic of Thorns/);
  assert.match(markup, /1.90s/);
});

test('relic comparison preserves multiple choices and updates assumptions without running', () => {
  const runButton = {};
  const stackInput = { value: '4' };
  const stackControl = { hidden: false };
  let selected = ['Akeem', 'Thorns'];
  const listeners = [];
  const host = {
    querySelectorAll: (selector) => (selector === 'input[type="hidden"]' ? selected.map((value) => ({ value })) : []),
    addEventListener: (name, handler) => {
      if (name === 'change') listeners.push(handler);
    }
  };
  let cleared = 0;
  const elements = {
    'relic-comparison-run': runButton,
    'relic-comparison-stacks': stackInput,
    'relic-comparison-stacks-control': stackControl,
    'relic-comparison-picker': host,
    'relic-comparison-output': {
      replaceChildren() {
        cleared++;
      }
    }
  };
  const container = {
    ...inertContainer(),
    querySelector: (selector) => elements[selector.match(/data-role="([^"]+)"/)[1]] ?? null
  };
  let run;
  const selections = [];
  mountRelicComparison(
    container,
    {
      relicComparisonAvailable: true,
      relicComparisonOpponent: 'Fractal',
      relicComparisonSelected: selected,
      relicComparisonTargets: ['Akeem', 'Mirage', 'Thorns'],
      relicComparisonInitialStacks: 4
    },
    (relics, stacks) => {
      run = { relics, stacks };
    },
    (relics, stacks) => {
      selections.push([relics, stacks]);
      return true;
    }
  );
  assert.match(container.innerHTML, /Remove Akeem from comparison-relics/);
  assert.match(container.innerHTML, /Remove Thorns from comparison-relics/);
  selected = ['Akeem', 'Thorns', 'Mirage'];
  listeners.at(-1)();
  assert.equal(stackControl.hidden, false);
  assert.deepEqual(selections.at(-1), [selected, 4]);
  selected = ['Akeem', 'Mirage'];
  listeners.at(-1)();
  assert.equal(stackControl.hidden, true);
  runButton.onclick();
  assert.deepEqual(run, { relics: ['Akeem', 'Mirage'], stacks: 4 });
  selected = [];
  listeners.at(-1)();
  assert.equal(runButton.disabled, true);
  assert.equal(cleared, 3);
});

test('relic comparison orders available choices by equipment category and disables selected choices', () => {
  const container = inertContainer();
  mountRelicComparison(container, {
    relicComparisonAvailable: true,
    relicComparisonSelected: ['Thorns'],
    relicComparisonTargets: ['Akeem', 'Brawler', 'Nourys', 'Thorns']
  });
  const choices = [...container.innerHTML.matchAll(/data-choice="([^"]+)"/g)].map(([, name]) => name);
  assert.deepEqual(choices, ['Brawler', 'Akeem', 'Thorns', 'Nourys']);
  assert.match(container.innerHTML, /data-choice="Thorns" disabled/);
  assert.match(container.innerHTML, new RegExp(`data-limit="${MAX_RELIC_COMPARISON_ALTERNATIVES}"`));
});

test('comparison refuses oversized requests before starting synchronous simulation work', () => {
  let simulated = 0;
  assert.throws(
    () =>
      calculateRelicComparison(
        {
          equippedRelic: 'Fractal',
          comparisonRelics: Array.from(
            { length: MAX_RELIC_COMPARISON_ALTERNATIVES + 1 },
            (_, index) => `relic-${index}`
          )
        },
        {},
        () => {
          simulated++;
        }
      ),
    /at most 5 alternative relics/
  );
  assert.equal(simulated, 0);
});

test('clamped stack edits retain the chart and pending baselines keep Run disabled', () => {
  for (const { stacks, edit, pending, changed } of [
    { stacks: 10, edit: '100', pending: false, changed: false },
    { stacks: 0, edit: '', pending: false, changed: false },
    { stacks: 0, edit: '1', pending: true, changed: true }
  ]) {
    const button = { textContent: 'Run again', disabled: pending };
    const stackInput = { value: edit };
    let cleared = 0;
    let runs = 0;
    const elements = {
      'relic-comparison-run': button,
      'relic-comparison-stacks': stackInput,
      'relic-comparison-output': {
        replaceChildren() {
          cleared++;
        }
      }
    };
    const container = {
      ...inertContainer(),
      querySelector: (selector) => elements[selector.match(/data-role="([^"]+)"/)[1]] ?? null
    };
    mountRelicComparison(
      container,
      {
        relicComparisonAvailable: true,
        relicComparisonPending: pending,
        relicComparisonSelected: ['Thorns'],
        relicComparisonTargets: ['Thorns'],
        relicComparisonInitialStacks: stacks
      },
      () => {
        runs++;
      },
      (_relics, value) => Math.min(10, Math.max(0, Math.trunc(value))) !== stacks
    );
    stackInput.oninput();
    assert.equal(cleared, changed ? 1 : 0);
    assert.equal(button.textContent, changed ? 'Run comparison' : 'Run again');
    assert.equal(button.disabled, pending);

    if (pending) {
      assert.match(container.innerHTML, /data-role="relic-comparison-run" disabled/);
      button.onclick();
      assert.equal(runs, 0);
    }
  }
});
