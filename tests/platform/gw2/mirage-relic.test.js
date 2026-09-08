import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { recordPassiveRelicTimeline } from '#gw2/platform/equipment/relics/query.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';

// Isolate dodge starts from follow-up packets, precombat actions and the exact ICD boundary.
test('Mirage follows executed rotation dodges with a one-second ICD', () => {
  for (const skillName of ['Dodge', 'Dodge / Mirage Cloak', 'Dodge Jump', 'Evading attack']) {
    const action = (at, overrides = {}) => ({
      type: 'action',
      at,
      skillName,
      evades: skillName === 'Evading attack',
      actorType: 'player',
      ...overrides
    });
    const ctx = { relic: createRelicRuntime('Mirage'), config: {}, combatStartTime: 3, queue: [] };
    recordPassiveRelicTimeline(
      ctx,
      [
        action(5),
        action(5.001),
        action(2),
        action(3, { cancelled: true }),
        action(3, { actorType: 'summon' }),
        action(4),
        action(4.999),
        action(5, { type: 'damage' }),
        action(7, { skillName: 'Flying Cutter', evades: false }),
        action(9)
      ],
      8
    );
    assert.deepEqual(
      ctx.queue.map((event) => event.at),
      [4, 5.001]
    );
    for (const event of ctx.queue) {
      assert.equal(event.condition, 'Torment');
      assert.equal(event.stacks, 2);
      assert.equal(event.duration, 6);
      assert.equal(event.ownerActorType, 'player');
      assert.equal(event.triggeredBy, skillName);
    }
  }
});

// The real skill metadata must survive scheduling, with one shared ICD across dodges and evade attacks.
test('Death Blossom is an evade and shares Mirage cooldown with ordinary dodge', () => {
  assert.equal(thiefProfession.catalog.skillsByName.get('Death Blossom').evades, true);
  const config = {
    specialization: 'Core',
    relic: 'Mirage',
    selectedTraitIds: [],
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    initialInitiative: 12,
    boons: { quickness: true },
    target: { health: 0, conditions: {} }
  };
  const result = simulateGw2({
    profession: thiefProfession,
    config,
    rotation: ['Dodge', 'Death Blossom', 'Death Blossom', { name: '__wait', waitMs: 8000 }]
  });
  const evades = result.events.filter((event) => event.type === 'action' && event.evades);
  assert.equal(evades.length, 2);
  assert.ok(evades.every((event) => event.skillName === 'Death Blossom'));
  assert.ok(evades[0].at < 1 && evades[1].at > 1);
  const applications = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'relic.mirage'
  );
  assert.deepEqual(
    applications.map((event) => event.at),
    [0, evades[1].at]
  );
  assert.ok(result.breakdown.some((entry) => entry.name.includes('Relic of the Mirage') && entry.conditionDamage > 0));
  const movementOnly = simulateGw2({
    profession: thiefProfession,
    config,
    rotation: ['Heartseeker', { name: '__wait', waitMs: 8000 }]
  });
  assert.equal(
    movementOnly.resolvedEvents.some((event) => event.sourceId === 'relic.mirage'),
    false
  );
});

test('Mirage dodge Torment uses normal duration scaling and stops when there are no dodges', () => {
  const config = {
    specialization: 'Mirage',
    relic: 'Mirage',
    selectedTraitIds: [],
    stats: { expertise: 750 },
    target: { health: 0, conditions: {} }
  };
  const result = simulateMesmer(
    [
      'Dodge / Mirage Cloak',
      { name: '__wait', waitMs: 1001 },
      'Dodge / Mirage Cloak',
      { name: '__wait', waitMs: 8000 }
    ],
    config
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'relic.mirage'
  );
  assert.deepEqual(
    applications.map((event) => event.at),
    [0, 1.001]
  );
  assert.ok(applications.every((event) => event.effectiveDuration === 9));
  assert.ok(result.breakdown.some((entry) => entry.name.includes('Relic of the Mirage') && entry.conditionDamage > 0));
  assert.equal(result.procSteps.filter((proc) => proc.skill === 'Relic of the Mirage').length, 2);
  const withoutDodges = simulateMesmer(['Flying Cutter', { name: '__wait', waitMs: 8000 }], config);
  assert.equal(
    withoutDodges.resolvedEvents.some((event) => event.sourceId === 'relic.mirage'),
    false
  );
  const rapidDodges = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Dodge / Mirage Cloak', { name: '__wait', waitMs: 8000 }],
    config
  );
  assert.equal(rapidDodges.procSteps.filter((proc) => proc.skill === 'Relic of the Mirage').length, 1);
});
