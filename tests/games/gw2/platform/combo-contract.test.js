import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMBO_DEFINITIONS,
  comboDefinition,
  materializeComboOutcome,
  validateComboDefinitions
} from '#gw2/platform/combos/definitions.js';
import {
  createGw2ComboRuntimeState,
  isComboFieldActiveAt,
  registerComboField,
  resolveComboAttempt,
  selectComboFieldForFinisher
} from '#gw2/platform/combos/resolution.js';
import { COMBO_FIELD_TYPES, COMBO_FINISHER_TYPES } from '#gw2/platform/combos/types.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { normalizeEffect } from '#gw2/platform/effects/validation.js';
import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';
import { bindRuntimeCombo, produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

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
  // The active producer and impact-time binding must carry the summon's own scaling into combo outcomes.
  const { effects, events } = captureEffectEmissions();
  const runtime = { combo: state, effects };
  produceRuntimeCombos(runtime, createCanonicalCatalog(), {
    type: 'damage',
    at: 1,
    source: 'ranger-pet',
    sourceId: 'fixture.pet-projectile',
    actorType: 'summon',
    eventOrder: 1,
    coefficient: 1,
    comboFinishers: [{ ownerId: 'ranger', finisherType: 'Projectile' }],
    independentSummonStrike: true,
    independentConditionOwner: true,
    summonOwner: 'ranger-pet:1:0',
    summonBasePower: 1524,
    summonBaseConditionDamage: 1000,
    summonBaseExpertise: 375,
    summonUsesProfessionModifiers: true
  });
  assert.equal(events.length, 1);
  const finisher = bindRuntimeCombo(runtime, events[0]);
  assert.deepEqual(finisher.fieldBinding, { kind: 'field-id', fieldId: 'field:poison' });
  const [combo] = resolveComboAttempt(state, finisher, {
    roll: () => true,
    warn: () => {}
  });
  const [poison] = materializeComboOutcome(combo);
  for (const event of [finisher, combo, poison]) {
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
    comboFields: [{ ownerId: 'fixture', fieldType: 'fire', duration: 4 }],
    effects: [{ type: 'strike', coefficient: 1 }]
  });

  assert.deepEqual(skill.comboFields, [
    {
      ownerId: 'fixture',
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
        comboFields: [{ ownerId: 'fixture', fieldType: 'Fire', duration: 0 }]
      }),
    /positive duration/
  );
});

// Ownership is required at every declaration location, including effects that bypass the skill normalizer.
test('combo declarations reject missing, blank, and non-string ownership before catalog use', () => {
  for (const ownerId of [undefined, null, '', '  ', 0, 42, {}, []]) {
    for (const [field, descriptor] of [
      ['comboFields', { ownerId, fieldType: 'Fire', duration: 4 }],
      ['comboFinishers', { ownerId, finisherType: 'Blast' }]
    ]) {
      const metadata = { [field]: [descriptor] };
      const skill = { id: 1, name: 'Ownership fixture', ...metadata };
      assert.throws(() => normalizeGw2ComboCatalogSkill(skill), /Skill 1.*ownerId must be a non-empty string/);
      assert.throws(() => createCanonicalCatalog({ generated: [skill] }), /Skill 1.*ownerId/);
      assert.throws(
        () => normalizeGw2ComboCatalogSkill({ id: 1, effects: [{ type: 'strike', coefficient: 1, ...metadata }] }),
        /ownerId/
      );
      assert.throws(
        () =>
          createCanonicalCatalog({
            balanceProfiles: [
              {
                id: 'fixture.profile',
                name: 'Profile',
                profileKind: 'mechanic',
                effects: [{ type: 'strike', coefficient: 1, ...metadata }]
              }
            ]
          }),
        /profile=fixture.profile.*ownerId/
      );
      assert.throws(() => normalizeEffect({ type: 'custom', eventType: 'damage', event: metadata }), /event.*ownerId/);
    }

    const comboFinishers = [{ ownerId, finisherType: 'Blast' }];
    for (const effect of [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1, comboFinishers }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Burning', stacks: 1, duration: 1, comboFinishers }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]) {
      assert.throws(() => normalizeEffect(effect), /tick=1.*ownerId/);
      assert.throws(() => normalizeGw2ComboCatalogSkill({ id: 1, effects: [effect] }), /ownerId/);
    }
  }
});

test('runtime combo declarations fail loudly instead of discarding unowned entries', () => {
  const catalog = createCanonicalCatalog();
  const event = { type: 'damage', at: 0, source: 'Fixture', sourceId: 1, actorType: 'player', coefficient: 1 };
  for (const field of ['comboFields', 'comboFinishers']) {
    for (const descriptor of [
      null,
      [],
      { fieldType: 'Fire', duration: 4, finisherType: 'Blast' },
      { ownerId: ' ', fieldType: 'Fire', duration: 4, finisherType: 'Blast' }
    ]) {
      const { effects, events } = captureEffectEmissions();
      assert.throws(
        () => produceRuntimeCombos({ effects }, catalog, { ...event, [field]: [descriptor] }),
        new RegExp(`damage skill=1 ${field} entry 1`)
      );
      assert.equal(events.length, 0);
    }
  }

  // A declared owner survives materialization so subsequent finishers can select the field.
  const { effects, events } = captureEffectEmissions();
  produceRuntimeCombos({ effects }, catalog, {
    ...event,
    comboFields: [{ ownerId: 'fixture', fieldType: 'Fire', duration: 4 }]
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'combo_field');
  assert.equal(events[0].ownerId, 'fixture');
});

// Audit all production skills, profiles, ticks, and custom packet payloads, including every specialization.
for (const entry of professionRegistry) {
  test(`${entry.name} production combo descriptors declare the profession owner`, async () => {
    const { catalog } = await entry.loadProfession();
    let descriptors = 0;
    const visit = (value, path) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'comboFields' || key === 'comboFinishers') {
          assert.ok(Array.isArray(child), `${path}.${key}`);
          for (const descriptor of child) {
            assert.equal(descriptor.ownerId, entry.id, `${path}.${key} ownerId`);
            descriptors++;
          }
        }

        visit(child, `${path}.${key}`);
      }
    };

    visit(catalog.skills, 'skills');
    visit(catalog.balanceProfiles, 'balanceProfiles');
    assert.ok(descriptors > 0);
  });
}
