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
  registerComboField,
  resolveComboAttempt
} from '#gw2/platform/combos/events.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { createGw2EventPreparer } from '#gw2/platform/scheduler/event-preparer.js';
import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';

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
      summonBasePower: 1524,
      summonBaseConditionDamage: 1000,
      summonBaseExpertise: 375,
      summonUsesProfessionModifiers: true
    },
    { stochastic: false, roll: () => true, warn: () => {} }
  );
  const [poison] = materializeComboOutcome(combo);

  assert.deepEqual(
    [poison.actorType, poison.independentSummonStrike, poison.summonBaseConditionDamage, poison.summonBaseExpertise],
    ['summon', true, 1000, 375]
  );
});

test('area combo boons use party targeting and can reach a summon', () => {
  const state = createGw2ComboRuntimeState();
  registerComboField(state, {
    type: 'combo_field',
    at: 0,
    source: 'Fixture Fire Field',
    sourceId: 'fixture.fire-field',
    actorType: 'effect',
    fieldId: 'field:fire',
    fieldType: 'Fire',
    expiresAt: 5,
    ownerId: 'fixture',
    ownerActorType: 'player'
  });
  const finisher = prepareGw2BuffCompanionCandidates(
    {
      type: 'combo_finisher',
      at: 1,
      effectAt: 1,
      source: 'Fixture Blast',
      sourceId: 'fixture.blast',
      actorType: 'player',
      attemptId: 'attempt:blast',
      finisherType: 'Blast',
      fieldBinding: { kind: 'field-id', fieldId: 'field:fire' },
      chance: 1,
      applications: 1,
      successfulCombos: 1
    },
    ['summon:one']
  );
  const [combo] = resolveComboAttempt(state, finisher, {
    stochastic: false,
    roll: () => true,
    warn: () => {}
  });
  const [areaMight] = materializeComboOutcome(combo);
  const prepared = createGw2EventPreparer().prepare(
    { ...context, config: { allies: { count: 0 }, sharePlayerBoonsWithSummons: true } },
    areaMight
  );

  assert.equal(areaMight.audience.recipients, 'party');
  assert.equal(areaMight.audience.maximumRecipients, 5);
  assert.equal(prepared.resolvedAudience.includesSummons, true);
  assert.equal(prepared.resolvedAudience.recipientCount, 2);
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
