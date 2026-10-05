import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  toApplicationBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { getMesmerBuildRotationLookup } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Loads a default Mesmer build with authored rotation entries and any overridden saved fields. */
function migrate(rotation, overrides = {}) {
  return migrateMesmerBuild({ ...createMesmerBuildDefaults(), ...overrides, rotation });
}

/** Replaces the default elite line so name lookup follows the normal trait-line selection path. */
function withThirdLine(name) {
  const specializations = createMesmerBuildDefaults().specializations;
  specializations[2] = { name, traits: '1-1-1' };
  return specializations;
}

const castIds = (build) => build.rotation.map((command) => command.skillId);

// Each recognized selection keeps one isolated lookup, and unmatched input reuses Core instead of adding cache keys.
test('build rotation lookups are reused per effective selection', () => {
  const selections = ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'];
  const lookups = selections.map((specialization) => getMesmerBuildRotationLookup(specialization));
  const [core, , mirage, virtuoso] = lookups;

  assert.equal(new Set(lookups).size, selections.length);
  selections.forEach((specialization, index) =>
    assert.strictEqual(getMesmerBuildRotationLookup(specialization), lookups[index], specialization)
  );
  for (const unmatched of ['Unknown', ' Virtuoso', 'virtuoso', 42, undefined]) {
    assert.strictEqual(getMesmerBuildRotationLookup(unmatched), core, String(unmatched));
  }

  assert.equal(virtuoso.skillsByName.get('Bladecall').id, ID.BLADECALL);
  assert.equal(core.skillsByName.get('Bladecall').id, ID.BLADECALL_NON_VIRTUOSO);
  assert.equal(mirage.skillsByName.get('Axes of Symmetry').id, ID.AXES_OF_SYMMETRY);
  assert.equal(core.skillsByName.get('Axes of Symmetry').id, ID.AXES_OF_SYMMETRY_NON_MIRAGE);
});

// Specialization replacements must resolve authored names to the selected elite's identities on every load.
test('selected specializations resolve replacement names to their own skills', () => {
  const rotation = ['Bladecall', { name: 'Axes of Symmetry' }, { type: 'cast', name: 'Lingering Thoughts' }];
  const nonElite = [ID.BLADECALL_NON_VIRTUOSO, ID.AXES_OF_SYMMETRY_NON_MIRAGE, ID.LINGERING_THOUGHTS_NON_MIRAGE];
  const cases = [
    ['Chaos', nonElite],
    ['Chronomancer', nonElite],
    ['Mirage', [ID.BLADECALL_NON_VIRTUOSO, ID.AXES_OF_SYMMETRY, ID.LINGERING_THOUGHTS]],
    ['Virtuoso', [ID.BLADECALL, ID.AXES_OF_SYMMETRY_NON_MIRAGE, ID.LINGERING_THOUGHTS_NON_MIRAGE]],
    ['Troubadour', nonElite]
  ];

  // The second round revisits each selection after the others so reused lookups cannot carry replacements across.
  for (const round of [1, 2]) {
    for (const [line, expected] of cases) {
      assert.deepEqual(
        castIds(migrate(rotation, { specializations: withThirdLine(line) })),
        expected,
        `${line} ${round}`
      );
    }
  }
});

// Profession-wide Troubadour name choices apply only when Troubadour contributes those skills.
test('Troubadour instrument names resolve only with Troubadour selected', () => {
  const rotation = ['Lively Lute', 'Harmonious Harp'];
  const troubadour = migrate(rotation, { specializations: withThirdLine('Troubadour') });
  assert.deepEqual(castIds(troubadour), [ID.LIVELY_LUTE, ID.HARMONIOUS_HARP_ALTERNATE]);

  const core = migrate(rotation, { specialization: 'Core' });
  assert.deepEqual(castIds(core), rotation);
  assert.deepEqual(validateMesmerBuild(core).errors, [
    'rotation contains unknown skill Lively Lute.',
    'rotation contains unknown skill Harmonious Harp.'
  ]);
});

// A saved specialization controls name lookup ahead of the elite trait line; missing input inherits Virtuoso defaults.
test('saved specialization precedence is shared by migration and application loading', () => {
  for (const load of [migrateMesmerBuild, toApplicationBuild]) {
    const defaults = createMesmerBuildDefaults();
    const explicitCore = load({ ...defaults, specialization: 'Core', rotation: ['Bladecall'] });
    const conflictingElite = load({
      ...defaults,
      specialization: 'Mirage',
      rotation: ['Bladecall', 'Axes of Symmetry']
    });
    const absent = load({ rotation: ['Bladecall'] });

    assert.deepEqual(castIds(explicitCore), [ID.BLADECALL_NON_VIRTUOSO], load.name);
    assert.deepEqual(castIds(conflictingElite), [ID.BLADECALL_NON_VIRTUOSO, ID.AXES_OF_SYMMETRY], load.name);
    assert.deepEqual(castIds(absent), [ID.BLADECALL], load.name);
  }
});

// Current loading semantics, not recommended authoring formats: only an exact elite module ID selects that elite,
// falsy values defer to the trait lines, and every other value resolves names with Core alone.
test('explicit specialization values keep their existing lookup selection', () => {
  for (const [specialization, expected] of [
    ['', ID.BLADECALL],
    [null, ID.BLADECALL],
    [0, ID.BLADECALL],
    [' Virtuoso', ID.BLADECALL_NON_VIRTUOSO],
    ['virtuoso', ID.BLADECALL_NON_VIRTUOSO],
    ['Unknown', ID.BLADECALL_NON_VIRTUOSO],
    [42, ID.BLADECALL_NON_VIRTUOSO],
    [{}, ID.BLADECALL_NON_VIRTUOSO]
  ]) {
    assert.deepEqual(castIds(migrate(['Bladecall'], { specialization })), [expected], JSON.stringify(specialization));
  }
});

// Selected name lookup must not rewrite or newly reject identities the author supplied explicitly.
test('explicit skill IDs bypass selected name lookup and keep full-catalog validation', () => {
  const virtuoso = migrate([{ type: 'cast', skillId: ID.BLADECALL_NON_VIRTUOSO, name: 'Bladecall' }]);
  assert.deepEqual(virtuoso.rotation, [{ type: 'cast', skillId: ID.BLADECALL_NON_VIRTUOSO }]);

  const core = migrate([{ type: 'cast', skillId: ID.LIVELY_LUTE }], { specialization: 'Core' });
  assert.deepEqual(core.rotation, [{ type: 'cast', skillId: ID.LIVELY_LUTE }]);
  assert.deepEqual(validateMesmerBuild(core), { valid: true, errors: [] });
});
