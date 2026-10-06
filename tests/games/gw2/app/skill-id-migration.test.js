import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorAppAdapter as adapter } from '#gw2/professions/warrior/app/app-definition.js';
import { loadBuild } from '#gw2/app/build/state/persistence.js';
import { loadBuildWorkspace, workspaceStorageKey } from '#gw2/app/build/state/workspace.js';
import { loadMyBuilds, myBuildsStorageKey } from '#gw2/app/build/library/storage.js';
import { previewBuildFileImport, applyBuildFileImport } from '#gw2/app/import-export/build-file-import.js';
import { createGw2BuildCodec } from '#gw2/platform/builds/codec.js';
import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';

// The disabled cannon shares its display name with the usable utility but must never compete for a saved slot.
test('saved Antiquary cannon selections load and rewrite to the usable cannon ID', (t) => {
  const values = mockStorage(t);
  const { selectedSkillIds, ...fields } = thiefAppAdapter.profession.createBuildDefaults();
  const saved = {
    ...fields,
    schemaVersion: fields.schemaVersion - 1,
    specializations: [
      { name: 'Deadly Arts', traits: '3-2-1' },
      { name: 'Trickery', traits: '2-3-3' },
      { name: 'Antiquary', traits: '1-1-1' }
    ],
    selectedSkills: {
      ...Object.fromEntries(
        Object.entries(selectedSkillIds).map(([slot, id]) => [
          slot,
          id === null ? '' : thiefAppAdapter.profession.catalog.skillsById.get(id).name
        ])
      ),
      Utility1: 'Stone Summit Cannon'
    }
  };
  values.set(thiefAppAdapter.storageKey, JSON.stringify(saved));
  const loaded = loadBuild(thiefAppAdapter);
  assert.equal(loaded.selectedSkillIds.Utility1, THIEF.STONE_SUMMIT_CANNON);
  const persisted = JSON.parse(values.get(thiefAppAdapter.storageKey));
  assert.equal(persisted.selectedSkillIds.Utility1, THIEF.STONE_SUMMIT_CANNON);
  assert.equal(Object.hasOwn(persisted, 'selectedSkills'), false);
  for (const id of [THIEF.ANTIVENOM_DRAUGHT_BACKFIRED, THIEF.UNSTABLE_SKRITT_BOMB, THIEF.STONE_SUMMIT_CANNON_ID_77092])
    assert.equal(thiefAppAdapter.profession.catalog.skillsById.get(id).slotSelectable, false);
});

/** Reconstruct the old persisted schema without changing the source build used for identity assertions. */
function oldBuild() {
  const build = adapter.profession.createBuildDefaults();
  const { selectedSkillIds, ...fields } = build;
  return {
    ...fields,
    schemaVersion: fields.schemaVersion - 1,
    selectedSkills: Object.fromEntries(
      Object.entries(selectedSkillIds).map(([slot, id]) => [slot, adapter.profession.catalog.skillsById.get(id).name])
    )
  };
}

// Every profession's prior default file must cross the same import boundary without losing its selection.
test('legacy defaults migrate for every profession and remain idempotent', async () => {
  for (const id of [
    'warrior',
    'guardian',
    'revenant',
    'engineer',
    'ranger',
    'thief',
    'elementalist',
    'mesmer',
    'necromancer'
  ]) {
    const { [id + 'Profession']: profession } = await import(`#gw2/professions/${id}/profession.js`);
    const { selectedSkillIds, ...fields } = profession.createBuildDefaults();
    const old = {
      ...fields,
      schemaVersion: fields.schemaVersion - 1,
      selectedSkills: Object.fromEntries(
        Object.entries(selectedSkillIds).map(([slot, skillId]) => [
          slot,
          skillId === null ? '' : profession.catalog.skillsById.get(skillId).name
        ])
      )
    };
    const migrated = profession.migrateBuild(old);
    assert.deepEqual(migrated.selectedSkillIds, selectedSkillIds, id);
    assert.equal(migrated.schemaVersion, fields.schemaVersion, id);
    assert.equal(Object.hasOwn(migrated, 'selectedSkills'), false, id);
    assert.deepEqual(profession.migrateBuild(migrated), migrated, id);
  }
});

test('read-only storage retains converted in-memory builds and untouched saved data', (t) => {
  const values = mockStorage(t);
  const saved = oldBuild();
  values.set(adapter.storageKey, JSON.stringify(saved));
  values.set(
    workspaceStorageKey(adapter),
    JSON.stringify({ version: 1, tabs: [{ id: 'tab', name: 'Tab', build: saved }] })
  );
  values.set(
    myBuildsStorageKey(adapter),
    JSON.stringify({ version: 1, builds: [{ id: 'saved', name: 'Saved', build: saved }] })
  );
  const original = [...values];
  localStorage.setItem = () => {
    throw new Error('Storage quota exceeded');
  };

  const expected = adapter.profession.createBuildDefaults().selectedSkillIds;
  assert.deepEqual(loadBuild(adapter).selectedSkillIds, expected);
  assert.deepEqual(loadBuildWorkspace(adapter).tabs[0].build.selectedSkillIds, expected);
  assert.deepEqual(loadMyBuilds(adapter)[0].build.selectedSkillIds, expected);
  assert.deepEqual([...values], original);
});

function mockStorage(t) {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  return values;
}

test('JSON import converts old skill names once and exports reloadable IDs', () => {
  const saved = oldBuild();
  const original = structuredClone(saved);
  const app = { adapter, build: adapter.profession.createBuildDefaults(), changed() {} };
  const preview = previewBuildFileImport(saved, 'old-build.json', app);
  assert.deepEqual(saved, original);
  assert.equal(Object.hasOwn(preview.build, 'selectedSkills'), false);
  assert.deepEqual(preview.build.selectedSkillIds, app.build.selectedSkillIds);
  applyBuildFileImport(app, preview, { build: true, rotation: false });
  const exported = JSON.parse(JSON.stringify(app.build));
  assert.deepEqual(adapter.toApplicationBuild(exported).selectedSkillIds, app.build.selectedSkillIds);
  const empty = oldBuild();
  empty.selectedSkills.Utility1 = '';
  assert.equal(adapter.toApplicationBuild(empty).selectedSkillIds.Utility1, null);
});

test('single builds, workspace tabs, reset targets, and My Builds are rewritten after successful conversion', (t) => {
  const values = mockStorage(t);
  const saved = oldBuild();
  values.set(adapter.storageKey, JSON.stringify(saved));
  values.set(
    workspaceStorageKey(adapter),
    JSON.stringify({
      version: 1,
      activeTabId: 'tab',
      tabs: [{ id: 'tab', name: 'My tab', build: saved, templateBuild: saved }]
    })
  );
  values.set(
    myBuildsStorageKey(adapter),
    JSON.stringify({
      version: 1,
      builds: [{ id: 'saved', name: 'My build', build: saved }]
    })
  );
  const expected = adapter.profession.createBuildDefaults().selectedSkillIds;
  assert.deepEqual(loadBuild(adapter).selectedSkillIds, expected);
  assert.deepEqual(loadBuildWorkspace(adapter).tabs[0].build.selectedSkillIds, expected);
  assert.deepEqual(loadMyBuilds(adapter)[0].build.selectedSkillIds, expected);
  for (const raw of values.values()) {
    assert.equal(raw.includes('"selectedSkills"'), false);
    assert.equal(raw.includes('"selectedSkillIds"'), true);
  }

  const after = [...values];
  loadBuild(adapter);
  loadBuildWorkspace(adapter);
  loadMyBuilds(adapter);
  assert.deepEqual([...values], after);
});

test('failed legacy conversion preserves every original storage envelope and the active imported build', (t) => {
  const values = mockStorage(t);
  const invalid = oldBuild();
  invalid.selectedSkills.Utility1 = 'Unknown old skill';
  values.set(adapter.storageKey, JSON.stringify(invalid));
  values.set(
    workspaceStorageKey(adapter),
    JSON.stringify({
      version: 1,
      tabs: [{ id: 'tab', name: 'Tab', build: invalid }]
    })
  );
  values.set(
    myBuildsStorageKey(adapter),
    JSON.stringify({
      version: 1,
      builds: [{ id: 'saved', name: 'Saved', build: invalid }]
    })
  );
  const original = [...values];
  for (const load of [loadBuild, loadBuildWorkspace, loadMyBuilds])
    assert.throws(() => load(adapter), /Cannot migrate/);
  assert.deepEqual([...values], original);
  const app = { adapter, build: adapter.profession.createBuildDefaults() };
  const current = app.build;
  assert.throws(() => previewBuildFileImport(invalid, 'old.json', app), /Cannot migrate/);
  assert.equal(app.build, current);
});

test('ambiguous old names are rejected and canonical selections retain distinct IDs', () => {
  const catalog = adapter.profession.catalog;
  const first = catalog.skillsById.get(adapter.profession.createBuildDefaults().selectedSkillIds.Utility1);
  const duplicate = { ...first, id: 'duplicate' };
  const codec = createGw2BuildCodec({
    professionId: 'warrior',
    schemaVersion: adapter.profession.createBuildDefaults().schemaVersion,
    catalog: {
      ...catalog,
      skills: [...catalog.skills, duplicate],
      skillsById: new Map([...catalog.skillsById, [duplicate.id, duplicate]])
    },
    createDefaults: () => adapter.profession.createBuildDefaults()
  });
  assert.throws(() => codec.migrateBuild(oldBuild()), /ambiguous/);
  const build = adapter.profession.createBuildDefaults();
  build.selectedSkillIds.Utility1 = duplicate.id;
  assert.equal(codec.migrateBuild(build).selectedSkillIds.Utility1, duplicate.id);
  assert.equal(codec.validateBuild(build).valid, true);
});
