/** Checks palette identity translation through the complete application edit path. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { addRotation, createRotationItem } from '#gw2/app/rotation/editing/actions.js';
import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';

test('palette additions insert at an armed cursor and advance it', () => {
  const changes = [];
  const app = {
    patch: patchSelectionFixture({ skillsById: new Map(), skills: [] }),
    build: {
      rotation: [
        { type: 'cast', skillId: 'First' },
        { type: 'cast', skillId: 'Last' }
      ]
    },
    rotationInsertionIndex: 1,
    activeCatalog: { skillsById: new Map(), skills: [] },
    changed: (...args) => {
      changes.push(args);
    }
  };

  addRotation(app, 'Second');
  commitRotationEdit(app, {
    type: 'insert',
    entries: [
      { type: 'cast', skillId: 'Third' },
      { type: 'cast', skillId: 'Fourth' }
    ]
  });

  assert.deepEqual(app.build.rotation, [
    { type: 'cast', skillId: 'First' },
    { type: 'cast', skillId: 'Second' },
    { type: 'cast', skillId: 'Third' },
    { type: 'cast', skillId: 'Fourth' },
    { type: 'cast', skillId: 'Last' }
  ]);
  assert.equal(app.rotationInsertionIndex, 4);
  assert.deepEqual(
    changes.map(([rebuildStatic, rebuildGear]) => [rebuildStatic, rebuildGear]),
    [
      [false, false],
      [false, false]
    ]
  );
});

test('rotation items preserve default interrupts when options contain nullish values', () => {
  const skill = { id: 1, name: 'Counter', defaultInterruptMs: 120 };
  const app = {
    build: {},
    adapter: { createBuildContext: () => ({ simulationConfig: () => ({}) }) },
    profession: { runtimeFor: () => ({}) },
    patch: patchSelectionFixture({
      skillsById: new Map([[skill.id, skill]]),
      skills: [{ name: skill.name, ...skill }]
    }),
    activeCatalog: { skillsById: new Map([[skill.id, skill]]), skills: [{ name: skill.name, ...skill }] }
  };

  assert.deepEqual(createRotationItem(app, skill.name, { skillId: skill.id, interruptAfterMs: undefined }), {
    type: 'cast',
    skillId: skill.id,
    interruptAfterMs: 120
  });
  assert.deepEqual(createRotationItem(app, skill.name, { skillId: skill.id, interruptAfterMs: null }), {
    type: 'cast',
    skillId: skill.id,
    interruptAfterMs: 120
  });
  assert.equal(createRotationItem(app, skill.name, { skillId: skill.id, offTarget: true }).offTarget, true);
});
