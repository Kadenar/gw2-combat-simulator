import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_DEFINITIONS,
  comboDefinition,
  validateComboDefinitions
} from '../../../js/platform/gw2/combo-definitions.js';
import { COMBO_FIELD_TYPES, COMBO_FINISHER_TYPES } from '../../../js/platform/gw2/combo-events.js';
import { createGw2EventPreparer } from '../../../js/platform/gw2/scheduler/event-preparer.js';
import { normalizeGw2ComboCatalogSkill } from '../../../js/platform/gw2/combo-catalog.js';

const context = {
  catalog: { skillsById: new Map(), skillsByName: new Map() },
  config: {},
  state: { activeWeaponSet: 1, profession: {} },
  createActivationId: () => 'unused'
};

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

test('combo events normalize casing and clamp chance at the GW2 boundary', () => {
  const prepared = createGw2EventPreparer().prepare(context, {
    type: 'combo_finisher',
    at: 1,
    source: 'Fixture',
    sourceId: 'fixture.finisher',
    attemptId: 'attempt:1',
    finisherType: 'projectile',
    fieldBinding: { kind: 'field-type', fieldType: 'fire' },
    effectAt: 2,
    chance: 2,
    applications: 1,
    successfulCombos: 1
  });

  assert.equal(prepared.finisherType, 'Projectile');
  assert.deepEqual(prepared.fieldBinding, {
    kind: 'field-type',
    fieldType: 'Fire'
  });
  assert.equal(prepared.chance, 1);
});

test('missing bindings and invalid field lifetimes fail event validation', () => {
  const preparer = createGw2EventPreparer();
  assert.throws(
    () =>
      preparer.prepare(context, {
        type: 'combo_finisher',
        at: 1,
        source: 'Fixture',
        sourceId: 'fixture.finisher',
        attemptId: 'attempt:missing',
        finisherType: 'Blast',
        effectAt: 1,
        chance: 1,
        applications: 1,
        successfulCombos: 1
      }),
    /fieldBinding is required/
  );
  assert.throws(
    () =>
      preparer.prepare(context, {
        type: 'combo_field',
        at: 2,
        source: 'Fixture',
        sourceId: 'fixture.field',
        fieldId: 'field:invalid',
        fieldType: 'Fire',
        expiresAt: 2,
        ownerId: 'fixture',
        ownerActorType: 'player'
      }),
    /expiresAt must be later than at/
  );
});

test('catalog aliases normalize into explicit field and packet metadata', () => {
  const skill = normalizeGw2ComboCatalogSkill({
    id: 1,
    name: 'Legacy Combo Skill',
    comboField: 'fire',
    comboFieldDuration: 4,
    finisherType: 'whirl',
    finisherValue: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        metadata: { finisherType: 'projectile', finisherValue: 0.2 }
      }
    ]
  });

  assert.deepEqual(skill.comboFields, [
    {
      fieldType: 'Fire',
      duration: 4,
      startMs: 0,
      startAnchor: 'castEnd'
    }
  ]);
  assert.equal(skill.comboFinishers[0].finisherType, 'Whirl');
  assert.equal(skill.comboFinishers[0].applications, 3);
  assert.equal(skill.effects[0].comboFinishers[0].finisherType, 'Projectile');
  assert.equal(skill.effects[0].comboFinishers[0].chance, 0.2);
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
