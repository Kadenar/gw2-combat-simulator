// Every profession's explicit declarations must survive application and selected runtime catalog assembly.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activationInputKind } from '#gw2/platform/skills/autoattack-chain-index.js';

for (const professionId of [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
]) {
  test(`${professionId} keeps declared chains and input metadata in each runtime catalog`, async () => {
    const exports = await import(`#gw2/professions/${professionId}/profession.js`);
    const profession = exports[`${professionId}Profession`];
    const modules = exports[`${professionId}NativeModules`];
    const catalog = profession.catalog;
    const declared = modules.flatMap((module) => module.data.autoattackChains ?? []);
    assert.deepEqual(catalog.autoattackChains, declared);
    for (const module of modules) {
      // Authored flags must classify inputs before catalog assembly supplies chain metadata.
      for (const id of (module.data.autoattackChains ?? []).flat()) {
        const authored = {
          ...module.data.skills?.find((skill) => skill.id === id)
        };
        assert.equal(typeof authored.autoattack, 'boolean', `${module.id}: skill ${id} needs an explicit input flag`);
        assert.equal(catalog.skillsById.get(id).autoattack, authored.autoattack);
      }

      const runtimeCatalog = profession.runtimeFor({ specialization: module.id }).catalog;
      // A chain is available exactly when all its members are admitted into this selected specialization.
      const expected = declared.filter((chain) => chain.every((id) => runtimeCatalog.skillsById.has(id)));
      const keys = (chains) => chains.map((chain) => chain.join(',')).sort();
      assert.deepEqual(keys(runtimeCatalog.autoattackChains), keys(expected), module.id);
      for (const chain of expected) {
        for (const [index, id] of chain.entries()) {
          const skill = runtimeCatalog.skillsById.get(id);
          assert.equal(skill.chainRoot, chain[0]);
          assert.equal(skill.chainStep, index + 1);
          assert.equal(skill.nextChainId, chain[index + 1] ?? null);
          assert.equal(typeof skill.autoattack, 'boolean');
          assert.equal(activationInputKind(skill), skill.autoattack ? 'autoattack' : 'manual');
          assert.ok(!chain.includes(skill.flipParentId));
          assert.ok(!chain.includes(skill.flipSkillId));
        }
      }
    }
  });
}
