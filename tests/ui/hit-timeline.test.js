import assert from 'node:assert/strict';
import test from 'node:test';

import { drawHitTimeline, filterHitsToPhase, groupSkillHits } from '#ui/results/charts/hit-timeline.js';
import { buildChartSeries } from '#gw2/app/results/charts/time-series-model.js';

// Burst grouping must preserve every hit and its activation through chart projection and phase filtering.
test('chart projection preserves activation ownership across burst grouping and phase boundaries', () => {
  const series = buildChartSeries(
    {
      dpsStartTime: 1,
      deathTime: 5,
      resolvedEvents: [
        { type: 'damage', at: 1, damage: 10, activationId: 'cast:1' },
        { type: 'damage', at: 2, damage: 20, activationId: 'cast:2' },
        { type: 'damage', at: 3, damage: 30, activationId: 'cast:1' },
        { type: 'damage', at: 3, damage: 40 },
        { type: 'damage', at: 3, damage: 50 },
        {
          type: 'condition',
          at: 3,
          damageTicks: [
            { at: 3, damage: 5 },
            { at: 4, damage: 5 }
          ]
        }
      ]
    },
    250,
    { skillKey: () => 'skill' }
  );
  const hits = series.skillDamage.skill;
  assert.deepEqual(
    groupSkillHits(hits).map((group) => group.map((hit) => hit.v)),
    [
      [10, 20, 30, 40, 50],
      [5, 5]
    ]
  );
  assert.equal(hits[0].activationId, hits[2].activationId);
  assert.notEqual(hits[0].activationId, hits[1].activationId);
  const phase = filterHitsToPhase(hits, 1000, 3000);
  assert.deepEqual(
    phase.filter((hit) => hit.activationId === 'cast:1').map((hit) => hit.t),
    [1000]
  );
  assert.equal(
    phase.some((hit) => hit.t === 2000),
    false
  );
  assert.deepEqual(
    groupSkillHits([
      { t: 0, v: 0 },
      { t: 1, v: 1 },
      { t: 1, v: 2 }
    ]).map((group) => group.length),
    [2]
  );
});

// Continuous ticks must split at fixed boundaries, retain damage, and never join separate strike bursts.
test('condition windows preserve damage kind and stay aligned through phase filtering', () => {
  const series = buildChartSeries(
    {
      dpsStartTime: 0,
      deathTime: 12,
      resolvedEvents: [
        { type: 'damage', at: 0.1, damage: 10, activationId: 'cast:1' },
        { type: 'damage', at: 9.1, damage: 20, activationId: 'cast:2' },
        {
          type: 'condition',
          at: 0,
          activationId: 'cast:1',
          damageTicks: Array.from({ length: 12 }, (_, at) => ({ at, damage: 5 }))
        },
        { type: 'condition', at: 11.5, damage: 7, didCrit: false }
      ]
    },
    250,
    { skillKey: () => 'skill' }
  );
  const hits = series.skillDamage.skill;
  const groups = groupSkillHits(hits);
  assert.deepEqual(
    groups.map((group) => group.map((hit) => hit.t)),
    [[100], [9100], [0, 1000, 2000, 3000, 4000], [5000, 6000, 7000, 8000, 9000], [10_000, 11_000, 11_500]]
  );
  assert.equal(
    groups.flat().reduce((sum, hit) => sum + hit.v, 0),
    97
  );
  assert.ok(
    groups
      .slice(0, 2)
      .flat()
      .every((hit) => hit.damageType === 'strike')
  );
  assert.ok(
    groups
      .slice(2)
      .flat()
      .every((hit) => hit.damageType === 'condition' && hit.crit === null)
  );
  const phase = filterHitsToPhase(hits, 2300, 10_800);
  const conditionGroups = groupSkillHits(phase, 2300).filter((group) => group[0].damageType === 'condition');
  assert.deepEqual(
    conditionGroups.map((group) => group.map((hit) => hit.t + 2300)),
    [[3000, 4000], [5000, 6000, 7000, 8000, 9000], [10_000]]
  );
  assert.deepEqual(groupSkillHits([{ t: 0, v: 0, damageType: 'condition' }]), []);
});

// Nearby activations form one burst; a larger gap starts another without splitting a cast's packets.
test('repeated skill uses merge across gaps up to 1.5 seconds', () => {
  const hits = [
    { t: 1600, v: 2, activationId: 'cast:1' },
    { t: 0, v: 1, activationId: 'cast:1' },
    { t: 1200, v: 3, activationId: 'cast:2' },
    { t: 2700, v: 4, activationId: 'cast:3' },
    { t: 4200, v: 5, activationId: 'cast:4' },
    { t: 5701, v: 6, activationId: 'cast:5' }
  ];
  assert.deepEqual(
    groupSkillHits(hits).map((group) => group.map((hit) => hit.t)),
    [[0, 1200, 1600, 2700, 4200], [5701]]
  );
  assert.equal(hits[0].t, 1600);
  assert.deepEqual(groupSkillHits([]), []);
});

// A multi-hit activation gets one label while every damage marker remains drawn.
test('cast labels stagger without overlap and keep fight timestamps', () => {
  for (const showAxis of [true, false]) {
    const labels = [];
    let strokes = 0;
    const context = {
      setTransform() {},
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        strokes += 1;
      },
      measureText: (text) => ({ width: text.length * 6 }),
      fillText: (text, x, y) => labels.push({ text, x, y })
    };
    const canvas = {
      parentElement: { clientWidth: 400 },
      style: {},
      getContext: () => context,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400 })
    };
    const hits = [0, 1600, 1610, 1620, 10_000].map((t) => ({
      t,
      v: 100,
      activationId: t > 0 && t < 2000 ? 'cast:2' : `cast:${t}`
    }));
    const layout = drawHitTimeline(canvas, hits, 10_000, { showAxis, timeOffsetMs: 5000 });
    const timestamps = labels.filter(({ text }) => text.includes('hit'));
    assert.deepEqual(
      timestamps.map(({ text }) => text),
      ['5.00s · 1 hit', '6.60s · 3 hits', '15.00s · 1 hit']
    );
    assert.equal(strokes, hits.length + 1);
    assert.notEqual(timestamps[0].y, timestamps[1].y);
    for (const label of timestamps) {
      assert.ok(label.x >= 0);
      assert.ok(label.x + context.measureText(label.text).width <= layout.cssWidth);
      assert.ok(label.y + 10 <= layout.height);
      for (const previous of timestamps.filter(
        (other) => other !== label && other.y === label.y && other.x <= label.x
      )) {
        assert.ok(previous.x + context.measureText(previous.text).width + 4 <= label.x);
      }
    }
  }
});
