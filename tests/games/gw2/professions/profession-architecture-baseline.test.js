import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistNativeModules } from '#gw2/professions/elementalist/profession.js';
import { engineerNativeModules } from '#gw2/professions/engineer/profession.js';
import { guardianNativeModules } from '#gw2/professions/guardian/profession.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/profession.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/profession.js';
import { rangerNativeModules } from '#gw2/professions/ranger/profession.js';
import { revenantNativeModules } from '#gw2/professions/revenant/profession.js';
import { thiefNativeModules } from '#gw2/professions/thief/profession.js';
import { warriorNativeModules } from '#gw2/professions/warrior/profession.js';

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
