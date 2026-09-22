import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  toApplicationBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild
} from '#gw2/professions/guardian/build/build.js';
import {
  createWarriorBuildDefaults,
  migrateWarriorBuild,
  validateWarriorBuild
} from '#gw2/professions/warrior/build/build.js';

// These focused cases prove profession descriptors own normalization and validation together.
test('application normalization retains profession fields and applies Quickness without changing migration policy', () => {
  const saved = {
    ...createElementalistBuildDefaults(),
    assumptions: { quickness: false },
    startAttunement: 'Water',
    pistolBullets: { Fire: true }
  };
  const before = structuredClone(saved);
  const migrated = migrateElementalistBuild(saved);
  const application = toApplicationBuild(saved);

  assert.equal(migrated.assumptions.quickness, false);
  assert.deepEqual(application, { ...migrated, assumptions: { ...migrated.assumptions, quickness: true } });
  assert.equal(application.profession, 'elementalist');
  assert.equal(application.startAttunement, 'Water');
  assert.deepEqual(application.pistolBullets, { Fire: true, Water: false, Air: false, Earth: false });
  assert.equal(validateElementalistBuild(saved).valid, false);
  assert.equal(validateElementalistBuild(application).valid, true);
  assert.deepEqual(saved, before);
});

test('bounded-number build fields use canonical defaults and inclusive bounds', () => {
  const defaults = createWarriorBuildDefaults();

  assert.equal(migrateWarriorBuild({}).initialResource, 0);
  assert.equal(migrateWarriorBuild({ initialResource: -1 }).initialResource, 0);
  assert.equal(migrateWarriorBuild({ initialResource: 0 }).initialResource, 0);
  assert.equal(migrateWarriorBuild({ initialResource: '37.5' }).initialResource, 37.5);
  assert.equal(migrateWarriorBuild({ initialResource: 100 }).initialResource, 100);
  assert.equal(migrateWarriorBuild({ initialResource: 101 }).initialResource, 100);

  assert.equal(validateWarriorBuild({ ...defaults, initialResource: 0 }).valid, true);
  assert.equal(validateWarriorBuild({ ...defaults, initialResource: 100 }).valid, true);
  assert.match(
    validateWarriorBuild({ ...defaults, initialResource: -1 }).errors.join(' '),
    /initialResource must be between 0 and 100/
  );
  assert.match(
    validateWarriorBuild({ ...defaults, initialResource: 101 }).errors.join(' '),
    /initialResource must be between 0 and 100/
  );
});

test('bounded-integer build fields truncate persisted values and reject fractional canonical values', () => {
  const defaults = createGuardianBuildDefaults();

  assert.equal(migrateGuardianBuild({}).initialTomePages, 5);
  assert.equal(migrateGuardianBuild({ initialTomePages: -1 }).initialTomePages, 0);
  assert.equal(migrateGuardianBuild({ initialTomePages: '4.9' }).initialTomePages, 4);
  assert.equal(migrateGuardianBuild({ initialTomePages: 9 }).initialTomePages, 8);

  assert.equal(validateGuardianBuild({ ...defaults, initialTomePages: 4 }).valid, true);
  assert.match(
    validateGuardianBuild({ ...defaults, initialTomePages: 4.5 }).errors.join(' '),
    /initialTomePages must be between 0 and 8/
  );
});

test('enum build fields restore missing or invalid values and reject them before migration', () => {
  const defaults = createElementalistBuildDefaults();
  const missingEvokerElement = { ...defaults };
  delete missingEvokerElement.evokerElement;

  assert.equal(migrateElementalistBuild({}).startAttunement, 'Fire');
  assert.equal(migrateElementalistBuild({ startAttunement: 'Void' }).startAttunement, 'Fire');
  // Persisted enum values must match exactly, without case folding or coercion.
  assert.equal(migrateElementalistBuild({ startAttunement: 'Water' }).startAttunement, 'Water');
  assert.equal(migrateElementalistBuild({ startAttunement: 'water' }).startAttunement, 'Fire');
  assert.equal(migrateElementalistBuild({ startAttunement: 2 }).startAttunement, 'Fire');
  assert.equal(migrateElementalistBuild({ secondaryAttunement: 'Earth' }).secondaryAttunement, 'Earth');
  assert.equal(validateElementalistBuild(missingEvokerElement).valid, false);
  assert.match(
    validateElementalistBuild({ ...defaults, evokerElement: 'Void' }).errors.join(' '),
    /evokerElement must be Fire, Water, Air, or Earth/
  );
});
