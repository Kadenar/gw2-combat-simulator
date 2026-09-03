import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindRelicComparisonChartHover,
  relicComparisonChartSvg
} from '#gw2/app/presentation/results/charts/relic-comparison.js';
import {
  CROSSOVER_EVALUATION_START_MS,
  buildRelicComparisonModel,
  relicComparisonAvailable
} from '#gw2/app/simulation/relic-comparison.js';

test('break-even chart hover shows the time and both relic DPS values', () => {
  const tooltip = { innerHTML: '', style: {} };
  const svg = {
    getBoundingClientRect: () => ({ height: 260, left: 0, top: 0, width: 640 })
  };
  const container = {
    querySelector: (selector) =>
      selector === '[data-role="relic-comparison-chart"]'
        ? svg
        : selector === '[data-role="relic-comparison-tooltip"]'
          ? tooltip
          : null
  };
  const model = {
    opponentRelic: 'Fractal',
    targetRelic: 'Akeem',
    durationMs: 2000,
    points: [
      { tMs: 0, opponentDps: 1000, targetDps: 900 },
      { tMs: 2000, opponentDps: 1200, targetDps: 1100 }
    ],
    crossoverMs: null,
    targetAlwaysAhead: false,
    evaluationStartMs: 0,
    opponentFinalDps: 1200,
    targetFinalDps: 1100
  };

  bindRelicComparisonChartHover(container, model);
  svg.onmousemove({ clientX: 341, clientY: 100 });

  assert.match(tooltip.innerHTML, /1\.00s/);
  assert.match(tooltip.innerHTML, /Relic of Fractal: 1,100 DPS/);
  assert.match(tooltip.innerHTML, /Relic of Akeem: 1,000 DPS/);
  assert.equal(tooltip.style.display, 'block');
  assert.match(relicComparisonChartSvg(model), /Relic of Akeem does not overtake Relic of Fractal/);
  assert.doesNotMatch(relicComparisonChartSvg(model), /Thorns/);
});

test('relic comparison requires two distinct relics', () => {
  assert.equal(relicComparisonAvailable('Fractal', 'Thorns'), true);
  assert.equal(relicComparisonAvailable('Thorns', 'Akeem'), true);
  assert.equal(relicComparisonAvailable('Thorns', 'Thorns'), false);
  assert.equal(relicComparisonAvailable('', 'Krait'), false);
  assert.equal(relicComparisonAvailable(null, 'Krait'), false);
});

test('break-even model interpolates the crossover where Thorns overtakes the opponent', () => {
  // Opponent flat at 1000; Thorns ramps 900 -> 1100 across the window. They are
  // equal at t=2000ms (index 2), so the crossover interpolates to exactly 2s.
  const opponentDps = [
    { t: 0, v: 1000 },
    { t: 1000, v: 1000 },
    { t: 2000, v: 1000 },
    { t: 3000, v: 1000 },
    { t: 4000, v: 1000 }
  ];
  const thornsDps = [
    { t: 0, v: 900 },
    { t: 1000, v: 950 },
    { t: 2000, v: 1000 },
    { t: 3000, v: 1050 },
    { t: 4000, v: 1100 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Fractal',
    targetRelic: 'Thorns',
    durationMs: 4000,
    opponentDps,
    targetDps: thornsDps
  });

  assert.equal(model.opponentRelic, 'Fractal');
  assert.equal(model.targetRelic, 'Thorns');
  assert.equal(model.points.length, 5);
  assert.equal(model.crossoverMs, 2000);
  assert.equal(model.targetAlwaysAhead, false);
  assert.equal(model.opponentFinalDps, 1000);
  assert.equal(model.targetFinalDps, 1100);
});

test('break-even model treats an early tie then lead as "always ahead", not a crossover', () => {
  // Thorns is tied before its Condition Damage ramps (t=0), then pulls ahead and
  // never falls behind. That is not an "overtake" — the opponent never leads.
  const opponentDps = [
    { t: 0, v: 1000 },
    { t: 1000, v: 1000 },
    { t: 2000, v: 1000 }
  ];
  const thornsDps = [
    { t: 0, v: 1000 },
    { t: 1000, v: 1040 },
    { t: 2000, v: 1090 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Fractal',
    targetRelic: 'Thorns',
    durationMs: 2000,
    opponentDps,
    targetDps: thornsDps
  });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.targetAlwaysAhead, true);
});

test('break-even model interpolates a crossover between samples', () => {
  // Thorns passes the opponent halfway between 1000ms and 2000ms.
  const opponentDps = [
    { t: 0, v: 1000 },
    { t: 1000, v: 1000 },
    { t: 2000, v: 1000 }
  ];
  const thornsDps = [
    { t: 0, v: 800 },
    { t: 1000, v: 900 },
    { t: 2000, v: 1100 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Akeem',
    targetRelic: 'Thorns',
    durationMs: 2000,
    opponentDps,
    targetDps: thornsDps
  });

  // delta goes -100 -> +100 across [1000, 2000]; zero crossing at the midpoint.
  assert.equal(model.crossoverMs, 1500);
});

test('break-even model ignores leading no-damage samples (no spurious t=0 crossover)', () => {
  // buildChartSeries emits a { t: 0, v: 0 } sample before the first hit. Both
  // curves are 0 there, which must not be treated as a crossover.
  const opponentDps = [
    { t: 0, v: 0 },
    { t: 1000, v: 1000 },
    { t: 2000, v: 1000 }
  ];
  const thornsDps = [
    { t: 0, v: 0 },
    { t: 1000, v: 900 },
    { t: 2000, v: 1100 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Fractal',
    targetRelic: 'Thorns',
    durationMs: 2000,
    opponentDps,
    targetDps: thornsDps
  });

  assert.equal(model.points.length, 2);
  assert.equal(model.points[0].tMs, 1000);
  assert.equal(model.crossoverMs, 1500);
});

test('break-even model ignores an opponent lead confined to the opener', () => {
  // Opponent leads only before the evaluation threshold; past it Thorns is
  // always ahead, so the early crossing must not be reported.
  assert.ok(CROSSOVER_EVALUATION_START_MS >= 5000);
  const opponentDps = [
    { t: 2000, v: 1000 },
    { t: 6000, v: 1000 },
    { t: 8000, v: 1000 },
    { t: 10000, v: 1000 },
    { t: 12000, v: 1000 }
  ];
  const thornsDps = [
    { t: 2000, v: 900 },
    { t: 6000, v: 950 },
    { t: 8000, v: 1010 },
    { t: 10000, v: 1050 },
    { t: 12000, v: 1100 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Fractal',
    targetRelic: 'Thorns',
    durationMs: 12000,
    opponentDps,
    targetDps: thornsDps
  });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.targetAlwaysAhead, true);
});

test('break-even model reports a crossover that occurs past the opener threshold', () => {
  const opponentDps = [
    { t: 2000, v: 1000 },
    { t: 8000, v: 1000 },
    { t: 10000, v: 1000 },
    { t: 12000, v: 1000 }
  ];
  const thornsDps = [
    { t: 2000, v: 1200 }, // Thorns "ahead" in the opener — ignored
    { t: 8000, v: 900 },
    { t: 10000, v: 1000 },
    { t: 12000, v: 1100 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Akeem',
    targetRelic: 'Thorns',
    durationMs: 12000,
    opponentDps,
    targetDps: thornsDps
  });

  // Last opponent lead is at 8000ms; crossing interpolates to 10000ms.
  assert.equal(model.crossoverMs, 10000);
  assert.equal(model.targetAlwaysAhead, false);
});

test('break-even model reports no crossover when Thorns never catches up', () => {
  const opponentDps = [
    { t: 0, v: 1000 },
    { t: 1000, v: 1000 }
  ];
  const thornsDps = [
    { t: 0, v: 800 },
    { t: 1000, v: 950 }
  ];
  const model = buildRelicComparisonModel({
    opponentRelic: 'Fractal',
    targetRelic: 'Thorns',
    durationMs: 1000,
    opponentDps,
    targetDps: thornsDps
  });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.targetAlwaysAhead, false);
});
