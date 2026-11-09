import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consumeMesmerClones,
  createMesmerClones,
  dispatchMesmerCloneAttack,
  MESMER_CLONE_ATTACK_TASK
} from '#gw2/professions/mesmer/core/mechanics/illusions/clones.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { consumeMesmerResources } from '#gw2/professions/mesmer/shatter-lifecycle.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

function fixture() {
  const config = { specialization: 'Core', primaryWeapon: 'Sword' };
  const profession = mesmerProfession.runtimeFor(config);
  const cancelled = [];
  const scheduled = [];
  const emissions = captureEffectEmissions();
  const context = {
    config,
    traits: new Set(),
    helpers: profession.catalog,
    profession: profession.createState(config),
    time: 0,
    activeWeaponSet: 1,
    combat: { warn() {} },
    effects: emissions.effects,
    schedule: (type, at, data, owner, priority) => scheduled.push({ type, at, data, owner, priority }),
    cancelOwner(owner) {
      cancelled.push(owner.id);
      for (let index = scheduled.length - 1; index >= 0; index -= 1)
        if (scheduled[index].owner?.id === owner.id) scheduled.splice(index, 1);
    }
  };
  bindTriggerPoints(context, mesmerProfession, config);
  return { context, cancelled, scheduled, emissions };
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
  assert.equal(consumeMesmerResources({ ...first.context }, 0), 3);
  gain({ ...first.context }, 1);
  assert.deepEqual(
    first.context.profession.core.clones.map((clone) => clone.id),
    [5]
  );
  assert.deepEqual(first.cancelled, ['mesmer.clone:1', 'mesmer.clone:2', 'mesmer.clone:3', 'mesmer.clone:4']);
  assert.deepEqual(first.scheduled.at(-1).owner, { id: 'mesmer.clone:5', generation: 0 });
  assert.equal(second.context.profession.core.cloneSequence, 1);
});

// Production operations own both wake paths; replacement and consumption prevent stale tasks from restarting attacks.
test('clone lifecycle schedules attacks only for live clones and retires their successors', () => {
  const { context, scheduled, emissions } = fixture();
  const [clone] = createMesmerClones(context, { at: 1, count: 1, weapon: 'Spear', maximum: 1 });
  assert.equal(clone.attackSequenceIndex, 0);
  assert.equal(emissions.events.length, 0);
  assert.equal(scheduled.length, 1);
  const first = scheduled.shift();
  assert.equal(first.type, MESMER_CLONE_ATTACK_TASK);
  assert.equal(first.data, clone.id);
  assert.deepEqual(first.owner, { id: `mesmer.clone:${clone.id}`, generation: 0 });
  context.time = first.at;
  dispatchMesmerCloneAttack(context, first.data);
  assert.equal(clone.attackSequenceIndex, 1);
  assert.ok(emissions.events.some((event) => event.type === 'damage'));
  assert.ok(emissions.events.every((event) => event.metadata.cloneId === clone.id));
  assert.equal(scheduled.length, 1);
  const successor = scheduled[0];
  assert.ok(successor.at > first.at);
  assert.deepEqual(successor.owner, first.owner);
  assert.equal(successor.priority, first.priority);

  const [replacement] = createMesmerClones(context, { at: context.time, count: 1, weapon: 'Scepter', maximum: 1 });
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].data, replacement.id);
  const beforeStale = emissions.events.length;
  context.time = successor.at;
  dispatchMesmerCloneAttack(context, clone.id);
  assert.equal(emissions.events.length, beforeStale);
  assert.equal(scheduled.length, 1);

  const replacementTask = scheduled.shift();
  context.time = replacementTask.at;
  dispatchMesmerCloneAttack(context, replacement.id);
  assert.ok(emissions.events.some((event) => event.type === 'condition' && event.metadata.cloneId === replacement.id));
  assert.equal(consumeMesmerClones(context), 1);
  assert.deepEqual(scheduled, []);
  const afterConsumption = emissions.events.length;
  dispatchMesmerCloneAttack(context, replacement.id);
  assert.equal(emissions.events.length, afterConsumption);
  assert.deepEqual(scheduled, []);
  assert.equal(consumeMesmerClones(context), 0);
});
