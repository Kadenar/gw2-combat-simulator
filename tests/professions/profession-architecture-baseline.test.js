import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { elementalistNativeModules } from '../../js/games/gw2/content/professions/elementalist/modules.js';
import { engineerNativeModules } from '../../js/games/gw2/content/professions/engineer/modules.js';
import { guardianNativeModules } from '../../js/games/gw2/content/professions/guardian/modules.js';
import { mesmerNativeModules } from '../../js/games/gw2/content/professions/mesmer/modules.js';
import { necromancerNativeModules } from '../../js/games/gw2/content/professions/necromancer/modules.js';
import { rangerNativeModules } from '../../js/games/gw2/content/professions/ranger/modules.js';
import { revenantNativeModules } from '../../js/games/gw2/content/professions/revenant/modules.js';
import { thiefNativeModules } from '../../js/games/gw2/content/professions/thief/modules.js';
import { warriorNativeModules } from '../../js/games/gw2/content/professions/warrior/modules.js';

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

const RETIRED_OWNERSHIP_FILENAMES = new Set(['resolver.ts', 'rule-helpers.ts', 'rules.ts', 'scheduler.ts']);
const RETIRED_PHASE_DIRECTORIES = new Set(['execution', 'resolution', 'resolver', 'scheduler']);
const IMPORT_SPECIFIER_PATTERN = /\b(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;

function collectTypeScriptSources(directoryUrl, relativeDirectory = '') {
  return readdirSync(directoryUrl, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directoryUrl);

      if (entry.isDirectory()) return collectTypeScriptSources(url, relativePath);
      if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
      return [{ relativePath, source: readFileSync(url, 'utf8') }];
    });
}

function professionSources(profession) {
  return collectTypeScriptSources(new URL(`../../js/games/gw2/content/professions/${profession}/`, import.meta.url));
}

function relativeImportTargets({ relativePath, source }) {
  return [...source.matchAll(IMPORT_SPECIFIER_PATTERN)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => posix.normalize(posix.join(posix.dirname(relativePath), specifier)));
}

function schedulerDeclarations(module) {
  const availability = module.mechanics?.execution?.availability;

  return [
    ...(availability == null ? [] : Array.isArray(availability) ? availability : [availability]),
    ...(module.mechanics?.execution?.castLifecycle || [])
  ];
}

function resolverDeclarations(module) {
  return module.mechanics?.resolution?.reactions || [];
}

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
      assert.equal(typeof module.state.scheduler, 'function', `${profession}/${module.id}`);
      assert.ok(module.data && typeof module.data === 'object', `${profession}/${module.id}`);
    }
  }
});

test('phase-explicit native declarations retain their scheduler and resolver discriminants', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const label = `${profession}/${module.id}`;

      for (const declaration of schedulerDeclarations(module)) {
        assert.equal(declaration.phase, 'scheduler', `${label}/${declaration.id}`);
        assert.equal(typeof declaration.handler, 'function', `${label}/${declaration.id}`);
        assert.ok(Number.isFinite(declaration.order), `${label}/${declaration.id}`);
      }

      for (const declaration of resolverDeclarations(module)) {
        assert.equal(declaration.phase, 'resolver', `${label}/${declaration.id}`);
        assert.equal(typeof declaration.handler, 'function', `${label}/${declaration.id}`);
        assert.ok(Number.isFinite(declaration.order), `${label}/${declaration.id}`);
      }
    }
  }
});

test('profession modules register phase behavior only through explicit sections', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const label = `${profession}/${module.id}`;

      assert.ok(module.mechanics.execution, `${label}/execution`);
      assert.equal(module.data.handlers, undefined, `${label}/data.handlers`);

      for (const legacyKey of [
        'availability',
        'castLifecycle',
        'skillMechanicHandlers',
        'castRules',
        'schedulerHooks',
        'resolverHooks',
        'reactions'
      ]) {
        assert.equal(module.mechanics[legacyKey], undefined, `${label}/mechanics.${legacyKey}`);
      }
    }
  }
});

test('profession content keeps semantic ownership names instead of phase-mirrored trees', () => {
  for (const profession of Object.keys(PROFESSION_MODULES)) {
    for (const { relativePath } of professionSources(profession)) {
      const segments = relativePath.split('/');
      const filename = segments.at(-1);

      assert.equal(
        RETIRED_OWNERSHIP_FILENAMES.has(filename),
        false,
        `${profession}/${relativePath} uses a retired generic filename`
      );

      for (const directory of segments.slice(0, -1)) {
        assert.equal(
          RETIRED_PHASE_DIRECTORIES.has(directory),
          false,
          `${profession}/${relativePath} belongs in a GW2 concept directory, not ${directory}/`
        );
      }
    }
  }
});

test('Core never depends on elite content and elite specializations never depend on siblings', () => {
  for (const profession of Object.keys(PROFESSION_MODULES)) {
    for (const source of professionSources(profession)) {
      const { relativePath } = source;

      for (const target of relativeImportTargets(source)) {
        if (relativePath.startsWith('core/')) {
          assert.equal(
            target.startsWith('specializations/'),
            false,
            `${profession}/${relativePath} imports elite content ${target}`
          );
        }

        const sourceSpecialization = relativePath.match(/^specializations\/([^/]+)\//)?.[1];
        const targetSpecialization = target.match(/^specializations\/([^/]+)\//)?.[1];

        if (sourceSpecialization && targetSpecialization) {
          assert.equal(
            targetSpecialization,
            sourceSpecialization,
            `${profession}/${relativePath} imports sibling specialization ${target}`
          );
        }
      }
    }
  }
});

test('scheduler and resolver state factories never share a mutable state instance', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const config = { specialization: module.id };
      const schedulerState = module.state.scheduler(config);
      const resolverState = (module.state.resolver || module.state.scheduler)(config);
      const label = `${profession}/${module.id}`;

      assert.notEqual(schedulerState, resolverState, label);
      assert.doesNotThrow(() => structuredClone(schedulerState), `${label}/scheduler`);
      assert.doesNotThrow(() => structuredClone(resolverState), `${label}/resolver`);
    }
  }
});
