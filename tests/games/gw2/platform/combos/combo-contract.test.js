import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';
import {
  COMBO_DEFINITIONS,
  comboDefinition,
  comboOutcomeRequests,
  validateComboDefinitions
} from '#gw2/platform/combos/definitions.js';
import { createGw2ComboController } from '#gw2/platform/combos/resolution.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { COMBO_FIELD_TYPES, COMBO_FINISHER_TYPES } from '#gw2/platform/combos/types.js';
import { createGw2ComboResolution } from '#gw2/platform/resolver/combo-resolution.js';
import { buildBoonGeneration } from '#gw2/platform/results/boon-generation.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createCatalogNormalizer } from '#gw2/platform/skills/validation.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

const { normalizeEffect } = createCatalogNormalizer(createCanonicalCatalog());

// Field fixtures exercise lifecycle through the same owner used by delivery and mechanics.
function field(fieldId, overrides = {}) {
  return {
    type: 'combo_field',
    at: 1,
    expiresAt: 2,
    fieldId,
    fieldType: 'Fire',
    ownerId: 'fixture',
    ownerActorType: 'player',
    actorType: 'player',
    source: 'Fixture',
    sourceId: 'fixture.field',
    skillId: 1,
    ...overrides
  };
}

function finisher(attemptId, overrides = {}) {
  return {
    type: 'combo_finisher',
    at: 1,
    effectAt: 1,
    attemptId,
    fieldId: null,
    comboAutoSelectField: true,
    comboOwnerId: 'fixture',
    finisherType: 'Projectile',
    chance: 1,
    applications: 1,
    successfulCombos: 1,
    actorType: 'player',
    source: 'Fixture',
    sourceId: 'fixture.finisher',
    ...overrides
  };
}

test('combo observations preserve canonical field expiry and explicit inclusivity', () => {
  const combo = createGw2ComboController();
  combo.register(field('ordinary'));
  combo.register(field('inclusive', { inclusiveExpiry: true }));
  const active = (at) => combo.activeFields('fixture', at).map((field) => field.fieldId);
  assert.deepEqual(active(0.999999), []);
  assert.deepEqual(active(1), ['ordinary', 'inclusive']);
  assert.deepEqual(active(1.999999), ['ordinary', 'inclusive']);
  assert.deepEqual(active(2), ['inclusive']);
  assert.deepEqual(active(2.000001), []);
  combo.register(field('fractional', { at: 0.1 + 0.2 }));
  assert.equal(combo.bind(finisher('fractional', { at: 0.3 })).fieldId, 'fractional');
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

test('combo binding preserves event order and stable registration ties', () => {
  for (const ids of [
    ['second', 'first'],
    ['first', 'second']
  ]) {
    const combo = createGw2ComboController();
    for (const id of ids) combo.register(field(id, { eventOrder: id === 'first' ? 1 : 2 }));
    assert.equal(combo.bind(finisher('ordered')).fieldId, 'first');
  }

  const combo = createGw2ComboController();
  combo.register(field('tied-first', { eventOrder: 1 }));
  combo.register(field('tied-second', { eventOrder: 1 }));
  assert.equal(combo.bind(finisher('tied')).fieldId, 'tied-first');
});

test('combo binding selects owned fields by priority then age and honors explicit bindings', () => {
  const combo = createGw2ComboController();
  assert.equal(combo.bind(finisher('empty')).fieldId, null);
  combo.register(field('foreign', { at: 0, ownerId: 'other', comboBindingPriority: 10 }));
  combo.register(field('ice', { at: 1, fieldType: 'Ice' }));
  combo.register(field('fire', { at: 0 }));
  assert.equal(combo.bind(finisher('oldest')).fieldId, 'fire');
  combo.register(field('priority', { fieldType: 'Ice', comboBindingPriority: 1, activationId: 'own' }));
  assert.equal(combo.bind(finisher('priority')).fieldId, 'priority');
  assert.equal(combo.bind(finisher('exclude', { activationId: 'own', comboExcludeOwnField: true })).fieldId, 'fire');
  assert.equal(combo.bind(finisher('explicit', { fieldId: 'ice', comboAutoSelectField: false })).fieldId, 'ice');
});

test('combo registration and observations detach nested data and preserve historical expiry', () => {
  const combo = createGw2ComboController();
  const registered = field('stored', { audience: { recipients: 'summons', eligibleCompanionIds: ['pet'] } });
  combo.register(registered);
  registered.expiresAt = 99;
  registered.audience.eligibleCompanionIds.push('caller');
  const observation = combo.fieldFor(1, 1);
  assert.equal(observation.expiresAt, 2);
  assert.deepEqual(observation.audience.eligibleCompanionIds, ['pet']);
  observation.expiresAt = 99;
  observation.audience.eligibleCompanionIds.push('observation');
  const active = combo.activeFields('fixture', 1);
  active[0].ownerId = 'changed';
  active[0].audience.eligibleCompanionIds.push('active');
  active.length = 0;
  assert.equal(combo.bind(finisher('unmodified')).fieldId, 'stored');
  assert.deepEqual(combo.fieldFor(1, 1).audience.eligibleCompanionIds, ['pet']);
  const earlier = combo.fieldFor(1, 1);
  combo.expireField('stored', 1.5);
  assert.equal(earlier.expiresAt, 2);
  assert.equal(combo.fieldFor(1, 1).expiresAt, 1.5);
  assert.deepEqual(combo.activeFields('fixture', 1.5), []);
  assert.equal(combo.bind(finisher('historical', { at: 1.75, fieldSelectionAt: 1.25 })).fieldId, 'stored');
  // An ineligible historical binding would throw instead of resolving.
  const attempt = combo.bind(finisher('historical', { at: 1.75, fieldSelectionAt: 1.25 }));
  assert.equal(combo.resolve(attempt, { roll: () => true }).length, 1);
  combo.expireField('missing', 0);
  assert.equal(combo.fieldFor(99, 1), undefined);
  assert.equal(combo.fieldFor(1, undefined), undefined);
  assert.deepEqual(createGw2ComboController().activeFields('fixture', 1), []);
});

test('combo attempts claim before rolls can reenter resolution', () => {
  const combo = createGw2ComboController();
  combo.register(field('stored'));
  const accepted = combo.bind(finisher('accepted'));
  let rolls = 0;
  const options = {
    roll() {
      rolls += 1;
      assert.deepEqual(combo.resolve(accepted, options), []);
      return true;
    }
  };
  assert.equal(combo.resolve(accepted, options).length, 1);
  assert.equal(rolls, 1);
});

test('combo outcomes retain summon condition scaling from the finisher', () => {
  const state = createGw2ComboController();
  state.register({
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
  assert.equal(events[0].comboAutoSelectField, true);
  assert.equal(events[0].fieldId, null);
  const finisher = state.bind(events[0]);
  assert.deepEqual(finisher.fieldId, 'field:poison');
  const [combo] = state.resolve(finisher, { roll: () => true });
  const [request] = comboOutcomeRequests(combo);
  assert.equal(request.kind, 'packet');
  const poison = request.event;
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

for (const [fieldType, finisherType] of [
  ['Lightning', 'Blast'],
  ['Water', 'Whirl'],
  ['Water', 'Projectile']
]) {
  test(`${fieldType} ${finisherType} grants retain one complete yield per combo`, () => {
    // Repeated applications belong to their finisher; a later finisher establishes the repeat interval.
    const combo = createGw2ComboController();
    const { effects, events } = captureEffectEmissions();
    const context = { combo, effects, random: { roll: () => true }, warnings: [] };
    const handlers = createGw2ComboResolution({ controller: combo, reactions: { dispatch() {} } });
    const base = { source: 'Fixture', sourceId: 'finisher', actorType: 'player', skillName: 'Finisher' };
    handlers.combo_field(context, {
      ...base,
      type: 'combo_field',
      at: 0,
      fieldId: 'field',
      fieldType,
      expiresAt: 100,
      ownerId: 'fixture',
      ownerActorType: 'player'
    });
    for (const at of [0, 20, 40])
      handlers.combo_finisher(context, {
        ...base,
        type: 'combo_finisher',
        at,
        effectAt: at,
        fieldId: 'field',
        attemptId: `finisher:${at}`,
        finisherType,
        chance: 1,
        applications: 2,
        successfulCombos: 1
      });
    assert.deepEqual(context.warnings, []);
    const outcome = comboDefinition(fieldType, finisherType).outcome;
    const grants = events.filter((event) => event.type === 'buff');
    assert.ok(grants.every((event) => event.name === outcome.name && event.sourceId !== base.sourceId));
    assert.ok(grants.every((event) => event.source === base.source));
    assert.ok(grants.every((event) => event.actorType === base.actorType && event.parentSkillName === base.skillName));
    // Skill grants between combos must not split the combo's repeat intervals or share its source row.
    for (const at of [5, 25, 45])
      effects.emit({
        kind: 'profile',
        at,
        profile: { id: base.sourceId, name: base.skillName },
        attribution: base,
        effects: [{ type: 'boon', boon: outcome.boon, duration: 1, audience: { recipients: 'party' } }]
      });
    const generation = buildBoonGeneration(events, 0, 50);
    const estimate = generation.sustained[outcome.boon.toLowerCase()];
    for (const audience of ['self', 'ally']) {
      assert.equal(estimate[audience].status, 'available');
      assert.equal(estimate[audience].intervals, 4);
      assert.equal(estimate[audience].sources.length, 2);
      const comboSource = estimate[audience].sources.find((source) => source.name === outcome.name);
      assert.equal(comboSource.intervals, 2);
      assert.equal(comboSource.percent, ((2 * outcome.duration * outcome.stacks) / 20) * 100);
      assert.equal(estimate[audience].sources.find((source) => source.name === base.skillName).percent, 5);
    }
  });
}

test('combo descriptors require canonical field and finisher type names', () => {
  // Obsolete generic type keys must not silently supply the required combo vocabulary.
  for (const [key, descriptor, message] of [
    ['comboFields', { ownerId: 'fixture', type: 'Fire', duration: 4 }, /Invalid combo field type/],
    ['comboFinishers', { ownerId: 'fixture', type: 'Blast' }, /Invalid combo finisher type/]
  ]) {
    assert.throws(() => normalizeGw2ComboCatalogSkill({ id: 1, [key]: [descriptor] }), message);
  }
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
      assert.throws(() => createCanonicalCatalog({ skills: [skill] }), /Skill 1.*ownerId/);
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
                effects: [{ type: 'strike', coefficient: 1, ...metadata }]
              }
            ]
          }),
        /profile=fixture.profile.*ownerId/
      );
      assert.throws(
        () => normalizeEffect({ type: 'custom', eventType: 'damage', event: metadata }, 'Skill effect'),
        /event.*ownerId/
      );
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
      assert.throws(() => normalizeEffect(effect, 'Skill effect'), /tick=1.*ownerId/);
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
