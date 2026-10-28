import assert from 'node:assert/strict';
import test from 'node:test';

import { SHARED_STATE_IDS } from '#gw2/platform/results/state-ids.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { ELEMENTALIST_STATE_IDS } from '#gw2/professions/elementalist/state-ids.js';
import { ENGINEER_STATE_IDS } from '#gw2/professions/engineer/state-ids.js';
import { GUARDIAN_STATE_IDS } from '#gw2/professions/guardian/state-ids.js';
import { MESMER_STATE_IDS } from '#gw2/professions/mesmer/state-ids.js';
import { NECROMANCER_STATE_IDS } from '#gw2/professions/necromancer/state-ids.js';
import { RANGER_STATE_IDS } from '#gw2/professions/ranger/state-ids.js';
import { REVENANT_STATE_IDS } from '#gw2/professions/revenant/state-ids.js';
import { PROFESSION_STATE_IDS } from '#gw2/professions/state-ids.js';
import { THIEF_STATE_IDS } from '#gw2/professions/thief/state-ids.js';
import { WARRIOR_STATE_IDS } from '#gw2/professions/warrior/state-ids.js';

// Check the separate registries before aggregation can hide a duplicated constant or identity.
test('planning identities are unique across shared and profession registries', () => {
  const registries = [
    SHARED_STATE_IDS,
    ELEMENTALIST_STATE_IDS,
    ENGINEER_STATE_IDS,
    GUARDIAN_STATE_IDS,
    MESMER_STATE_IDS,
    NECROMANCER_STATE_IDS,
    RANGER_STATE_IDS,
    REVENANT_STATE_IDS,
    THIEF_STATE_IDS,
    WARRIOR_STATE_IDS
  ];
  const names = new Set();
  const ids = new Set();
  for (const registry of registries) {
    for (const [name, id] of Object.entries(registry)) {
      assert.equal(names.has(name), false, name);
      assert.equal(ids.has(id), false, id);
      assert.match(id, /^gw2\.[a-z]+\.[a-z][a-z0-9-]*$/);
      names.add(name);
      ids.add(id);
      assert.equal(PROFESSION_STATE_IDS[name], id);
    }
  }

  assert.equal(Object.keys(PROFESSION_STATE_IDS).length, names.size);
});

/** Collect nested mutable identities so every published object can be checked against its runtime owner. */
function objectsIn(value, objects = new Set()) {
  if (!value || typeof value !== 'object' || objects.has(value)) return objects;

  objects.add(value);
  const children =
    value instanceof Map
      ? [...value.keys(), ...value.values()]
      : value instanceof Set
        ? [...value]
        : Object.values(value);
  for (const child of children) objectsIn(child, objects);
  return objects;
}

for (const entry of professionRegistry) {
  test(`${entry.id} projects registered IDs with detached values for every active specialization`, async () => {
    const family = await entry.loadProfession();
    const registeredIds = new Set(Object.values(PROFESSION_STATE_IDS));
    for (const { id: specialization } of family.nativeDefinition.modules) {
      const config = { specialization };
      const runtime = family.runtimeFor(config);
      const profession = runtime.createState(config);
      const input = { profession, config, catalog: runtime.catalog, time: 0, activeWeaponSet: 1 };
      const liveObjects = objectsIn(profession);
      const projected = runtime.projectPlanningState(input);
      assert.ok(Object.keys(projected).length > 0, specialization);
      for (const id of Object.keys(projected)) assert.ok(registeredIds.has(id), `${specialization}: ${id}`);
      for (const value of objectsIn(projected)) assert.equal(liveObjects.has(value), false, specialization);

      // The direct owner boundary must detach as well as the composed runtime boundary.
      const activeIds = new Set();
      for (const module of family.nativeDefinition.modules.filter(({ id }) => id === 'Core' || id === specialization)) {
        if (!module.state?.project) continue;

        const ownedProjection = module.state.project(input);
        for (const value of objectsIn(ownedProjection)) assert.equal(liveObjects.has(value), false, module.id);
        for (const id of Object.keys(ownedProjection)) activeIds.add(id);
      }

      assert.deepEqual(new Set(Object.keys(projected)), activeIds, 'Only active owners contribute observations');
    }
  });
}
