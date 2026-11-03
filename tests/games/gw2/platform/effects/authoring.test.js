import assert from 'node:assert/strict';
import test from 'node:test';

import { strikeEffectCoefficient, strikeEffectTicks, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import { MAX_EFFECT_EXPANSION } from '#gw2/platform/effects/expansion-budget.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';

// Equivalent declarations must keep their formula total, while repeated applications each own a full coefficient.
test('aggregate strike coefficients agree with equivalent explicit timelines', () => {
  for (const [declaration, expected] of [
    [{ type: 'strike', coefficient: 1.8 }, 1.8],
    [{ type: 'strike', coefficient: 1.8, hits: 3, atMs: 0 }, 1.8],
    [{ type: 'strike', coefficient: 1.8, applications: 3, intervalMs: 40 }, 5.4],
    [{ type: 'strike', flatDamage: 100 }, 0]
  ]) {
    const [effect] = normalizeSkillEffects([declaration], 'aggregate fixture');
    const explicit = strikeTimeline(strikeEffectTicks(effect));
    assert.ok(Math.abs(strikeEffectCoefficient(effect) - expected) < 1e-12);
    assert.ok(Math.abs(strikeEffectCoefficient(explicit) - expected) < 1e-12);
  }
});

// A derived empty selection stays empty without weakening the authored catalog's nonempty timeline contract.
test('empty derived strike timelines have zero coefficient', () => {
  const empty = strikeTimeline([], { coefficient: 99, applications: 3 });
  assert.equal(strikeEffectCoefficient(empty), 0);
  assert.throws(() => normalizeSkillEffects([empty], 'empty fixture'), /positive safe integer/);
});

// Aggregation retains numeric validation and checks expansion bounds before traversing explicit timelines.
test('aggregate coefficient queries reject invalid numbers and excessive counts', () => {
  for (const value of [NaN, Infinity, -Infinity, '1']) {
    assert.throws(() => strikeEffectCoefficient({ type: 'strike', coefficient: value }), /finite number/);
    for (const field of ['atMs', 'coefficient'])
      assert.throws(
        () => strikeEffectCoefficient(strikeTimeline([{ atMs: 0, coefficient: 1, [field]: value }])),
        /finite number/
      );
  }

  for (const field of ['hits', 'applications']) {
    assert.equal(
      strikeEffectCoefficient({ type: 'strike', coefficient: 1, [field]: MAX_EFFECT_EXPANSION }),
      field === 'hits' ? 1 : MAX_EFFECT_EXPANSION
    );
    for (const count of [0, -1, 1.5, Infinity, MAX_EFFECT_EXPANSION + 1])
      assert.throws(
        () => strikeEffectCoefficient({ type: 'strike', coefficient: 1, [field]: count }),
        /positive safe integer/
      );
  }

  const oversized = new Array(MAX_EFFECT_EXPANSION + 1);
  Object.defineProperty(oversized, 0, { get: () => assert.fail('Oversized timeline was traversed') });
  assert.throws(() => strikeEffectCoefficient(strikeTimeline(oversized)), /positive safe integer/);
});
