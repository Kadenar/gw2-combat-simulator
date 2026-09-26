import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const simulate = createLiveProfessionSimulator(thiefProfession, {
  target: { armor: 2597, conditions: {} },
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedTraitIds: [TRAIT.WEAKENING_STRIKES, TRAIT.DEADLY_AMBITION, TRAIT.LOTUS_TRAINING, TRAIT.LEAD_ATTACKS]
});

test('on-hit traits wait for damage and consumed Weakening Strikes stays consumed across later casts', () => {
  // Multiple casts exercise both multihit consumption and later casts after the grant is spent.
  const result = simulate('Daredevil', ['Dodge', 'Death Blossom', 'Death Blossom']);
  assert.deepEqual(result.warnings, []);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.DEATH_BLOSSOM
  );
  const weakness = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.WEAKENING_STRIKES
  );
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.DEADLY_AMBITION
  );
  assert.equal(weakness.length, 1);
  assert.equal(weakness[0].at, strikes[0].at);
  assert.equal(weakness[0].skillName, 'Weakening Strikes');
  assert.equal(poison.length, 2);
  assert.equal(poison[0].at, strikes[0].at);
  const log = simulationEventLogRows(result, null, thiefProfession);
  assert.ok(log.some((row) => row.description === 'BUFF Lotus Training x1 (6s)'));
  assert.ok(log.some((row) => row.description === 'BUFF Weakening Strikes x1 (4s)'));
  assert.ok(log.some((row) => row.description.startsWith('BUFF Lead Attacks')));
});

test('Weakening Strikes expires without a hit and a later dodge grants a fresh proc', () => {
  const expired = simulate('Daredevil', ['Dodge', { name: '__wait', waitMs: 4000 }, 'Death Blossom']);
  assert.ok(
    !expired.resolvedEvents.some((event) => event.type === 'condition' && event.sourceId === TRAIT.WEAKENING_STRIKES)
  );
  const refreshed = simulate('Daredevil', ['Dodge', 'Death Blossom', 'Dodge', 'Death Blossom']);
  assert.equal(
    refreshed.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.WEAKENING_STRIKES)
      .length,
    2
  );
});

test('cancelling before a hit does not apply poison or consume the dodge proc', () => {
  const result = simulate('Daredevil', ['Dodge', { name: 'Death Blossom', interruptMs: 1 }, 'Double Strike']);
  assert.ok(!result.resolvedEvents.some((event) => event.sourceId === TRAIT.DEADLY_AMBITION));
  const weakness = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.WEAKENING_STRIKES
  );
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.DOUBLE_STRIKE);
  assert.equal(weakness.at, strike.at);
});

test('trait conditions carry their own attribution instead of the triggering skill', () => {
  const result = simulate('Daredevil', ['Steal', 'Dodge', { name: '__wait', waitMs: 1000 }], {
    selectedTraitIds: [TRAIT.UNCATCHABLE, TRAIT.SERPENTS_TOUCH, TRAIT.DEADLY_AMBUSH]
  });
  for (const [sourceId, skillName, triggeredBy] of [
    [TRAIT.UNCATCHABLE, 'Lesser Caltrops', 'Dodge'],
    [TRAIT.SERPENTS_TOUCH, "Serpent's Touch", 'Steal'],
    [TRAIT.DEADLY_AMBUSH, 'Deadly Ambush', 'Steal']
  ]) {
    const condition = result.resolvedEvents.find((event) => event.type === 'condition' && event.sourceId === sourceId);
    assert.equal(condition.skillName, skillName);
    assert.equal(condition.triggeredBy, triggeredBy);
  }
});

test('Daredevil emits only current profile effects, including patched condition offsets', () => {
  for (const effects of [[], [{ type: 'condition', condition: 'Poisoned', atMs: 400, duration: 7, stacks: 3 }]]) {
    const result = runThief(
      ['Dodge'],
      { specialization: 'Daredevil', selectedDodge: 'Lotus Training' },
      {
        catalog: (catalog) => withProfile(catalog, TRAIT.LOTUS_TRAINING, { effects }),
        observation: { kind: 'tail', durationMs: 1000 }
      }
    );
    assert.deepEqual(result.warnings, []);
    const packets = result.events.filter(
      (event) => (event.type === 'damage' || event.type === 'condition') && event.sourceId === TRAIT.LOTUS_TRAINING
    );
    assert.equal(packets.length, effects.length);
    if (effects.length) {
      const [packet] = packets;
      assert.equal(packet.at, 0.4);
      assert.equal(packet.condition, 'Poisoned');
      assert.equal(packet.stacks, 3);
      assert.equal(packet.duration, 7);
      assert.equal(packet.skillId, ID.DODGE);
      assert.equal(packet.skillName, 'Impaling Lotus');
      assert.equal(packet.actorType, 'player');
    }
  }
});
