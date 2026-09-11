import assert from 'node:assert/strict';
import test from 'node:test';
import { canEquipWeaponSigil, normalizeWeaponSigils, setWeaponSigil } from '#gw2/platform/equipment/sigils/loadout.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';
import { mesmerAppAdapter as adapter } from '#gw2/professions/mesmer/app/app-definition.js';
import {
  captureGearOptimizerRequest,
  createOptimizerEvaluator,
  createOptimizerSpace,
  optimizerEquipment
} from '#gw2/app/simulation/gear-optimizer/gear-optimizer.js';

// Check the shared selection rule at every socket so alternate sets cannot bypass exclusivity.
test('Slaying is limited per set and stacking sigils are limited across both sets', () => {
  const stacking = Object.keys(SIGIL_DATA).filter((name) => SIGIL_DATA[name].stackingStats);
  for (const equipped of ['Slaying', ...stacking]) {
    for (const set of [0, 1]) {
      for (const slot of [0, 1]) {
        const build = {
          weaponSigils: [
            ['Force', 'Accuracy'],
            ['Force', 'Accuracy']
          ]
        };
        setWeaponSigil(build, set, slot, equipped);
        const original = structuredClone(build.weaponSigils);
        for (const candidate of equipped === 'Slaying' ? ['Slaying'] : stacking) {
          for (const otherSet of [0, 1]) {
            for (const otherSlot of [0, 1]) {
              assert.equal(
                canEquipWeaponSigil(original, otherSet, otherSlot, candidate),
                (set === otherSet && slot === otherSlot) || (equipped === 'Slaying' && set !== otherSet)
              );
            }
          }

          setWeaponSigil(build, 1 - set, slot, candidate);
          if (equipped === 'Slaying') assert.equal(build.weaponSigils[1 - set][slot], 'Slaying');
          else assert.deepEqual(build.weaponSigils, original);
        }

        setWeaponSigil(build, set, slot, 'Malice');
        assert.equal(canEquipWeaponSigil(build.weaponSigils, set, slot, equipped), true);
      }
    }
  }

  assert.deepEqual(
    normalizeWeaponSigils([
      ['Slaying', 'Bloodlust'],
      ['Slaying', 'Accuracy']
    ]),
    [
      ['Slaying', 'Bloodlust'],
      ['Slaying', 'Accuracy']
    ]
  );
  assert.deepEqual(
    normalizeWeaponSigils([
      ['Force', 'Accuracy'],
      ['Force', 'Accuracy']
    ]),
    [
      ['Force', 'Accuracy'],
      ['Force', 'Accuracy']
    ]
  );
});

test('loading repairs conflicts while strict build validation rejects them', () => {
  for (const weaponSigils of [
    [
      ['Bloodlust', 'Corruption'],
      ['Cruelty', 'Stars']
    ],
    [
      ['Bloodlust', 'Force'],
      ['Bloodlust', 'Accuracy']
    ]
  ]) {
    const build = { ...adapter.profession.createBuildDefaults(), weaponSigils };
    const validation = adapter.profession.validateBuild(build);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.includes('only one stacking sigil')));
    const loaded = adapter.toApplicationBuild(build);
    assert.equal(loaded.weaponSigils[0][0], weaponSigils[0][0]);
    const customFallback = normalizeWeaponSigils(weaponSigils, weaponSigils);
    assert.equal(customFallback[0][0], weaponSigils[0][0]);
    for (const sigils of [loaded.weaponSigils, customFallback]) {
      assert.equal(sigils.flat().filter((name) => SIGIL_DATA[name]?.stackingStats).length, 1);
      assert.deepEqual(normalizeWeaponSigils(sigils), sigils);
    }

    assert.equal(adapter.profession.validateBuild(loaded).valid, true);
  }
});

test('optimizer rejects incompatible pairs and cross-set candidates before preparing combat', () => {
  const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    contentId: adapter.id,
    buildRevision: 0,
    patchId: 'current'
  };
  assert.throws(() => captureGearOptimizerRequest(app, { sigils: [[['Bloodlust'], ['Corruption']]] }), /legal pair/);
  const request = captureGearOptimizerRequest(app, {});
  assert.doesNotThrow(() => createOptimizerSpace(request, adapter));
  const evaluator = createOptimizerEvaluator(request, adapter);
  for (const pair of [
    ['Bloodlust', 'Corruption'],
    ['Stars', 'Stars']
  ]) {
    const equipment = optimizerEquipment(build);
    equipment.weaponSigils = [
      [pair[0], 'Force'],
      [pair[1], 'Accuracy']
    ];
    assert.equal(evaluator.score(equipment), null);
    assert.throws(() => evaluator.prepare(equipment), /multiple stacking sigils/);
  }

  const equipment = optimizerEquipment(build);
  equipment.weaponSigils = [
    ['Slaying', 'Force'],
    ['Slaying', 'Accuracy']
  ];
  assert.doesNotThrow(() => evaluator.prepare(equipment));
  assert.equal(adapter.profession.validateBuild({ ...build, ...equipment }).valid, true);
  equipment.weaponSigils[0] = ['Slaying', 'Slaying'];
  assert.equal(evaluator.score(equipment), null);
});
