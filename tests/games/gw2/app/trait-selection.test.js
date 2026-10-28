import { selectedTraits, traitPositions, missingPatchTraits } from '#gw2/professions/shared/trait-data.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { professionOptions } from '#gw2/profession-registry.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { selectSpecialization, toggleMajorTrait } from '#gw2/app/build/panels/traits.js';

// A preview may choose different traits without moving their slots; editing those choices must preserve Live.
test('explicit preview traits resolve and edit independently on unchanged layouts', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const live = adapter.profession.resolvePatch({ id: 'current' }).catalog;
  const preview = adapter.profession.resolvePatch({ id: 'nov-10-balance-preview' }).catalog;
  const selection = {
    name: 'Virtues',
    traits: '3-1-2',
    patchTraits: { 'nov-10-balance-preview': '3-1-1' }
  };
  assert.equal(traitPositions(live, selection), '3-1-2');
  assert.equal(traitPositions(preview, selection), '3-1-1');
  assert.deepEqual(missingPatchTraits(preview, [selection]), []);
  const virtues = preview.specializations.find(({ name }) => name === 'Virtues');
  assert.ok(selectedTraits(preview, [selection]).some(({ id }) => id === virtues.majorTraits[2][0].id));
  assert.ok(!selectedTraits(preview, [selection]).some(({ id }) => id === virtues.majorTraits[2][1].id));
  toggleMajorTrait(preview, selection, 2, '3');
  assert.equal(traitPositions(preview, selection), '3-1-3');
  assert.equal(traitPositions(live, selection), '3-1-2');
  toggleMajorTrait(live, selection, 0, '1');
  assert.equal(traitPositions(live, selection), '1-1-2');
  assert.equal(traitPositions(preview, selection), '3-1-3');
  const otherPreview = { balanceDataContext: { patchId: 'other-preview' } };
  assert.equal(traitPositions(otherPreview, selection), '1-1-2');
  const liveOnly = { name: 'Virtues', traits: '3-1-2' };
  assert.equal(traitPositions(preview, liveOnly), '3-1-2');
  toggleMajorTrait(preview, liveOnly, 2, '1');
  assert.equal(liveOnly.traits, '3-1-1');
});

// Every profession must preserve empty tiers and minor opt-outs through the shared build codec and trait resolver.
test('disabled traits survive saving and loading for every profession', async () => {
  for (const { id } of professionOptions) {
    const adapter = await loadProfessionAppAdapter(id);
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
    assert.deepEqual(selectedTraits(adapter.profession.catalog, loaded.specializations), [], id);

    const selection = loaded.specializations[0];
    const spec = adapter.profession.catalog.specializations.find(({ name }) => name === selection.name);
    selection.traits = '0-2-0';
    selection.disabledMinorTraits = [0, 2];
    assert.deepEqual(
      selectedTraits(adapter.profession.catalog, loaded.specializations).map(({ id }) => id),
      [spec.minorTraits[1].id, spec.majorTraits[1][1].id],
      id
    );
    delete selection.disabledMinorTraits;
    assert.deepEqual(
      selectedTraits(adapter.profession.catalog, loaded.specializations).map(({ id }) => id),
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

// Preview positions travel beside Live positions; the codec stores them without knowing which patch is selected.
test('patch trait positions survive saving and loading while malformed positions are rejected', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const build = createDefaultBuild(adapter);
  build.specializations[0].patchTraits = { 'fixture-preview': '2-0-3' };
  const saved = adapter.profession.migrateBuild(build);
  assert.equal(adapter.profession.validateBuild(saved).valid, true);
  assert.deepEqual(
    adapter.toApplicationBuild(JSON.parse(JSON.stringify(saved))).specializations,
    build.specializations
  );

  for (const patchTraits of ['2-0-3', { preview: '4-0-0' }, { preview: '0-0' }]) {
    build.specializations[0].patchTraits = patchTraits;
    assert.equal(adapter.profession.validateBuild(build).valid, false);
  }

  build.specializations[0].patchTraits = { kept: '1-2-3', dropped: '4-0-0' };
  assert.deepEqual(adapter.profession.migrateBuild(build).specializations[0].patchTraits, { kept: '1-2-3' });
  build.specializations[0].patchTraits = { dropped: 'x' };
  assert.equal(Object.hasOwn(adapter.profession.migrateBuild(build).specializations[0], 'patchTraits'), false);
});

test('specialization selection replaces another elite line and refreshes its resources', () => {
  let changed = 0;
  const app = {
    patch: patchSelectionFixture({
      specializations: [
        { name: 'Damage', elite: false },
        { name: 'Support', elite: false },
        { name: 'Fallback', elite: false },
        { name: 'Old Elite', elite: true },
        { name: 'New Elite', elite: true }
      ]
    }),
    build: {
      initialResource: 10,
      specializations: [
        { name: 'Damage', traits: '2-2-2' },
        { name: 'Old Elite', traits: '3-3-3' },
        { name: 'Support', traits: '2-2-2' }
      ]
    },
    activeCatalog: {
      specializations: [
        { name: 'Damage', elite: false },
        { name: 'Support', elite: false },
        { name: 'Fallback', elite: false },
        { name: 'Old Elite', elite: true },
        { name: 'New Elite', elite: true }
      ]
    },
    adapter: {
      eliteSpecialization: (build) =>
        build.specializations.find((specialization) => specialization.name.endsWith('Elite'))?.name || 'Core'
    },
    resourceDefinitions: (specialization) => {
      assert.equal(specialization, 'New Elite');
      return [{ maximum: 5 }];
    },
    changed() {
      changed += 1;
    }
  };

  selectSpecialization(app, 2, 'New Elite');

  assert.deepEqual(app.build.specializations, [
    { name: 'Damage', traits: '2-2-2' },
    { name: 'Support', traits: '2-2-2' },
    { name: 'New Elite', traits: '1-1-1' }
  ]);
  assert.equal(app.build.initialResource, 5);
  assert.equal(changed, 1);
});

test('elite specialization changes preserve unique Warrior lines through persistence normalization', async () => {
  const adapter = await loadProfessionAppAdapter('warrior');
  for (const line of [0, 1, 2]) {
    const build = createDefaultBuild(adapter);
    build.specializations = [
      { name: 'Strength', traits: '2-2-2' },
      { name: 'Berserker', traits: '3-3-3' },
      { name: 'Arms', traits: '2-3-1' }
    ];
    const original = structuredClone(build.specializations);
    let changed = 0;
    const app = {
      patch: adapter.profession.resolvePatch({ id: 'current' }),
      build,
      adapter,
      activeCatalog: adapter.profession.catalog,
      resourceDefinitions: (specialization) =>
        adapter.profession.ui.resourceViews({ specialization, catalog: app.activeCatalog, build: app.build }),
      changed() {
        changed += 1;
      }
    };

    selectSpecialization(app, line, 'Spellbreaker');

    const expected = [original[0], original[2], { name: 'Spellbreaker', traits: '1-1-1' }];
    assert.deepEqual(build.specializations, expected);
    assert.equal(new Set(build.specializations.map(({ name }) => name)).size, 3);
    assert.equal(
      build.specializations.filter(
        ({ name }) => adapter.profession.catalog.specializations.find((spec) => spec.name === name).elite
      ).length,
      1
    );
    // Save-time migration and application loading must retain the chosen elite and the existing core traits.
    const saved = adapter.profession.migrateBuild(build);
    assert.deepEqual(saved.specializations, expected);
    assert.deepEqual(adapter.toApplicationBuild(JSON.parse(JSON.stringify(saved))).specializations, expected);
    assert.equal(changed, 1);
    selectSpecialization(app, line === 0 ? 2 : 0, 'Spellbreaker');
    assert.deepEqual(build.specializations, expected);
    assert.equal(changed, 1);
  }
});

// Selecting an elite from any core row moves it to the bottom without resetting the surviving core traits.
test('selecting an elite shifts the remaining core lines above it', () => {
  const original = [
    { name: 'Damage', traits: '2-2-2' },
    { name: 'Support', traits: '3-3-3' },
    { name: 'Defense', traits: '2-3-1' }
  ];
  for (const line of [0, 1, 2]) {
    let changed = 0;
    const app = {
      patch: patchSelectionFixture({
        specializations: [...original.map(({ name }) => ({ name, elite: false })), { name: 'Elite', elite: true }]
      }),
      build: { specializations: structuredClone(original) },
      activeCatalog: {
        specializations: [...original.map(({ name }) => ({ name, elite: false })), { name: 'Elite', elite: true }]
      },
      adapter: { eliteSpecialization: () => 'Elite' },
      resourceDefinitions: () => [],
      changed() {
        changed += 1;
      }
    };

    selectSpecialization(app, line, 'Elite');

    assert.deepEqual(app.build.specializations, [
      ...original.filter((_, index) => index !== line),
      { name: 'Elite', traits: '1-1-1' }
    ]);
    assert.equal(changed, 1);
  }
});
