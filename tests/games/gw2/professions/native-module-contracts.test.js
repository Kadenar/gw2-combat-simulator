import assert from 'node:assert/strict';
import test from 'node:test';

import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
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

// Actual module lists need a unique Core-first order; assembly validation owns their structural schema.
test('native profession modules expose valid assembly contracts', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    assert.equal(modules[0].id, 'Core', profession);
    assert.equal(new Set(modules.map((module) => module.id)).size, modules.length, profession);
  }
});

test('independent simulations never share a mutable state instance', () => {
  for (const [profession, modules] of Object.entries(PROFESSION_MODULES)) {
    for (const module of modules) {
      const config = { specialization: module.id };
      const first = module.state.create(config, {
        attributes: { vitality: 1000 },
        balanceContext: { catalog: getNativeCatalogAssembly(modules).catalog, modifierRulesById: new Map() }
      });
      const second = module.state.create(config, {
        attributes: { vitality: 1000 },
        balanceContext: { catalog: getNativeCatalogAssembly(modules).catalog, modifierRulesById: new Map() }
      });
      const label = `${profession}/${module.id}`;

      assert.notEqual(first, second, label);
      assert.doesNotThrow(() => structuredClone(first), `${label}/first`);
      assert.doesNotThrow(() => structuredClone(second), `${label}/second`);
    }
  }
});
