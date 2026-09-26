import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession } from '#gw2/app/profession-registry.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

for (const [id, specialization, capacity] of [
  ['elementalist', 'Core', 100],
  ['engineer', 'Core', 100],
  ['mesmer', 'Mirage', 100],
  ['ranger', 'Core', 100],
  ['warrior', 'Core', 100],
  ['guardian', 'Core', 100],
  ['revenant', 'Vindicator', 100],
  ['thief', 'Core', 100],
  ['thief', 'Daredevil', 150]
]) {
  test(`${id}/${specialization} grants endurance through its live pool and rejects costs above its cap`, async () => {
    // Spend and grant through the actual service so the test cannot retain an obsolete scheduler policy.
    const profession = await loadProfession(id);
    const config = { specialization };
    const result = observeGw2Runtime({ profession: profession.runtimeFor(config), config, rotation: [] });
    const runtime = observedRuntime(result);
    const state = id === 'mesmer' ? runtime.profession.specialization.state : runtime.profession.core;
    assert.equal(state.endurance, capacity);
    runtime.endurance.spend(capacity);
    assert.equal(runtime.endurance.grant(50), true);
    assert.equal(state.endurance, 50);
    runtime.endurance.grant(capacity);
    assert.equal(state.endurance, capacity);
    assert.equal(runtime.endurance.readyAt(capacity + 1), null);
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
  const result = runElementalist({
    profession,
    rotation,
    config: {
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      sigilSets: [{ names: ['Energy'] }, { names: [] }]
    }
  });
  const swap = result.events.find((event) => event.type === 'sigil_swap');
  const dodge = result.steps.filter((step) => step.skill === 'Dodge').at(-1);
  assert.deepEqual(result.warnings, []);
  assert.ok(swap);
  assert.equal(dodge.start, swap.at * 1000);
});

test('selected profile capacity controls initialization, grants, and readiness', async () => {
  const profession = await loadProfession('engineer');
  const catalog = applyBalanceProfilePatch(profession.catalog, {
    balanceProfiles: { 'engineer.core.resources': { fields: { maximumStacks: { from: 100, to: 120 } } } }
  });
  const result = observeGw2Runtime({
    profession: { ...profession.runtimeFor({}), catalog },
    config: {},
    rotation: []
  });
  const runtime = observedRuntime(result);
  const pool = runtime.profession.core;
  assert.equal(pool.endurance, 120);
  assert.equal('maximumEndurance' in pool, false);
  pool.endurance = 100;
  runtime.endurance.grant(50);
  assert.equal(pool.endurance, 120);
  assert.equal(runtime.endurance.readyAt(121), null);
});

test('malformed declared endurance fails rather than silently dropping grants', () => {
  assert.throws(() => defineProfession({ id: 'bad', name: 'Bad', resources: { endurance: {} } }), /Endurance requires/);
  const profession = defineProfession({
    id: 'bad-pool',
    name: 'Bad pool',
    resources: {
      createState: () => ({ endurance: 0, enduranceUpdatedAt: 0 }),
      endurance: { state: (context) => context.profession, maximum: () => NaN, regenerationRate: () => 5 }
    }
  });
  assert.throws(() => simulateGw2({ profession, rotation: [] }), /finite|Invalid endurance/);
});
