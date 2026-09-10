import { StableEventQueue } from '#kernel/events/queue.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierHooks } from '#gw2/platform/combat/modifiers/rules.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import {
  applyCatalystEmpowerment,
  applyCatalystResolvedDamage
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystAttributeRules } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-and-empowerment.js';
import { createCatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystModifierRules } from '#gw2/professions/elementalist/specializations/catalyst/traits/modifiers.js';
import { createNativeApp, runNative, resolvedAndScheduledEvents } from '../../helpers/elementalist-simulation.js';

// Elemental Empowerment scales Condition Damage supplied before combat by traits and utility conversions.
test('Catalyst includes build-time derived Condition Damage in its empowerment pool', () => {
  const { app } = createNativeApp({
    lines: [
      ['Fire', '1-1-2'],
      ['Earth', '2-1-2'],
      ['Catalyst', '2-1-2']
    ],
    utility: 'Toxic Tuning Crystal',
    selectedSkills: { Utility1: 'Signet of Fire' }
  });
  const conditionDamage = app.attributeData.attributes['Condition Damage'];
  const config = elementalistAppAdapter.simulationConfig(app);

  assert.ok(conditionDamage.utility > 0);
  assert.ok(conditionDamage.traits > 0);
  assert.equal(config.catalystEmpowermentPool.conditionDamage, conditionDamage.final);
});

// The field and enhanced burst share the projectile release clock.
test('Frozen Fusillade detonates at field expiry', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Catalyst', '2-1-2']],
    weapons: ['Pistol', 'Dagger'],
    startAttunement: 'Water',
    pistolBullets: { Fire: false, Water: true, Air: false, Earth: false },
    rotation: [{ type: 'cast', skillId: elementalistCatalog.skillsByName.get('Frozen Fusillade').id }, 5000]
  });
  const field = result.events.find((event) => event.type === 'combo_field' && event.fieldType === 'Ice');
  const bleeding = result.resolvedEvents.find(
    (event) => event.skillName === 'Frozen Fusillade' && event.condition === 'Bleeding'
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(field.at, 0.32);
  assert.equal(field.expiresAt, 4.32);
  assert.equal(bleeding.at, field.expiresAt);
  assert.equal(bleeding.stacks, 5);
  assert.equal(bleeding.duration, 8);
});

// An existing field's next three impacts consume the charges armed by the later pistol cast.
test('Shattering Stone follow-ups use hit order across already-scheduled attacks', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Catalyst', '2-1-2']],
    weapons: ['Pistol', 'Dagger'],
    startAttunement: 'Earth',
    pistolBullets: { Fire: false, Water: false, Air: false, Earth: true },
    rotation: ['Deploy Jade Sphere (Earth)', 'Shattering Stone', 4000]
  });
  const followups = result.resolvedEvents.filter(
    (event) => event.skillName === 'Shattering Stone' && event.condition === 'Bleeding' && event.duration === 5
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(followups.length, 3);
  for (const [index, event] of followups.entries()) {
    assert.ok(Math.abs(event.at - (index + 1)) < 0.001);
    assert.equal(event.stacks, 1);
  }
});

// Spending an earth bullet adds a ten-second trigger window, leaving the base Bleeding unchanged.
test('Shattering Stone keeps its base Bleeding and expires unused follow-up charges', () => {
  for (const earthBullet of [false, true]) {
    const result = runNative({
      lines: [['Fire'], ['Earth'], ['Catalyst', '2-1-2']],
      weapons: ['Pistol', 'Dagger'],
      startAttunement: 'Earth',
      pistolBullets: { Fire: false, Water: false, Air: false, Earth: earthBullet },
      rotation: ['Shattering Stone', 11000, 'Piercing Pebble']
    });
    const applications = result.resolvedEvents.filter(
      (event) => event.skillName === 'Shattering Stone' && event.condition === 'Bleeding'
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      applications.map(({ stacks, duration }) => ({ stacks, duration })),
      [{ stacks: 3, duration: 10 }]
    );
    const buffs = result.events.filter((event) => event.kind === 'shattering stone');
    assert.deepEqual(
      buffs.map(({ stacks, duration }) => ({ stacks, duration })),
      earthBullet ? [{ stacks: 3, duration: 10 }] : []
    );
  }
});

// A scheduled aura and a resolved combo each pay their aura traits once across both phases.
test('Catalyst grants one aura and one set of trait stacks per aura source', () => {
  for (const [startAttunement, rotation] of [
    ['Water', ['Vapor Blade', 'Frost Aura', 1000]],
    ['Fire', ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000]]
  ]) {
    const result = runNative({
      lines: [
        ['Air', '1-1-1'],
        ['Earth', '1-1-1'],
        ['Catalyst', '1-1-2']
      ],
      weapons: ['Dagger', 'Dagger'],
      startAttunement,
      rotation
    });
    const events = resolvedAndScheduledEvents(result);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.profession.activeAuras.length, 1);
    assert.equal(result.profession.elementalEmpowermentExpiries.length, 4);
    assert.equal(
      events
        .filter((event) => event.type === 'buff' && event.kind === 'empowering auras')
        .reduce((total, event) => total + event.stacks, 0),
      1
    );
  }
});

// The channel can trigger its Water aura whether it loads or consumes an ice bullet.
test('Frigid Flurry can finish combos with either initial ice-bullet state', () => {
  for (const waterBullet of [false, true]) {
    const result = runNative({
      lines: [['Fire'], ['Earth'], ['Catalyst', '1-1-2']],
      weapons: ['Pistol', 'Dagger'],
      startAttunement: 'Water',
      pistolBullets: { Fire: false, Water: waterBullet, Air: false, Earth: false },
      rotation: ['Deploy Jade Sphere (Water)', 'Frigid Flurry', 1000]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.profession.activeAuras.length, 1);
    assert.equal(result.profession.activeAuras[0].type, 'Frost Aura');
    assert.equal(result.profession.elementalEmpowermentExpiries.length, 4);
  }
});

// These unit checks exercise Catalyst state and catalog behavior directly so
// their expectations do not depend on a saved full rotation.
test('Elemental Empowerment tracks all ten stacks in its timed pool', () => {
  const state = createCatalystState();
  const context = {
    profession: {
      specialization: { kind: 'Catalyst', state }
    }
  };

  for (let index = 1; index <= 11; index += 1) {
    applyCatalystEmpowerment(context, {
      type: 'buff',
      at: index,
      kind: 'elemental empowerment',
      stacks: 1,
      duration: 20,
      resolvedAudience: {
        includesSelf: true,
        includesSummons: false,
        alliedPlayerCount: 0,
        companionIds: [],
        recipientCount: 1
      }
    });
  }

  assert.deepEqual(state.elementalEmpowermentExpiries, [22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);

  const attributes = catalystAttributeRules.modifyAttributes(
    {
      traits: new Set(['Elemental Empowerment', 'Empowered Empowerment']),
      config: {
        catalystEmpowermentPool: {
          power: 1000,
          precision: 1000,
          ferocity: 1000,
          conditionDamage: 1000,
          expertise: 1000,
          concentration: 1000
        }
      },
      runtime: {
        combatStartTime: 0,
        profession: {
          specialization: { kind: 'Catalyst', state }
        }
      },
      time: 12
    },
    {
      power: 1500,
      precision: 1500,
      ferocity: 1500,
      conditionDamage: 1500,
      expertise: 1500,
      concentration: 1500
    }
  );

  assert.deepEqual(attributes, {
    power: 1700,
    precision: 1700,
    ferocity: 1700,
    conditionDamage: 1700,
    expertise: 1700,
    concentration: 1700
  });
});

test('Relentless Fire exposes separate strike and condition modifiers for its active window', () => {
  const modifiers = createModifierHooks({ rules: catalystModifierRules });
  const context = {
    time: 1,
    runtime: {
      boons: new Map([['relentless fire', [{ at: 0, expiresAt: 5, stacks: 1 }]]])
    }
  };

  assert.deepEqual(
    catalystModifierRules
      .filter(({ id }) => id.startsWith('elementalist.relentless-fire'))
      .map(({ id, target }) => ({ id, target })),
    [
      { id: 'elementalist.relentless-fire', target: 'strikeDamage' },
      { id: 'elementalist.relentless-fire-condition', target: 'conditionDamage' }
    ]
  );
  assert.ok(Math.abs(modifiers.modifyStrikeDamage(context, 1) - 1.1) < 1e-12);
  assert.ok(Math.abs(modifiers.modifyConditionDamage(context, 1) - 1.1) < 1e-12);
});

test('Catalyst zero-damage finishers preserve combo metadata', () => {
  const zeroCoefficientFinisher = (name, finisherType) =>
    elementalistCatalog.skillsByName
      .get(name)
      .effects.flatMap((effect) => effect.ticks || [])
      .some(
        (tick) =>
          tick.coefficient === 0 && tick.comboFinishers?.some((finisher) => finisher.finisherType === finisherType)
      );

  assert.equal(zeroCoefficientFinisher('Churning Earth', 'Blast'), true);
  assert.equal(zeroCoefficientFinisher('Aerial Agility', 'Leap'), true);
  assert.equal(zeroCoefficientFinisher('Aerial Agility (dash)', 'Leap'), true);
});

test('Shattering Ice is proc-only and accepts player-owned effect and field attacks after its interval boundary', () => {
  const skill = elementalistCatalog.skillsByName.get('Shattering Ice');
  const state = createCatalystState();
  const context = {
    profession: { specialization: { kind: 'Catalyst', state } },
    config: {},
    queue: new StableEventQueue()
  };
  state.shatteringIceUntil = 10;

  assert.deepEqual(skill.effects, []);

  applyCatalystResolvedDamage(context, {
    type: 'damage',
    at: 1,
    actorType: 'effect',
    skillName: 'Electric Discharge',
    coefficient: 0.5
  });
  applyCatalystResolvedDamage(context, {
    type: 'damage',
    at: 2,
    actorType: 'player',
    skillName: 'Deploy Jade Sphere (Air)',
    coefficient: 0.1,
    damageKind: 'field-tick',
    isField: true
  });
  applyCatalystResolvedDamage(context, {
    type: 'damage',
    at: 2.001,
    actorType: 'player',
    skillName: 'Deploy Jade Sphere (Air)',
    coefficient: 0.1,
    damageKind: 'field-tick',
    isField: true
  });
  applyCatalystResolvedDamage(context, {
    type: 'damage',
    at: 3.002,
    actorType: 'summon',
    skillName: 'Summon attack',
    coefficient: 1
  });
  applyCatalystResolvedDamage(context, {
    type: 'damage',
    at: 3.002,
    actorType: 'effect',
    skillName: 'Shattering Ice Proc',
    coefficient: 0.6
  });

  const queued = Array.from({ length: context.queue.length }, () => context.queue.dequeue());
  assert.deepEqual(
    queued.filter((event) => event.type === 'damage').map((event) => event.triggeredBy),
    ['Electric Discharge', 'Deploy Jade Sphere (Air)']
  );
  assert.deepEqual(
    queued.filter((event) => event.type === 'condition').map((event) => event.triggeredBy),
    ['Electric Discharge', 'Deploy Jade Sphere (Air)']
  );
  assert.equal(state.shatteringIceReadyAt, 3.001);
});
