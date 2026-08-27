import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROSSOVER_EVALUATION_START_MS,
  RELIC_COMPARISON_TARGET,
  THORNS_COMPARISON_OPPONENTS,
  buildRelicComparisonModel,
  relicComparisonAvailable
} from '../../js/games/gw2/app/simulation/relic-comparison.js';

test('relic comparison is offered only for allowlisted opponents, never Thorns itself', () => {
  assert.equal(RELIC_COMPARISON_TARGET, 'Thorns');
  assert.ok(THORNS_COMPARISON_OPPONENTS.has('Fractal'));
  assert.ok(THORNS_COMPARISON_OPPONENTS.has('Akeem'));
  assert.equal(relicComparisonAvailable('Fractal'), true);
  assert.equal(relicComparisonAvailable('Akeem'), true);
  assert.equal(relicComparisonAvailable('Thorns'), false);
  assert.equal(relicComparisonAvailable('Krait'), false);
  assert.equal(relicComparisonAvailable(''), false);
  assert.equal(relicComparisonAvailable(null), false);
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
  const model = buildRelicComparisonModel({ opponentRelic: 'Fractal', durationMs: 4000, opponentDps, thornsDps });

  assert.equal(model.opponentRelic, 'Fractal');
  assert.equal(model.targetRelic, 'Thorns');
  assert.equal(model.points.length, 5);
  assert.equal(model.crossoverMs, 2000);
  assert.equal(model.thornsAlwaysAhead, false);
  assert.equal(model.opponentFinalDps, 1000);
  assert.equal(model.thornsFinalDps, 1100);
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
  const model = buildRelicComparisonModel({ opponentRelic: 'Fractal', durationMs: 2000, opponentDps, thornsDps });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.thornsAlwaysAhead, true);
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
  const model = buildRelicComparisonModel({ opponentRelic: 'Akeem', durationMs: 2000, opponentDps, thornsDps });

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
  const model = buildRelicComparisonModel({ opponentRelic: 'Fractal', durationMs: 2000, opponentDps, thornsDps });

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
  const model = buildRelicComparisonModel({ opponentRelic: 'Fractal', durationMs: 12000, opponentDps, thornsDps });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.thornsAlwaysAhead, true);
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
  const model = buildRelicComparisonModel({ opponentRelic: 'Akeem', durationMs: 12000, opponentDps, thornsDps });

  // Last opponent lead is at 8000ms; crossing interpolates to 10000ms.
  assert.equal(model.crossoverMs, 10000);
  assert.equal(model.thornsAlwaysAhead, false);
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
  const model = buildRelicComparisonModel({ opponentRelic: 'Fractal', durationMs: 1000, opponentDps, thornsDps });

  assert.equal(model.crossoverMs, null);
  assert.equal(model.thornsAlwaysAhead, false);
});
