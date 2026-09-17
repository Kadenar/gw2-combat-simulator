import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Professions that adopted docs/architecture/PROFESSION-LAYOUT-PLAN.md. Keep in sync with eslint.config.js.
const MIGRATED_PROFESSIONS = ['engineer', 'necromancer', 'elementalist'];

const PROFESSIONS_ROOT = path.resolve(import.meta.dirname, '../../js/games/gw2/professions');
const ROOT_FILES = new Set(['profession.ts', 'catalog.ts', 'family-state.ts', 'family-presentation.ts', 'types.d.ts']);
const REQUIRED_ROOT_FILES = ['profession.ts', 'catalog.ts', 'family-state.ts', 'types.d.ts'];
const ROOT_FOLDERS = new Set(['app', 'build', 'data', 'core', 'specializations']);
const TOP_LEVEL_DECLARATION = /^(export )?(const|function|let|class) /gm;
const MODULE_DECLARATION = /^export const \w+ = defineNativeModule\(/m;

function pascalCase(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Lists each module folder with its manifest path and the state interface its state.ts owns. */
function professionModules(profession) {
  const root = path.join(PROFESSIONS_ROOT, profession);
  const specializationsRoot = path.join(root, 'specializations');
  const specializations = existsSync(specializationsRoot)
    ? readdirSync(specializationsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
          folder: path.join(specializationsRoot, entry.name),
          stateInterface: `${pascalCase(entry.name)}State`
        }))
    : [];
  return [
    { folder: path.join(root, 'core'), stateInterface: `${pascalCase(profession)}CoreState` },
    ...specializations
  ];
}

for (const profession of MIGRATED_PROFESSIONS) {
  const root = path.join(PROFESSIONS_ROOT, profession);

  test(`${profession} root contains only the family files and module folders`, () => {
    const unexpected = readdirSync(root, { withFileTypes: true })
      .filter((entry) => (entry.isDirectory() ? !ROOT_FOLDERS.has(entry.name) : !ROOT_FILES.has(entry.name)))
      .map((entry) => entry.name);
    assert.deepEqual(unexpected, []);
    for (const file of REQUIRED_ROOT_FILES) assert.ok(existsSync(path.join(root, file)), `missing ${file}`);
    assert.equal(existsSync(path.join(root, 'catalog')), false, 'catalog/ moved to data/module-data.ts');
  });

  test(`${profession} module.ts files are manifests`, () => {
    for (const { folder } of professionModules(profession)) {
      const manifest = path.join(folder, 'module.ts');
      if (!existsSync(manifest)) continue;
      const source = readFileSync(manifest, 'utf8');
      const declarations = source.match(TOP_LEVEL_DECLARATION) || [];
      assert.equal(declarations.length, 1, `${manifest} declares ${declarations.length} top-level bindings`);
      assert.match(source, MODULE_DECLARATION, `${manifest} must export one defineNativeModule(...) call`);
    }
  });

  test(`${profession} module state interfaces live next to their state factories`, () => {
    const types = readFileSync(path.join(root, 'types.d.ts'), 'utf8');
    for (const { folder, stateInterface } of professionModules(profession)) {
      if (!existsSync(path.join(folder, 'state.ts'))) continue;
      assert.doesNotMatch(
        types,
        new RegExp(`\\binterface ${stateInterface}\\b`),
        `${stateInterface} belongs in ${path.relative(root, path.join(folder, 'state.ts'))}`
      );
    }
  });
}
