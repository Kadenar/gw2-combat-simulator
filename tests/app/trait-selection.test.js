import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession/registry.js';

// Every profession must preserve empty tiers and minor opt-outs through the shared build codec and trait resolver.
test('disabled traits survive saving and loading for every profession', async () => {
  for (const { id } of professionOptions) {
    const adapter = await loadProfessionAppAdapter(id);
    const { getActiveTraits } = await import(`#gw2/professions/${id}/data/traits-data.js`);
    const build = createDefaultBuild(adapter);
    build.specializations = build.specializations.map(({ name }) => ({
      name,
      traits: '0-0-0',
      disabledMinorTraits: [0, 1, 2]
    }));
    const saved = adapter.profession.migrateBuild(build);
    assert.equal(adapter.profession.validateBuild(saved).valid, true, id);
    const loaded = adapter.toApplicationBuild(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(loaded.specializations, build.specializations, id);
    assert.deepEqual(getActiveTraits(loaded.specializations), [], id);

    const selection = loaded.specializations[0];
    const spec = adapter.specializations.find(({ name }) => name === selection.name);
    selection.traits = '0-2-0';
    selection.disabledMinorTraits = [0, 2];
    assert.deepEqual(
      getActiveTraits(loaded.specializations).map(({ id }) => id),
      [spec.minorTraits[1].id, spec.majorTraits[1][1].id],
      id
    );
    delete selection.disabledMinorTraits;
    assert.deepEqual(
      getActiveTraits(loaded.specializations).map(({ id }) => id),
      [...spec.minorTraits.map(({ id }) => id), spec.majorTraits[1][1].id],
      id
    );
  }
});

// Supporting empty choices must not accept malformed trait selections at the import boundary.
test('trait validation rejects invalid choices and migration sanitizes minor opt-outs', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const build = createDefaultBuild(adapter);
  for (const traits of ['4-0-0', '0-0', '0-x-0']) {
    build.specializations[0].traits = traits;
    assert.equal(adapter.profession.validateBuild(build).valid, false);
    assert.equal(adapter.profession.migrateBuild(build).specializations[0].traits, '1-1-1');
  }

  build.specializations[0].traits = '0-0-0';
  for (const disabledMinorTraits of ['0', [3], [-1], [0.5], ['1']]) {
    build.specializations[0].disabledMinorTraits = disabledMinorTraits;
    assert.equal(adapter.profession.validateBuild(build).valid, false);
  }

  build.specializations[0].disabledMinorTraits = [2, 2, 0, -1, '1'];
  assert.deepEqual(adapter.profession.migrateBuild(build).specializations[0].disabledMinorTraits, [0, 2]);
});
