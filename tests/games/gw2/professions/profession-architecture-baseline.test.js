import { elementalistNativeModules } from '#gw2/professions/elementalist/profession.js';
import { engineerNativeModules } from '#gw2/professions/engineer/profession.js';
import { guardianNativeModules } from '#gw2/professions/guardian/profession.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/profession.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/profession.js';
import { rangerNativeModules } from '#gw2/professions/ranger/profession.js';
import { revenantNativeModules } from '#gw2/professions/revenant/profession.js';
import { thiefNativeModules } from '#gw2/professions/thief/profession.js';
import { warriorNativeModules } from '#gw2/professions/warrior/profession.js';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const PROFESSION_MODULES = Object.freeze({
  elementalist: elementalistNativeModules,
  engineer: engineerNativeModules,
  guardian: guardianNativeModules,
  mesmer: mesmerNativeModules,
  necromancer: necromancerNativeModules,
  ranger: rangerNativeModules,
  revenant: revenantNativeModules,
  thief: thiefNativeModules,
  warrior: warriorNativeModules
});

const EXPECTED_MODULE_IDS = Object.freeze({
  elementalist: ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker'],
  engineer: ['Core', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam'],
  guardian: ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary'],
  mesmer: ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'],
  necromancer: ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist'],
  ranger: ['Core', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot'],
  revenant: ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit'],
  thief: ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary'],
  warrior: ['Core', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon']
});

test('native profession module order and semantic owners remain stable during migration', () => {
  assert.equal(Object.keys(PROFESSION_MODULES).length, 9);

  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    assert.deepEqual(
      modules.map((module) => module.id),
      EXPECTED_MODULE_IDS[profession],
      profession
    );
    assert.equal(modules[0].id, 'Core', profession);
    assert.equal(new Set(modules.map((module) => module.id)).size, modules.length, profession);

    for (const module of modules) {
      assert.equal(module.kind, 'native-profession-module', `${profession}/${module.id}`);
      assert.equal(typeof module.state.create, 'function', `${profession}/${module.id}`);
      assert.ok(module.data && typeof module.data === 'object', `${profession}/${module.id}`);
    }
  }
});

test('profession modules register runtime behavior only through hooks', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const label = `${profession}/${module.id}`;

      // Every supported module owns one hook table; the module validator rejects retired phase sections.
      assert.ok(module.hooks, label);
      assert.equal(module.data.handlers, undefined, `${label}/data.handlers`);
    }
  }
});

// Authored hook/modifier tables use sibling files; traits can supply the entire contribution through registration.
const MODULE_FILE_BY_KEY = Object.freeze({ hooks: 'hooks.js', modifiers: 'modifiers.js' });

test('module manifests import authored hook/modifier tables from siblings or register trait definitions', () => {
  const professionsUrl = new URL('../../../../js/games/gw2/professions/', import.meta.url);
  for (const profession of Object.keys(PROFESSION_MODULES)) {
    const specializations = readdirSync(new URL(`${profession}/specializations/`, professionsUrl));
    for (const directory of ['core', ...specializations.map((name) => `specializations/${name}`)]) {
      const label = `${profession}/${directory}`;
      const source = readFileSync(new URL(`${label}/module.ts`, professionsUrl), 'utf8');
      for (const [key, file] of Object.entries(MODULE_FILE_BY_KEY)) {
        const binding = source.match(new RegExp(`^\\s+${key}: (\\w+),?$`, 'm'))?.[1];
        if (!binding) {
          // Named and shorthand trait registrations both supply real owners through the same module contract.
          const module = PROFESSION_MODULES[profession].find(
            (entry) => entry.id.toLowerCase() === directory.split('/').at(-1)
          );
          assert.match(source, /^\s+traitDefinitions\s*[:,]/m, `${label} declares its trait owners`);
          assert.ok(module.traitDefinitions?.length, `${label} derives ${key} from registered traits`);
          continue;
        }

        const specifier = [...source.matchAll(/import \{([^}]*)\} from '([^']+)';/g)].find(([, names]) =>
          new RegExp(`\\b${binding}\\b`).test(names)
        )?.[2];
        assert.equal(specifier, `#gw2/professions/${label}/${file}`, `${label}.${key}`);
      }
    }
  }
});

// A hooks file only assembles its module's callbacks; shared helpers live in mechanics/ or traits/ so nothing cycles back.
test('only a module manifest imports its hooks file', () => {
  const sourceRoot = new URL('../../../../js/games/gw2/', import.meta.url);
  const importers = [];
  for (const entry of readdirSync(sourceRoot, { recursive: true })) {
    const file = String(entry).replaceAll('\\', '/');
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(new URL(file, sourceRoot), 'utf8');
    for (const [, owner] of source.matchAll(/from '#gw2\/(professions\/[^']+)\/hooks\.js'/g)) {
      if (file !== `${owner}/module.ts`) importers.push(`${file} -> ${owner}/hooks.js`);
    }
  }

  assert.deepEqual(importers, []);
});

test('independent simulations never share a mutable state instance', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const config = { specialization: module.id };
      const first = module.state.create(config);
      const second = module.state.create(config);
      const label = `${profession}/${module.id}`;

      assert.notEqual(first, second, label);
      assert.doesNotThrow(() => structuredClone(first), `${label}/first`);
      assert.doesNotThrow(() => structuredClone(second), `${label}/second`);
    }
  }
});
