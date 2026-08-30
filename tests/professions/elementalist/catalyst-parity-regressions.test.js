import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistCatalog } from '../../../js/games/gw2/content/professions/elementalist/catalog.js';
import {
  applyCatalystEmpowerment,
  applyCatalystResolvedDamage
} from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystAttributeRules } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-and-empowerment.js';
import { createCatalystState } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/state.js';

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
      duration: 20
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
    queue: []
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

  assert.deepEqual(
    context.queue.filter((event) => event.type === 'damage').map((event) => event.triggeredBy),
    ['Electric Discharge', 'Deploy Jade Sphere (Air)']
  );
  assert.deepEqual(
    context.queue.filter((event) => event.type === 'condition').map((event) => event.triggeredBy),
    ['Electric Discharge', 'Deploy Jade Sphere (Air)']
  );
  assert.equal(state.shatteringIceReadyAt, 3.001);
});
