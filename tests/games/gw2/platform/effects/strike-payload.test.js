// Shared formula fields preserve authored overrides while packet emission owns deep detachment.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { copyStrikePayload, strikePayloadNumericKeys } from '#gw2/platform/effects/strike-payload.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { assertSimulationEvent } from '#gw2/platform/events/events.js';

const attribution = { source: 'Fixture', sourceId: 1, actorType: 'player' };
const materialize = (effect) =>
  materializeSkillEffectApplications({
    skill: { id: 1, name: 'Fixture' },
    effect,
    start: 0,
    fullEnd: 0,
    baseEvent: attribution
  }).map(({ event }) => event);

test('scalar payload copies only declared fields and preserves explicit zero and false', () => {
  const source = {
    weaponStrength: 0,
    flatDamage: 0,
    flatStrikeBase: 0,
    flatStrikePowerCoeff: 0,
    flatStrikeMultiplier: 0,
    flatStrikeHealthThreshold: 0,
    flatStrikeThresholdMultiplier: 0,
    independentSummonStrike: false,
    summonUsesProfessionModifiers: false,
    summonInheritsAttributes: false,
    summonInheritsCriticalAttributes: false,
    canCrit: false,
    forceCrit: false
  };
  const packet = {};
  copyStrikePayload({ ...source, coefficient: 9, hits: 9, name: 'excluded', metadata: {} }, packet);
  assert.deepEqual(packet, source);
  copyStrikePayload({ weaponStrength: null, flatDamage: undefined, canCrit: null }, packet);
  assert.deepEqual(packet, source);
  packet.flatDamage = 12;
  assert.equal(source.flatDamage, 0);
});

test('effect inheritance and tick overrides preserve defaults and whole-array combo replacement', () => {
  const effect = {
    type: 'strike',
    coefficient: 2,
    flatDamage: 12,
    canCrit: true,
    summonInheritsAttributes: true,
    metadata: { blade: true, cloneId: 1 },
    comboFinishers: [{ type: 'projectile', owner: 'player' }]
  };
  const [aggregate] = materialize(effect);
  assert.equal(aggregate.flatDamage, 12);
  assert.equal(aggregate.coefficient, 2);
  const [overridden, inherited] = materialize({
    ...effect,
    ticks: [
      {
        atMs: 0,
        coefficient: 3,
        flatDamage: 0,
        canCrit: false,
        summonInheritsAttributes: false,
        metadata: { blade: false },
        comboFinishers: []
      },
      { atMs: 0, coefficient: 4, flatDamage: null, canCrit: undefined }
    ]
  });
  assert.equal(overridden.coefficient, 3);
  assert.equal(overridden.flatDamage, 0);
  assert.equal(overridden.canCrit, false);
  assert.equal(overridden.summonInheritsAttributes, false);
  assert.deepEqual(overridden.metadata, { blade: false, cloneId: 1 });
  assert.deepEqual(overridden.comboFinishers, []);
  assert.equal(inherited.flatDamage, 12);
  assert.equal(inherited.canCrit, true);
  assert.deepEqual(inherited.comboFinishers, effect.comboFinishers);
  assert.equal(materialize({ type: 'strike', coefficient: 1 })[0].canCrit, true);
});

test('authored numeric validation still visits every variant and tick while procedural admission remains permissive', () => {
  for (const field of strikePayloadNumericKeys) {
    for (const value of [null, '1', NaN, Infinity]) {
      for (const effect of [
        { type: 'strike', coefficient: 1, [field]: value },
        { type: 'strike', ticks: [{ atMs: 0, coefficient: 1, [field]: value }] },
        { type: 'condition', condition: 'Burning', stacks: 1, duration: 1, [field]: value },
        { type: 'condition', ticks: [{ atMs: 0, condition: 'Burning', stacks: 1, duration: 1, [field]: value }] }
      ])
        assert.throws(() => normalizeSkillEffects([effect], 'Fixture'), /finite number/);
    }
  }

  const packet = { ...attribution, type: 'damage', at: 0, coefficient: 1, flatStrikeMultiplier: null };
  assert.equal(assertSimulationEvent(packet), packet);
  assert.throws(() => assertSimulationEvent({ ...packet, weaponStrength: null }), /weaponStrength must be finite/);
  assert.throws(
    () => assertSimulationEvent({ ...packet, coefficient: undefined }),
    /finite coefficient or flat strike/
  );
});

test('profile emissions detach nested caller metadata, authored declarations, and sibling packets', () => {
  const submitted = [];
  const service = createEffectEmissionService({
    expansionBudget: createEffectExpansionBudget(),
    now: () => 0,
    registerReaction: () => undefined,
    submit(event) {
      submitted.push(event);
      return event;
    },
    announce() {
      throw new Error('unexpected announcement');
    }
  });
  const effect = {
    type: 'strike',
    coefficient: 1,
    metadata: { authored: { values: [1] } },
    comboFinishers: [{ type: 'projectile', owner: 'player', chance: 1 }]
  };
  const profile = { id: 1, name: 'Fixture', effects: [effect] };
  const caller = { ...attribution, metadata: { caller: { values: [2] } } };
  service.emit({ kind: 'profile', profile, attribution: caller });
  service.emit({ kind: 'profile', profile, attribution: caller });
  caller.metadata.caller.values[0] = 99;
  submitted[0].metadata.authored.values[0] = 88;
  submitted[0].metadata.caller.values[0] = 77;
  submitted[0].comboFinishers[0].chance = 0;
  assert.deepEqual(submitted[1].metadata, { authored: { values: [1] }, caller: { values: [2] } });
  assert.equal(submitted[1].comboFinishers[0].chance, 1);
  assert.deepEqual(effect.metadata, { authored: { values: [1] } });
  assert.equal(effect.comboFinishers[0].chance, 1);
});
