import { createMesmerActions } from '#gw2/professions/mesmer/family-mechanics.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

function fixture() {
  const config = { specialization: 'Core', primaryWeapon: 'Sword' };
  const profession = mesmerProfession.runtimeFor(config);
  const cancelled = [];
  const scheduled = [];
  const context = {
    config,
    traits: new Set(),
    helpers: profession.catalog,
    profession: profession.createState(config),
    time: 0,
    activeWeaponSet: 1,
    combat: { warn() {} },
    effects: captureEffectEmissions().effects,
    schedule: (type, at, data, owner) => scheduled.push({ type, at, data, owner }),
    cancelOwner: (owner) => cancelled.push(owner.id)
  };
  return { context, cancelled, scheduled };
}

// Rebinding through a different capability identity preserves one run's clone owner sequence without sharing another run.
test('explicit Mesmer operations preserve clone identity across replacement, shatter, and interleaved runs', () => {
  const first = fixture();
  const second = fixture();
  const gain = (context, count) => createMesmerIllusionRewards(context).gainResources(0, count, 'Sword');
  gain(first.context, 3);
  gain(second.context, 1);
  gain({ ...first.context }, 1);
  assert.deepEqual(
    first.context.profession.core.clones.map((clone) => clone.id),
    [2, 3, 4]
  );
  assert.deepEqual(
    second.context.profession.core.clones.map((clone) => clone.id),
    [1]
  );
  assert.deepEqual(first.cancelled, ['mesmer.clone:1']);
  assert.equal(createMesmerActions({ ...first.context }).consumeResources(0), 3);
  gain({ ...first.context }, 1);
  assert.deepEqual(
    first.context.profession.core.clones.map((clone) => clone.id),
    [5]
  );
  assert.deepEqual(first.cancelled, ['mesmer.clone:1', 'mesmer.clone:2', 'mesmer.clone:3', 'mesmer.clone:4']);
  assert.deepEqual(first.scheduled.at(-1).owner, { id: 'mesmer.clone:5', generation: 0 });
  assert.equal(second.context.profession.core.cloneSequence, 1);
});
