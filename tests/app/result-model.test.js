import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChartSeries,
  formatResultTimelineTime,
  formatTimelineTime,
  resultCombatReferenceMs
} from '../../js/app/rotation/result/model.js';

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

test('Empowered Armaments chart series remains capped at one stack', () => {
  const series = buildChartSeries(
    {
      duration: 8,
      events: [
        {
          type: 'buff',
          at: 0,
          kind: 'guardian-empowered-armaments',
          duration: 6
        },
        {
          type: 'buff',
          at: 1,
          kind: 'guardian-empowered-armaments',
          duration: 7
        }
      ]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Empowered Armaments'].map((point) => point.v),
    [1, 1, 1, 1, 1, 1, 1, 1, 0]
  );
});

test('Elemental Empowerment chart series includes emitted stacks and caps at ten', () => {
  const series = buildChartSeries(
    {
      duration: 3,
      events: [
        {
          type: 'buff',
          at: 0,
          kind: 'elemental empowerment',
          stacks: 3,
          duration: 15
        },
        {
          type: 'buff',
          at: 1,
          kind: 'elemental empowerment',
          stacks: 8,
          duration: 15
        }
      ]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Elemental Empowerment'].map((point) => point.v),
    [3, 10, 10, 10]
  );
});

test('generic buffs remain visible on the timed-effects chart', () => {
  const series = buildChartSeries(
    {
      duration: 3,
      events: [{ type: 'buff', at: 0, kind: 'taste-for-blood', stacks: 3, duration: 2 }]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Taste for Blood'].map((point) => point.v),
    [3, 3, 0, 0]
  );
  assert.equal(series.effectTypes['Taste for Blood'], 'buff');
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
        { type: 'buff', at: 0, kind: 'might', duration: 2 },
        {
          type: 'buff',
          at: 0,
          kind: 'guardian-empowered-armaments',
          duration: 2
        }
      ]
    },
    1000
  );

  assert.deepEqual(series.effectTypes, {
    Burning: 'condition',
    Might: 'boon',
    'Empowered Armaments': 'buff'
  });
});

test('duration-stacking boon charts show remaining stacked seconds', () => {
  const series = buildChartSeries(
    {
      duration: 7,
      events: [
        { type: 'buff', at: 0, kind: 'quickness', duration: 3 },
        { type: 'buff', at: 1, kind: 'quickness', duration: 3 },
        { type: 'buff', at: 0, kind: 'alacrity', duration: 2 },
        { type: 'buff', at: 3, kind: 'alacrity', duration: 2 },
        { type: 'buff', at: 0, kind: 'fury', duration: 3 },
        { type: 'buff', at: 1, kind: 'fury', duration: 3 },
        { type: 'buff', at: 0, kind: 'protection', duration: 3 },
        { type: 'buff', at: 1, kind: 'protection', duration: 3 },
        { type: 'buff', at: 0, kind: 'vigor', duration: 3 },
        { type: 'buff', at: 1, kind: 'vigor', duration: 3 },
        { type: 'buff', at: 0, kind: 'swiftness', duration: 3 },
        { type: 'buff', at: 1, kind: 'swiftness', duration: 3 }
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
        { type: 'buff', at: 0, kind: 'quickness', duration: 29 },
        { type: 'buff', at: 1, kind: 'quickness', duration: 5 }
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
        { type: 'buff', at: 0, kind: 'swiftness', duration: 59 },
        { type: 'buff', at: 1, kind: 'swiftness', duration: 5 }
      ]
    },
    1000
  );

  assert.equal(series.effects.Swiftness[1].v, 60);
  assert.equal(series.effects.Swiftness[60].v, 1);
  assert.equal(series.effects.Swiftness[61].v, 0);
});

test('Radiant Armaments chart series identifies the active radiant weapon', () => {
  const radiantBuff = (at, radiantWeapon) => ({
    type: 'buff',
    at,
    kind: 'guardian-radiant-armaments',
    radiantWeapon,
    duration: 10
  });
  const series = buildChartSeries(
    {
      duration: 8,
      events: [radiantBuff(0, 'hammer'), radiantBuff(2, 'staff'), radiantBuff(4, 'blade'), radiantBuff(6, 'bulwark')]
    },
    1000
  );

  assert.deepEqual(
    series.effects['Radiant Armaments (Hammer)'].map((point) => point.v),
    [1, 1, 0, 0, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(
    series.effects['Radiant Armaments (Staff)'].map((point) => point.v),
    [0, 0, 1, 1, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(
    series.effects['Radiant Armaments (Sword)'].map((point) => point.v),
    [0, 0, 0, 0, 1, 1, 0, 0, 0]
  );
  assert.deepEqual(
    series.effects['Radiant Armaments (Shield)'].map((point) => point.v),
    [0, 0, 0, 0, 0, 0, 1, 1, 1]
  );
});
