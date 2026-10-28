import assert from 'node:assert/strict';
import test from 'node:test';
import { insertRotationEntries, moveRotationEntry, updateRotationEntry } from '#gw2/app/rotation/editing/operations.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { addRotation, createRotationItem, insertRotationItems } from '#gw2/app/rotation/editing/actions.js';

test('rotation editing operations update, insert, and reject invalid moves', () => {
  assert.deepEqual(updateRotationEntry({ type: 'cast', skillId: 'One' }, { concurrentOffsetMs: 100 }), {
    type: 'cast',
    skillId: 'One',
    concurrentOffsetMs: 100
  });
  assert.deepEqual(
    updateRotationEntry(
      { type: 'cast', skillId: 'One', interruptAfterMs: 250 },
      {
        interruptAfterMs: undefined
      }
    ),
    { type: 'cast', skillId: 'One' }
  );

  const command = (skillId) => ({ type: 'cast', skillId });
  const rotation = [command('A'), command('B'), command('C')];

  assert.equal(moveRotationEntry(rotation, 0, 3), true);
  assert.deepEqual(rotation, [command('B'), command('C'), command('A')]);
  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.equal(moveRotationEntry(rotation, -1, 1), false);
  assert.equal(moveRotationEntry(rotation, 0, 1.5), false);
  assert.equal(insertRotationEntries(rotation, [command('D')], 1), true);
  assert.deepEqual(rotation, [command('B'), command('D'), command('C'), command('A')]);
  assert.equal(insertRotationEntries(rotation, [command('Macro A'), command('Macro B')], 2), true);
  assert.deepEqual(rotation, [
    command('B'),
    command('D'),
    command('Macro A'),
    command('Macro B'),
    command('C'),
    command('A')
  ]);
  assert.equal(insertRotationEntries(rotation, [], 0), false);
});

test('rotation drag reordering respects before and after insertion positions', () => {
  const command = (skillId) => ({ type: 'cast', skillId });
  const rotation = [command('Bladecall'), command('Mirror Blade'), command('Mind Spike')];

  assert.equal(moveRotationEntry(rotation, 0, 2), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 2, 0), true);
  assert.deepEqual(rotation, [command('Mind Spike'), command('Mirror Blade'), command('Bladecall')]);

  assert.equal(moveRotationEntry(rotation, 0, rotation.length), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);
});

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
  insertRotationItems(app, [
    { type: 'cast', skillId: 'Third' },
    { type: 'cast', skillId: 'Fourth' }
  ]);

  assert.deepEqual(app.build.rotation, [
    { type: 'cast', skillId: 'First' },
    { type: 'cast', skillId: 'Second' },
    { type: 'cast', skillId: 'Third' },
    { type: 'cast', skillId: 'Fourth' },
    { type: 'cast', skillId: 'Last' }
  ]);
  assert.equal(app.rotationInsertionIndex, 4);
  assert.deepEqual(changes, [
    [false, false, { deferRotationRender: true }],
    [false, false, { deferRotationRender: true }]
  ]);
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
