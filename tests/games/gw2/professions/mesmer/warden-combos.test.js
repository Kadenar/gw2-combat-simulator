// Warden finishers follow field coverage and keep independent entry bonuses for each summon cycle.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createDefaultConfig, runMesmer } from '#tests/helpers/mesmer-simulation.js';

const rotation = ['Phantasmal Warden', { type: 'wait', durationMs: 15000 }];
const field = {
  type: 'combo_field',
  at: 0,
  expiresAt: 30,
  source: 'Fixture',
  sourceId: 'fixture.field',
  actorType: 'player',
  ownerActorType: 'player',
  ownerId: 'mesmer',
  fieldId: 'field:first',
  fieldType: 'Ethereal'
};

function run(fields = [], overrides = {}) {
  return runMesmer(
    rotation,
    { ...createDefaultConfig(), specialization: 'Core', initialResource: 0, ...overrides },
    {
      initialize(runtime) {
        for (const event of fields) runtime.effects.emit({ kind: 'packet', event });
      }
    }
  );
}

function wardenHits(result) {
  return result.events.filter((event) => event.type === 'damage' && event.skillId === ID.PHANTASMAL_WARDEN);
}

function wardenCombos(result) {
  return result.resolvedEvents.filter((event) => event.type === 'combo' && event.skillId === ID.PHANTASMAL_WARDEN);
}

test('Warden whirls once per covered attack and once more for each new field', () => {
  const noField = run();
  const hits = wardenHits(noField);
  assert.ok(hits.length > 2);
  assert.deepEqual(wardenCombos(noField), []);
  const fields = [
    field,
    { ...field, at: (hits[0].at + hits[1].at) / 2, fieldId: 'field:second' },
    { ...field, at: (hits[1].at + hits[2].at) / 2, fieldId: 'field:third' }
  ];
  for (const count of [1, 2, 3]) {
    const result = run(fields.slice(0, count));
    const combos = wardenCombos(result);
    assert.equal(combos.length, hits.length + count);
    assert.ok(
      combos.every(
        (event) => event.finisherType === 'Whirl' && event.actorType === 'summon' && event.summonKind === 'phantasm'
      )
    );
    assert.ok(combos.every((event) => hits.some((hit) => hit.at === event.at)));
    assert.equal(
      result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.comboId && event.skillId === ID.PHANTASMAL_WARDEN
      ).length,
      combos.length
    );
    assert.deepEqual(result.warnings, []);
  }
});

test('Warden starts whirling in a late field and stops at its expiry', () => {
  const hits = wardenHits(run());
  const at = hits[1].at;
  const expiresAt = hits.at(-1).at;
  const result = run([{ ...field, at, expiresAt }]);
  const combos = wardenCombos(result);
  assert.equal(combos.length, hits.filter((hit) => hit.at >= at && hit.at < expiresAt).length + 1);
  assert.ok(combos.every((event) => event.at >= at && event.at < expiresAt));
  assert.equal(combos.filter((event) => event.at === at).length, 2);
  assert.deepEqual(result.warnings, []);
});

test('Chronophantasma gives its repeated Warden an independent field-entry bonus', () => {
  const result = run([field], { specialization: 'Chronomancer', selectedTraitIds: [TRAIT.CHRONOPHANTASMA] });
  const hits = wardenHits(result);
  const resummonedAt = result.events.find((event) => event.type === 'mesmer.phantasm-resummoned').at;
  for (const repeat of [false, true]) {
    const cycleHits = hits.filter((event) => event.at >= resummonedAt === repeat);
    const cycleCombos = wardenCombos(result).filter((event) => event.at >= resummonedAt === repeat);
    assert.ok(cycleHits.length > 0);
    assert.equal(cycleCombos.length, cycleHits.length + 1);
    assert.equal(cycleCombos.filter((event) => event.at === cycleHits[0].at).length, 2);
  }

  assert.deepEqual(result.warnings, []);
});

test('Warden field bonuses deduplicate by summon cycle and field while preserving ownership and expiry', () => {
  // Synthetic bonus requests isolate deduplication from the skill's ordinary whirl declarations.
  const result = runMesmer(
    [{ type: 'wait', durationMs: 5000 }],
    { ...createDefaultConfig(), specialization: 'Core', initialResource: 0 },
    {
      initialize(runtime) {
        for (const event of [
          { ...field, fieldId: 'fire', fieldType: 'Fire', expiresAt: 3 },
          { ...field, at: 1.5, fieldId: 'ethereal', expiresAt: 4 },
          { ...field, fieldId: 'foreign', ownerId: 'another-owner' }
        ])
          runtime.effects.emit({ kind: 'packet', event });
        for (const [at, cycle] of [
          [1, 'first'],
          [2, 'first'],
          [2, 'second'],
          [3, 'first'],
          [4, 'first']
        ]) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'mesmer.warden-whirl',
              at,
              priority: -0.75,
              source: 'Phantasm',
              sourceId: ID.PHANTASMAL_WARDEN,
              skillId: ID.PHANTASMAL_WARDEN,
              actorType: 'summon',
              summonKind: 'phantasm',
              attemptId: cycle
            }
          });
        }
      }
    }
  );
  const combos = wardenCombos(result);
  assert.deepEqual(
    combos.map((event) => [event.at, event.fieldId]),
    [
      [1, 'fire'],
      [2, 'ethereal'],
      [2, 'fire'],
      [2, 'ethereal']
    ]
  );
  assert.equal(new Set(combos.map((event) => event.comboId)).size, combos.length);
  assert.ok(combos.every((event) => event.actorType === 'summon' && event.summonKind === 'phantasm'));
  assert.deepEqual(result.warnings, []);
});
