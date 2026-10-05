import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { planningFixture } from '#tests/helpers/observed-runtime.js';

// Every resource presentation must consume a bounded canonical planning pool without requiring browser navigation.
for (const [professionId, elite, resourceId, key] of [
  ['mesmer', 'Virtuoso', 'blades', 'blades'],
  ['mesmer', 'Troubadour', 'notes', 'notes'],
  ['engineer', 'Holosmith', 'heat', 'heat'],
  ['thief', null, 'initiative', 'initiative'],
  ['thief', 'Deadeye', 'malice', 'malice'],
  ['guardian', 'Firebrand', 'pages', 'tomePages'],
  ['ranger', 'Galeshot', 'arrows', 'arrows'],
  ['ranger', 'Galeshot', 'wind-force', 'windForce'],
  ['revenant', null, 'energy', 'energy'],
  ['necromancer', null, 'life-force', 'lifeForce'],
  ['elementalist', 'Catalyst', 'catalyst-energy', 'catalystEnergy'],
  ['elementalist', 'Evoker', 'evoker-charges', 'familiarCharges'],
  ['warrior', 'Paragon', 'motivation', 'motivation'],
  ['warrior', 'Paragon', 'adrenaline', 'adrenaline'],
  ['warrior', 'Bladesworn', 'flow', 'flow'],
  ['revenant', 'Conduit', 'affinity', 'affinity']
]) {
  test(professionId + ' ' + (elite ?? 'Core') + ' projects ' + resourceId + ' into the meter', async () => {
    const { profession } = await loadProfessionAppAdapter(professionId);
    const specialization = elite ?? 'Core';
    const planning = planningFixture(profession, { specialization });
    const pool = planning.profession[key];
    assert.ok(Number.isFinite(pool.value));
    assert.ok(Number.isFinite(pool.maximum) && pool.maximum > 0);
    assert.ok(pool.value >= 0 && pool.value <= pool.maximum);
    const view = resourceDisplayViews(profession, {
      catalog: profession.catalog,
      specialization,
      professionState: planning.profession,
      balanceContext: profession.balanceContextFor()
    }).find((view) => view.id === resourceId);
    assert.ok(view, 'resource presentation is registered');
    assert.ok(Number.isFinite(view.value));
    assert.ok(Number.isFinite(view.maximum) && view.maximum > 0);
    assert.ok(view.value >= 0 && view.value <= view.maximum);
    if (key === 'familiarCharges') {
      // Evoker combines the familiar pool with a separately projected empowered pool in one dial.
      const empowered = planning.profession.empoweredCharges;
      assert.ok(Number.isFinite(empowered.value));
      assert.ok(Number.isFinite(empowered.maximum) && empowered.maximum > 0);
      assert.ok(empowered.value >= 0 && empowered.value <= empowered.maximum);
    }
  });
}
