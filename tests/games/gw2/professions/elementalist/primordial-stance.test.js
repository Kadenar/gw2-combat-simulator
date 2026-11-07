/** One stance identity survives attunement changes, and obsolete identities are confined to save migration. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { paletteSkillView, rotationSelectedSlotSkills } from '#gw2/app/rotation/palette/model.js';
import { rotationSkillHighlightKey } from '#gw2/app/rotation/timeline/model.js';
import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  toApplicationBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createNativeApp } from '#tests/helpers/elementalist-simulation.js';

test('old builds migrate stance selections and commands without changing explicit glyph casts or input data', () => {
  for (const schemaVersion of [undefined, 5]) {
    for (const skillId of [40183, -1167, -1168, -1169]) {
      const defaults = createElementalistBuildDefaults();
      const saved = {
        ...defaults,
        schemaVersion,
        selectedSkillIds: { ...defaults.selectedSkillIds, Utility1: skillId },
        rotation: [
          { type: 'cast', skillId, offTarget: true, concurrentOffsetMs: 100 },
          { type: 'wait', durationMs: 500 },
          { type: 'cast', skillId: ID.GLYPH_OF_STORMS_AIR, impactDelayMs: 200 },
          { type: 'combat-start' }
        ]
      };
      const before = structuredClone(saved);
      const migrated = migrateElementalistBuild(saved);
      assert.equal(migrated.schemaVersion, 6);
      assert.equal(migrated.selectedSkillIds.Utility1, ID.PRIMORDIAL_STANCE);
      assert.deepEqual(migrated.rotation, [
        { ...saved.rotation[0], skillId: ID.PRIMORDIAL_STANCE },
        ...saved.rotation.slice(1)
      ]);
      assert.deepEqual(saved, before);
      assert.equal(validateElementalistBuild(migrated).valid, true);
      assert.deepEqual(toApplicationBuild(saved), migrated);
      assert.deepEqual(migrateElementalistBuild(JSON.parse(JSON.stringify(migrated))), migrated);
    }
  }
});

test('named saves and standalone rotation imports migrate before command decoding', () => {
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    const name = `Primordial Stance (${element})`;
    const saved = { schemaVersion: 5, selectedSkills: { Utility1: name }, rotation: [name] };
    const migrated = migrateElementalistBuild(saved);
    assert.equal(migrated.selectedSkillIds.Utility1, ID.PRIMORDIAL_STANCE);
    assert.deepEqual(migrated.rotation, [{ type: 'cast', skillId: ID.PRIMORDIAL_STANCE }]);
    const imported = [
      name,
      { name, offTarget: true },
      { id: -1168, concurrentOffsetMs: 100 },
      -1167,
      { type: 'wait', durationMs: 500 }
    ];
    const before = structuredClone(imported);
    const upgraded = elementalistProfession.migrateRotation(imported);
    assert.deepEqual(normalizeRotation(upgraded, elementalistCatalog, { strict: true }), [
      { type: 'cast', skillId: ID.PRIMORDIAL_STANCE },
      { type: 'cast', skillId: ID.PRIMORDIAL_STANCE, offTarget: true },
      { type: 'cast', skillId: ID.PRIMORDIAL_STANCE, concurrentOffsetMs: 100 },
      { type: 'cast', skillId: ID.PRIMORDIAL_STANCE },
      { type: 'wait', durationMs: 500 }
    ]);
    assert.deepEqual(imported, before);
    assert.deepEqual(elementalistProfession.migrateRotation(upgraded), upgraded);
  }
});

test('retired stance IDs are absent from the runtime catalog and rejected in current build selections', () => {
  assert.deepEqual(
    elementalistCatalog.skills.filter((skill) => skill.name.startsWith('Primordial Stance')).map((skill) => skill.id),
    [ID.PRIMORDIAL_STANCE]
  );
  assert.equal(elementalistCatalog.skillsById.get(ID.PRIMORDIAL_STANCE).attunement, undefined);
  for (const id of [-1167, -1168, -1169]) {
    assert.equal(elementalistCatalog.skillsById.has(id), false);
    const defaults = createElementalistBuildDefaults();
    assert.throws(
      () =>
        migrateElementalistBuild({
          ...defaults,
          selectedSkillIds: { ...defaults.selectedSkillIds, Utility1: id }
        }),
      /Unknown selected skill ID/
    );
  }
});

test('stance palette and highlight identities remain the same in every live attunement', () => {
  const { app } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Weaver']],
    selectedSkillIds: {
      ...createElementalistBuildDefaults().selectedSkillIds,
      Utility1: ID.PRIMORDIAL_STANCE
    }
  });
  const keys = new Set();
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    app.analysis.state.results = {
      planningState: {
        availability: {},
        cooldownsBySkillId: {},
        ammoBySkillId: {},
        profession: { [STATE.PRIMARY_ATTUNEMENT]: element, [STATE.SECONDARY_ATTUNEMENT]: 'Earth' }
      }
    };
    const displayed = rotationSelectedSlotSkills(capturePaletteInput(app)).find(
      (skill) => skill.id === ID.PRIMORDIAL_STANCE
    );
    assert.ok(displayed);
    const view = paletteSkillView(capturePaletteInput(app), displayed);
    assert.equal(view.skillId, ID.PRIMORDIAL_STANCE);
    assert.equal(view.displaySkillId, undefined);
    keys.add(rotationSkillHighlightKey({ type: 'cast', skillId: view.skillId }));
  }

  assert.deepEqual([...keys], ['skill:40183']);
});
