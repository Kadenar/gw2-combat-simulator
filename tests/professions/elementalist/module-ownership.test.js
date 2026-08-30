import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistProfession } from '../../../js/games/gw2/content/professions/elementalist/definition.js';
import { elementalistCoreModule } from '../../../js/games/gw2/content/professions/elementalist/core/module.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../js/games/gw2/content/professions/elementalist/data/ids.js';
import { catalystModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/catalyst/module.js';
import { evokerModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/evoker/module.js';
import { weaverModule } from '../../../js/games/gw2/content/professions/elementalist/specializations/weaver/module.js';
import {
  WEAVER_SKILL_MECHANICS,
  weaverDualAttunements
} from '../../../js/games/gw2/content/professions/elementalist/specializations/weaver/skills/index.js';

const SPECIALIZATION_STATE_KEYS = Object.freeze({
  Tempest: ['latentStaminaReadyAt'],
  Weaver: ['secondaryAttunement', 'unravelUntil', 'weaveSelfUntil', 'superiorElementsReadyAt'],
  Catalyst: ['energy', 'sphereActiveUntil', 'elementalEpitomeReadyAt'],
  Evoker: ['charges', 'empowered', 'attunementTraitProcReadyAt']
});

function modifierIds(module) {
  const modifiers = module.mechanics.modifiers;
  const rules = Array.isArray(modifiers) ? modifiers : modifiers.modifierRules;
  return new Set(rules.map((rule) => rule.id));
}

test('Elementalist runtimes keep elite state in the active specialization slice', () => {
  for (const active of ['Core', ...Object.keys(SPECIALIZATION_STATE_KEYS)]) {
    const config = { specialization: active, startAttunement: 'Fire', secondaryAttunement: 'Water' };
    const state = elementalistProfession.resolveRuntime(config).createProfessionState(config);
    assert.equal(state.specialization.kind, active);
    for (const [owner, keys] of Object.entries(SPECIALIZATION_STATE_KEYS)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
        assert.equal(Object.hasOwn(state.specialization.state, key), owner === active, `${active}:${owner}:${key}`);
      }
    }
  }
});

test('elite modifier and dual-pistol profiles are declared by their owners', () => {
  const coreModifiers = modifierIds(elementalistCoreModule);
  assert.equal(coreModifiers.has('elementalist.empowering-auras-strike'), false);
  assert.equal(coreModifiers.has('elementalist.fiery-might'), false);
  assert.equal(modifierIds(catalystModule).has('elementalist.empowering-auras-strike'), true);
  assert.equal(modifierIds(evokerModule).has('elementalist.fiery-might'), true);

  const coreProfiles = new Set(elementalistCoreModule.data.balanceProfiles.map((profile) => profile.id));
  const weaverProfiles = new Set(weaverModule.data.balanceProfiles.map((profile) => profile.id));
  for (const id of [
    'elementalist.weaver.frostfire-flurry-bullets',
    'elementalist.weaver.purblinding-plasma-bullet',
    'elementalist.weaver.molten-meteor-bullet',
    'elementalist.weaver.flowing-finesse-bullets',
    'elementalist.weaver.enervating-earth-bullet'
  ]) {
    assert.equal(coreProfiles.has(id), false, id);
    assert.equal(weaverProfiles.has(id), true, id);
  }
});

test('Weaver dual-attunement mechanics parse their elements from skill metadata', () => {
  assert.deepEqual(weaverDualAttunements(WEAVER_SKILL_MECHANICS[ID.FIERY_FROST]), ['Fire', 'Water']);
  assert.deepEqual(weaverDualAttunements(WEAVER_SKILL_MECHANICS[ID.TWIN_STRIKE]), ['Fire', 'Water']);
  assert.equal(weaverDualAttunements({ attunement: 'Fire' }), null);
  assert.equal(weaverDualAttunements({ attunement: 'Fire+Fire' }), null);
  assert.equal(weaverDualAttunements({ attunement: 'Fire+Void' }), null);
});
