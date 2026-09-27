import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_DEFINITIONS,
  comboDefinition,
  materializeComboOutcome,
  validateComboDefinitions
} from '#gw2/platform/combos/definitions.js';
import {
  COMBO_FIELD_TYPES,
  COMBO_FINISHER_TYPES,
  createGw2ComboRuntimeState,
  isComboFieldActiveAt,
  registerComboField,
  resolveComboAttempt,
  selectComboFieldForFinisher
} from '#gw2/platform/combos/events.js';
import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';
import { enqueueGw2OwnedComboFinisher } from '#gw2/platform/resolver/combo-resolution.js';

test('combo field boundaries use exact canonical instants', () => {
  // Ordinary fields are half-open while explicit inclusivity retains only the exact expiry instant.
  const field = { at: 1, expiresAt: 2 };
  assert.equal(isComboFieldActiveAt(field, 0.999999), false);
  assert.equal(isComboFieldActiveAt(field, 1), true);
  assert.equal(isComboFieldActiveAt(field, 1.999999), true);
  assert.equal(isComboFieldActiveAt(field, 2), false);
  assert.equal(isComboFieldActiveAt({ ...field, inclusiveExpiry: true }, 2), true);
  assert.equal(isComboFieldActiveAt({ ...field, inclusiveExpiry: true }, 2.000001), false);
  assert.equal(isComboFieldActiveAt({ ...field, at: 0.1 + 0.2 }, 0.3), true);
});

test('the universal combo table defines every field/finisher pair once', () => {
  assert.equal(COMBO_DEFINITIONS.length, 36);
  assert.equal(
    new Set(COMBO_DEFINITIONS.map(({ fieldType, finisherType }) => `${fieldType}|${finisherType}`)).size,
    36
  );
  for (const fieldType of COMBO_FIELD_TYPES) {
    for (const finisherType of COMBO_FINISHER_TYPES) {
      assert.equal(comboDefinition(fieldType, finisherType).fieldType, fieldType);
    }
  }

  assert.throws(() => validateComboDefinitions(COMBO_DEFINITIONS.slice(1)), /all 36 field\/finisher pairs/);
});

test('owned-field selection breaks timestamp ties by event order and preserves equal-key order', () => {
  // Callers may supply fields in either order; identical sort keys retain input order.
  const first = { at: 1, eventOrder: 1, fieldType: 'Fire' };
  const second = { ...first, eventOrder: 2 };
  assert.equal(selectComboFieldForFinisher([second, first]).field, first);
  assert.equal(selectComboFieldForFinisher([first, second]).field, first);
  const tied = { ...first };
  assert.equal(selectComboFieldForFinisher([tied, first]).field, tied);
});

test('combo outcomes retain summon condition scaling from the finisher', () => {
  const state = createGw2ComboRuntimeState();
  registerComboField(state, {
    type: 'combo_field',
    at: 0,
    source: 'Ranger',
    sourceId: 'fixture.poison-field',
    actorType: 'player',
    fieldId: 'field:poison',
    fieldType: 'Poison',
    expiresAt: 5,
    ownerId: 'ranger',
    ownerActorType: 'player'
  });
  const [combo] = resolveComboAttempt(
    state,
    {
      type: 'combo_finisher',
      at: 1,
      effectAt: 1,
      source: 'ranger-pet',
      sourceId: 'fixture.pet-projectile',
      actorType: 'summon',
      attemptId: 'attempt:summon',
      finisherType: 'Projectile',
      fieldBinding: { kind: 'field-id', fieldId: 'field:poison' },
      chance: 1,
      applications: 1,
      successfulCombos: 1,
      independentSummonStrike: true,
      independentConditionOwner: true,
      summonOwner: 'ranger-pet:1:0',
      summonBasePower: 1524,
      summonBaseConditionDamage: 1000,
      summonBaseExpertise: 375,
      summonUsesProfessionModifiers: true
    },
    { roll: () => true, warn: () => {} }
  );
  const [poison] = materializeComboOutcome(combo);

  // Resolver-authored follow-up finishers must retain the same independent caster too.
  let followup;
  enqueueGw2OwnedComboFinisher({ combo: state, queue: { enqueue: (event) => (followup = event) } }, poison, {
    ownerId: 'ranger',
    attemptId: 'attempt:followup',
    finisherType: 'Projectile'
  });
  const [followupCombo] = resolveComboAttempt(state, followup, {
    roll: () => true,
    warn: () => {}
  });
  for (const event of [combo, poison, followup, ...materializeComboOutcome(followupCombo)]) {
    assert.equal(event.independentConditionOwner, true);
    assert.equal(event.summonOwner, 'ranger-pet:1:0');
    assert.equal(event.summonBaseConditionDamage, 1000);
  }

  assert.deepEqual(
    [poison.actorType, poison.independentSummonStrike, poison.summonBaseConditionDamage, poison.summonBaseExpertise],
    ['summon', true, 1000, 375]
  );
});

test('catalog combo field descriptors normalize and validate explicit metadata', () => {
  const skill = normalizeGw2ComboCatalogSkill({
    id: 1,
    name: 'Explicit Combo Field Skill',
    comboFields: [{ fieldType: 'fire', duration: 4 }],
    effects: [{ type: 'strike', coefficient: 1 }]
  });

  assert.deepEqual(skill.comboFields, [
    {
      fieldType: 'Fire',
      duration: 4,
      startMs: 0,
      startAnchor: 'castStart'
    }
  ]);
  assert.throws(
    () =>
      normalizeGw2ComboCatalogSkill({
        id: 2,
        name: 'Invalid Field',
        comboFields: [{ fieldType: 'Fire', duration: 0 }]
      }),
    /positive duration/
  );
});
