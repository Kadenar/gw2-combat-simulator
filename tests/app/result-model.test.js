import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChartSeries, resultSummaryMetrics } from '#gw2/app/results/model.js';
import {
  formatResultTimelineTime,
  formatTimelineTime,
  resultCombatReferenceMs
} from '#gw2/app/rotation/timeline/timing/model.js';

const PLAYER_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

/** Builds a resolved player buff so chart fixtures use the runtime audience contract. */
const playerBuff = (fields) => ({ type: 'buff', resolvedAudience: PLAYER_AUDIENCE, ...fields });

test('timeline times can reuse a precomputed combat reference', () => {
  const result = {
    events: [
      { type: 'damage', at: 0.5 },
      { type: 'combat_start', at: 1.25 }
    ]
  };
  const referenceMs = resultCombatReferenceMs(result);

  assert.equal(referenceMs, 1250);
  assert.equal(formatTimelineTime(2500, referenceMs), '1.25s');
  assert.equal(formatTimelineTime(2500, referenceMs), formatResultTimelineTime(2500, result));
  assert.equal(formatTimelineTime(1249, referenceMs), '0.00s');
});

test('total idle time excludes explicit waits before combat start', () => {
  const metrics = resultSummaryMetrics({
    duration: 1,
    deathTime: null,
    events: [{ type: 'combat_start', at: 0.5 }],
    steps: [
      { ri: 0, skill: 'Wait', start: 0, end: 500, type: 'wait' },
      { ri: 1, skill: 'Combat Start', start: 500, end: 500, type: 'combat_start' },
      { ri: 2, skill: 'First Cast', start: 500, end: 600 },
      { ri: 3, skill: 'Wait', start: 600, end: 900, type: 'wait' },
      { ri: 4, skill: 'Second Cast', start: 900, end: 1000 }
    ]
  });

  assert.deepEqual(metrics[1], {
    label: 'Total Idle Time',
    value: '300ms',
    className: '',
    details: [{ label: 'Explicit waits', value: '300ms' }]
  });
});

test('profession effect descriptors supply chart labels and stack caps', () => {
  const series = buildChartSeries(
    {
      duration: 8,
      events: [
        playerBuff({
          at: 0,
          kind: 'custom-armaments',
          duration: 6
        }),
        playerBuff({
          at: 1,
          kind: 'custom-armaments',
          duration: 7
        })
      ]
    },
    1000,
    [
      {
        id: 'custom-armaments',
        kind: 'custom-armaments',
        name: 'Custom Armaments',
        maximumStacks: 1
      }
    ]
  );

  assert.deepEqual(
    series.effects['Custom Armaments'].map((point) => point.v),
    [1, 1, 1, 1, 1, 1, 1, 1, 0]
  );
});

test('generic buffs remain visible on the timed-effects chart', () => {
  const series = buildChartSeries(
    {
      duration: 3,
      events: [playerBuff({ at: 0, kind: 'custom-effect', stacks: 3, duration: 2 })]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Custom Effect'].map((point) => point.v),
    [3, 3, 0, 0]
  );
  assert.equal(series.effectTypes['Custom Effect'], 'buff');
});

test('timed relic proc chart series shows binary uptime across refreshes', () => {
  const series = buildChartSeries(
    {
      duration: 8,
      dpsStartTime: 1,
      procSteps: [
        {
          type: 'relic_proc',
          skill: 'Relic of Fireworks',
          start: 500,
          end: 500,
          expiresAt: 3500
        },
        {
          type: 'relic_proc',
          skill: 'Relic of Fireworks',
          start: 2500,
          end: 2500,
          expiresAt: 6000
        },
        {
          type: 'trait_proc',
          skill: 'Timed Trait',
          start: 1000,
          end: 1000,
          expiresAt: 7000
        },
        {
          type: 'relic_proc',
          skill: 'Relic without duration',
          start: 1000,
          end: 1000
        }
      ]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Relic of Fireworks'].map((point) => point.v),
    [1, 1, 1, 1, 1, 0, 0, 0]
  );
  assert.equal(series.effectTypes['Relic of Fireworks'], 'buff');
  assert.equal(series.effects['Timed Trait'], undefined);
  assert.equal(series.effects['Relic without duration'], undefined);
});

test('chart series classify boons, conditions, and profession buffs', () => {
  const series = buildChartSeries(
    {
      duration: 2,
      resolvedEvents: [
        {
          type: 'condition',
          at: 0,
          condition: 'burning',
          duration: 2,
          stacks: 1
        }
      ],
      events: [
        playerBuff({ at: 0, kind: 'might', duration: 2 }),
        playerBuff({
          at: 0,
          kind: 'custom-effect',
          duration: 2
        })
      ]
    },
    1000
  );

  assert.deepEqual(series.effectTypes, {
    Burning: 'condition',
    Might: 'boon',
    'Custom Effect': 'buff'
  });
});

test('duration-stacking boon charts show remaining stacked seconds', () => {
  const series = buildChartSeries(
    {
      duration: 7,
      events: [
        playerBuff({ at: 0, kind: 'quickness', duration: 3 }),
        playerBuff({ at: 1, kind: 'quickness', duration: 3 }),
        playerBuff({ at: 0, kind: 'alacrity', duration: 2 }),
        playerBuff({ at: 3, kind: 'alacrity', duration: 2 }),
        playerBuff({ at: 0, kind: 'fury', duration: 3 }),
        playerBuff({ at: 1, kind: 'fury', duration: 3 }),
        playerBuff({ at: 0, kind: 'protection', duration: 3 }),
        playerBuff({ at: 1, kind: 'protection', duration: 3 }),
        playerBuff({ at: 0, kind: 'vigor', duration: 3 }),
        playerBuff({ at: 1, kind: 'vigor', duration: 3 }),
        playerBuff({ at: 0, kind: 'swiftness', duration: 3 }),
        playerBuff({ at: 1, kind: 'swiftness', duration: 3 })
      ]
    },
    1000
  );

  assert.deepEqual(
    series.effects.Quickness.map((point) => point.v),
    [3, 5, 4, 3, 2, 1, 0, 0]
  );
  assert.deepEqual(
    series.effects.Alacrity.map((point) => point.v),
    [2, 1, 0, 2, 1, 0, 0, 0]
  );
  for (const name of ['Fury', 'Protection', 'Vigor', 'Swiftness']) {
    assert.deepEqual(
      series.effects[name].map((point) => point.v),
      [3, 5, 4, 3, 2, 1, 0, 0],
      name
    );
  }

  assert.deepEqual(series.effectUnits, {
    Quickness: 's',
    Alacrity: 's',
    Fury: 's',
    Protection: 's',
    Vigor: 's',
    Swiftness: 's'
  });
});

test('duration-stacking boon charts discard grants above the 30-second cap', () => {
  const series = buildChartSeries(
    {
      duration: 32,
      events: [
        playerBuff({ at: 0, kind: 'quickness', duration: 29 }),
        playerBuff({ at: 1, kind: 'quickness', duration: 5 })
      ]
    },
    1000
  );

  assert.equal(series.effects.Quickness[1].v, 30);
  assert.equal(series.effects.Quickness[30].v, 1);
  assert.equal(series.effects.Quickness[31].v, 0);
});

test('Swiftness duration stacking caps at 60 seconds', () => {
  const series = buildChartSeries(
    {
      duration: 62,
      events: [
        playerBuff({ at: 0, kind: 'swiftness', duration: 59 }),
        playerBuff({ at: 1, kind: 'swiftness', duration: 5 })
      ]
    },
    1000
  );

  assert.equal(series.effects.Swiftness[1].v, 60);
  assert.equal(series.effects.Swiftness[60].v, 1);
  assert.equal(series.effects.Swiftness[61].v, 0);
});

test('chart series excludes buffs that do not affect the simulated player', () => {
  const series = buildChartSeries({
    duration: 2,
    events: [
      {
        type: 'buff',
        at: 0,
        kind: 'pet-only-quickness',
        duration: 2,
        resolvedAudience: {
          includesSelf: false,
          includesSummons: true,
          alliedPlayerCount: 0,
          companionIds: ['ranger-pet:1'],
          recipientCount: 1
        }
      }
    ]
  });

  assert.equal(series.effects['Pet Only Quickness'], undefined);
});
