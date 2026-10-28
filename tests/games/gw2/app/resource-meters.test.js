import assert from 'node:assert/strict';
import test from 'node:test';

import { clampStartingResourceValues } from '#gw2/app/build/panels/traits.js';
import { activeResourceGroup, resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

// Every resource presentation must consume a bounded canonical planning pool without requiring browser navigation.
for (const [professionId, elite, resourceId, key] of [
  ['mesmer', 'Virtuoso', 'blades', STATE.BLADES],
  ['mesmer', 'Troubadour', 'notes', STATE.NOTES],
  ['engineer', 'Holosmith', 'heat', STATE.HEAT],
  ['thief', null, 'initiative', STATE.INITIATIVE],
  ['thief', 'Deadeye', 'malice', STATE.MALICE],
  ['guardian', 'Firebrand', 'pages', STATE.TOME_PAGES],
  ['ranger', 'Galeshot', 'arrows', STATE.ARROWS],
  ['ranger', 'Galeshot', 'wind-force', STATE.WIND_FORCE],
  ['revenant', null, 'energy', STATE.ENERGY],
  ['necromancer', null, 'life-force', STATE.LIFE_FORCE],
  ['elementalist', 'Catalyst', 'catalyst-energy', STATE.CATALYST_ENERGY],
  ['elementalist', 'Evoker', 'evoker-charges', STATE.FAMILIAR_CHARGES],
  ['warrior', 'Paragon', 'motivation', STATE.MOTIVATION],
  ['warrior', 'Paragon', 'adrenaline', STATE.ADRENALINE],
  ['warrior', 'Bladesworn', 'flow', STATE.FLOW],
  ['revenant', 'Conduit', 'affinity', STATE.AFFINITY]
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
      balanceContext: profession.resolvePatch().balanceContext
    }).find((view) => view.id === resourceId);
    assert.ok(view, 'resource presentation is registered');
    assert.ok(Number.isFinite(view.value));
    assert.ok(Number.isFinite(view.maximum) && view.maximum > 0);
    assert.ok(view.value >= 0 && view.value <= view.maximum);

    if (key === STATE.FAMILIAR_CHARGES) {
      // Evoker combines the familiar pool with a separately projected empowered pool in one dial.
      const empowered = planning.profession[STATE.EMPOWERED_CHARGES];
      assert.ok(Number.isFinite(empowered.value));
      assert.ok(Number.isFinite(empowered.maximum) && empowered.maximum > 0);
      assert.ok(empowered.value >= 0 && empowered.value <= empowered.maximum);
    }
  });
}

test('starting resource clamps cover every active resource view', () => {
  const app = {
    patch: patchSelectionFixture(undefined),
    build: {
      initialResource: 25,
      initialBlight: 15,
      initialInitiative: 15,
      unchanged: 9
    },
    resourceDefinitions: (specialization) => {
      assert.equal(specialization, 'Multi Resource');
      return [
        { maximum: 10 },
        { buildKey: 'initialBlight', maximum: 5 },
        { buildKey: 'initialInitiative', maximum: 12, startMaximum: 15 },
        { buildKey: 'missingResource', maximum: 3 }
      ];
    }
  };

  clampStartingResourceValues(app, 'Multi Resource');

  assert.deepEqual(app.build, {
    initialResource: 10,
    initialBlight: 5,
    initialInitiative: 15,
    unchanged: 9
  });
});

test('15-pip initiative uses specialization-neutral rows', () => {
  const html = activeResourceGroup({
    adapter: { eliteSpecialization: () => 'Core' },
    build: { initialResource: 15 },
    profession: {
      ui: {
        resourceViews: () => [
          {
            id: 'resource',
            maximum: 15,
            value: 9,
            pipRows: 2,
            pipStyle: 'thief-initiative'
          }
        ]
      }
    },
    results: { planningState: { availability: {}, atSeconds: 0, profession: {} } }
  });

  const rowPipCounts = [
    ...html.matchAll(/<span class="resource-pip-row">((?:<span class="active-resource-pip[^"]*"><\/span>)+)<\/span>/g)
  ].map(([, pips]) => [...pips.matchAll(/active-resource-pip/g)].length);

  assert.match(html, /class="active-resource-pips thief-initiative pip-rows-2 pip-count-15"/);
  assert.deepEqual(rowPipCounts, [7, 8]);
});
