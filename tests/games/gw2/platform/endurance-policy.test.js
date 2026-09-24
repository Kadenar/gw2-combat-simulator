import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { gainThiefEndurance } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession } from '#gw2/app/profession-registry.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  grantProfessionEndurance,
  professionEnduranceReadyAt
} from '#gw2/platform/combat/resources/endurance-policy.js';

// All existing resource owners must expose the same grant contract, including specialization-owned Mirage.
for (const [id, specialization] of [
  ['elementalist', 'Core'],
  ['engineer', 'Core'],
  ['thief', 'Core'],
  ['thief', 'Daredevil'],
  ['mesmer', 'Mirage'],
  ['ranger', 'Core'],
  ['revenant', 'Vindicator'],
  ['warrior', 'Core'],
  ['guardian', 'Core']
]) {
  test(`${id}/${specialization} grants endurance through its active policy`, async () => {
    const profession = await loadProfession(id);
    const { context } = createScheduler({ profession, config: { specialization } });
    const policy = context.profession.resources.endurance;
    const state = policy.state(context);
    const maximum = policy.maximum(context);
    assert.equal(state.endurance, maximum);
    state.endurance = 0;
    assert.equal(grantProfessionEndurance(context, 50, 0), true);
    assert.equal(state.endurance, 50);
    grantProfessionEndurance(context, maximum, 0);
    assert.equal(state.endurance, maximum);
    assert.equal(professionEnduranceReadyAt(context, maximum + 1, 0), null);
  });
}

test('Elementalist Energy makes the next dodge affordable on attunement swap', async () => {
  const profession = await loadProfession('elementalist');
  const rotation = [
    { type: 'combat-start' },
    ...['Dodge', 'Dodge', 'Air Attunement', 'Dodge'].map((name) => ({
      type: 'cast',
      skillId: profession.catalog.skillsByName.get(name).id
    }))
  ];
  const result = simulateGw2({
    profession,
    rotation,
    config: {
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      sigilSets: [{ names: ['Energy'] }, { names: [] }]
    }
  });
  const grant = result.events.find((event) => event.type === 'resource' && event.sourceId === 'sigil.energy');
  const dodge = result.steps.filter((step) => step.skill === 'Dodge').at(-1);
  assert.deepEqual(result.warnings, []);
  assert.ok(grant);
  assert.equal(dodge.start, grant.at * 1000);
});

// Deferred changes must stay invisible until their timestamp and respect the activation's task ownership.
test('future Thief grants settle regeneration once and can be cancelled by their owner', async () => {
  const profession = await loadProfession('thief');
  for (const cancelled of [false, true]) {
    const { context } = createScheduler({ profession, config: { specialization: 'Core' } });
    const pool = context.profession.resources.endurance.state(context);
    pool.endurance = 0;
    gainThiefEndurance({ ...context, reservationId: 'fixture-cast' }, 50, 2, 'fixture-grant');
    assert.equal(pool.endurance, 0);
    context.advanceTo(1);
    assert.equal(pool.endurance, 5);
    if (cancelled) context.tasks.cancelOwner('fixture-cast');
    context.advanceTo(2);
    assert.equal(pool.endurance, cancelled ? 10 : 60);
    assert.equal(
      context.events.some((event) => event.reason === 'fixture-grant'),
      !cancelled
    );
  }
});

test('selected profile capacity controls initialization, grants, and readiness', async () => {
  const profession = await loadProfession('engineer');
  const catalog = applyBalanceProfilePatch(profession.catalog, {
    balanceProfiles: { 'engineer.core.resources': { fields: { maximumStacks: { from: 100, to: 120 } } } }
  });
  const { context } = createScheduler({ profession, catalog });
  const pool = context.profession.resources.endurance.state(context);
  assert.equal(pool.endurance, 120);
  assert.equal('maximumEndurance' in pool, false);
  pool.endurance = 100;
  grantProfessionEndurance(context, 50, 0);
  assert.equal(pool.endurance, 120);
  assert.equal(professionEnduranceReadyAt(context, 121, 0), null);
});

test('malformed declared endurance fails rather than silently dropping grants', () => {
  assert.throws(() => defineProfession({ id: 'bad', name: 'Bad', resources: { endurance: {} } }), /Endurance requires/);
  const profession = defineProfession({
    id: 'bad-pool',
    name: 'Bad pool',
    resources: {
      createProfessionState: () => ({ endurance: 0, enduranceUpdatedAt: 0 }),
      endurance: { state: (context) => context.state.profession, maximum: () => NaN, regenerationRate: () => 5 }
    }
  });
  assert.throws(() => createScheduler({ profession }), /Invalid profession endurance/);
});
