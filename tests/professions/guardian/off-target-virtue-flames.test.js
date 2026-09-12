import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

const config = {
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, vitality: 1000 },
  target: { armor: 2597 },
  specialization: 'Willbender',
  boons: { quickness: true, alacrity: true },
  selectedTraitIds: [TRAIT.RESTORATIVE_VIRTUES, TRAIT.TYRANTS_MOMENTUM]
};
const wait = { type: 'wait', durationMs: 6000 };
const run = (rotation, overrides = {}) =>
  simulateGw2({ profession: guardianProfession, config: { ...config, ...overrides }, rotation });
const flames = (r) => r.events.filter((e) => e.type === 'damage' && e.willbenderFlames);

test('two off-target Resolve precasts keep two Tempo applications and deal zero target damage', () => {
  const r = run([
    { name: 'Flowing Resolve', offTarget: true },
    { name: 'Flowing Resolve', offTarget: true },
    { name: '__combat_start' },
    wait
  ]);
  assert.deepEqual(r.warnings, []);
  assert.ok(flames(r).some((e) => e.at > r.combatStartTime));
  assert.equal(r.totalDamage, 0);
  assert.ok(flames(r).every((e) => e.offTarget === true));
  assert.deepEqual(
    r.procSteps.filter((e) => e.skill === 'Lethal Tempo').map((e) => e.detail),
    ['1/5 stacks', '2/5 stacks']
  );
  assert.equal(r.endState.ammo['Flowing Resolve'].charges, 0);
  assert.equal(r.resolvedEvents.filter((e) => e.type === 'damage' || e.type === 'condition').length, 0);
});

test('off-target virtue flames also keep Searing Pact conditions off target', () => {
  for (const name of ['Rushing Justice', 'Flowing Resolve', 'Crashing Courage']) {
    const r = run([{ name, offTarget: true }, { name: '__combat_start' }, wait], {
      selectedTraitIds: [TRAIT.SEARING_PACT]
    });
    assert.deepEqual(r.warnings, []);
    const burning = r.events.filter((e) => e.type === 'condition' && e.skillName === 'Searing Pact');
    assert.ok(burning.length > 0, name);
    assert.equal(r.totalDamage, 0, name);
    assert.ok(
      burning.every((e) => e.offTarget === true),
      name
    );
    assert.equal(r.resolvedEvents.filter((e) => e.type === 'damage' || e.type === 'condition').length, 0, name);
  }
});

test('an on-target Resolve cast does not make a previous off-target field start hitting', () => {
  const r = run([{ name: 'Flowing Resolve', offTarget: true }, { name: '__combat_start' }, 'Flowing Resolve', wait]);
  // Group each field's ticks by activation to keep off-target and on-target ownership separate.
  const fields = Map.groupBy(flames(r), (event) => event.activationId);

  assert.equal(fields.size, 2);
  const groups = [...fields.values()].sort((a, b) => a[0].at - b[0].at);
  assert.ok(groups[0].every((e) => e.offTarget === true));
  assert.ok(groups[1].every((e) => e.offTarget !== true));
  const hits = r.resolvedEvents.filter((e) => e.type === 'damage' && e.willbenderFlames);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((e) => e.activationId === groups[1][0].activationId));
  assert.ok(r.totalDamage > 0);
});

test('ordinary on-target virtue casts and flame activations still deal damage', () => {
  for (const name of ['Rushing Justice', 'Flowing Resolve', 'Crashing Courage']) {
    const r = run([name, wait]);
    assert.deepEqual(r.warnings, []);
    assert.ok(flames(r).length > 0);
    assert.ok(flames(r).every((e) => e.offTarget !== true));
    assert.ok(r.resolvedEvents.some((e) => e.type === 'damage' && e.willbenderFlames && e.damage > 0));
    assert.ok(r.totalDamage > 0);
  }
});
