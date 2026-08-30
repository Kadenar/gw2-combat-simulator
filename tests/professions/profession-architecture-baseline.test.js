import assert from 'node:assert/strict';
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

function schedulerDeclarations(module) {
  const availability = module.mechanics?.execution?.availability ?? module.mechanics?.availability;

  return [
    ...(availability == null ? [] : Array.isArray(availability) ? availability : [availability]),
    ...(module.mechanics?.execution?.castLifecycle || module.mechanics?.castLifecycle || [])
  ];
}

function resolverDeclarations(module) {
  return module.mechanics?.resolution?.reactions || module.mechanics?.reactions || [];
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
