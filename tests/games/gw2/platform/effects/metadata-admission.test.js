/** Family annotation schemas survive catalog selection and patch reconstruction. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { combineMetadataFields, normalizeEffectMetadata } from '#gw2/platform/events/metadata.js';
import {
  assembleNativeRuntimeCatalog,
  createNativeModuleData,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';

const metadataFields = combineMetadataFields([{ owner: 'Fixture', fields: { captured: 'number' } }]);
const strike = { type: 'strike', coefficient: 1, metadata: { captured: 2 } };

test('patch overlays retain the family schema for retained and newly added effects', () => {
  const catalog = createCanonicalCatalog({
    metadataFields,
    skills: [{ id: 1, name: 'Fixture', effects: [strike] }],
    balanceProfiles: [{ id: 2, name: 'Profile', effects: [strike] }]
  });
  assert.equal(catalog.metadataFields.captured, metadataFields.captured);
  assert.ok(Object.isFrozen(catalog.metadataFields));
  for (const [apply, group, id] of [
    [applySkillPatch, 'skills', 1],
    [applyBalanceProfilePatch, 'balanceProfiles', 2]
  ]) {
    const patched = apply(catalog, { [group]: { [id]: { addEffects: [{ ...strike, metadata: { captured: 3 } }] } } });
    assert.deepEqual(
      patched[group][0].effects.map((effect) => effect.metadata.captured),
      [2, 3]
    );
    assert.throws(
      () => apply(catalog, { [group]: { [id]: { addEffects: [{ ...strike, metadata: { unknown: true } }] } } }),
      /metadata/
    );
  }
});

test('inline payload patches use the same schema after cloning their action declarations', () => {
  const catalog = createCanonicalCatalog({
    metadataFields,
    skills: [
      {
        id: 1,
        name: 'Fixture',
        sideEffects: [{ on: 'castStart', do: { type: 'fixture.grant', id: 'reward', effects: [strike] } }]
      }
    ]
  });
  const patch = (metadata) =>
    applySkillPatch(catalog, {
      skills: { 1: { sideEffects: { reward: { addEffects: [{ ...strike, metadata }] } } } }
    });
  assert.deepEqual(
    patch({ captured: 3 }).skills[0].sideEffects[0].do.effects.map((effect) => effect.metadata.captured),
    [2, 3]
  );
  assert.throws(() => patch({ foreign: 3 }), /metadata/);
});

test('runtime selection preserves all family declarations while excluding foreign families', () => {
  const module = (id, fields, skills = []) => ({
    id,
    data: createNativeModuleData({ id, metadataFields: fields, skills })
  });
  const core = module('Core', { captured: 'number' }, [
    { id: 1, name: 'Shared weapon', icon: 'fixture.png', effects: [strike] }
  ]);
  const elite = module('Elite', { eliteFlag: 'boolean' });
  const assembly = getNativeCatalogAssembly([core, elite]);
  const selected = assembleNativeRuntimeCatalog([assembly.fragments.get('Core')]);
  assert.equal(selected.metadataFields, assembly.catalog.metadataFields);
  assert.deepEqual(normalizeEffectMetadata({ captured: 2, eliteFlag: false }, selected.metadataFields), {
    captured: 2,
    eliteFlag: false
  });
  assert.throws(() => normalizeEffectMetadata({ foreign: true }, selected.metadataFields), /unsupported field/);
  assert.throws(() => getNativeCatalogAssembly([core, module('Other', { captured: 'number' })]), /Duplicate.*captured/);
});

test('profile action attribution obeys each catalog schema for cast and reaction declarations', () => {
  for (const trigger of ['cast', 'reaction']) {
    const sourceMetadata = { captured: 2 };
    const action = { type: 'emitProfile', profileId: 2, attribution: { metadata: sourceMetadata } };
    const skill = {
      id: 1,
      name: 'Fixture',
      ...(trigger === 'cast'
        ? { sideEffects: [{ on: 'castStart', do: action }] }
        : {
            effects: [
              {
                type: 'strike',
                coefficient: 1,
                reactions: [{ on: 'damage.resolved', actor: 'player', packets: 'each', do: [action] }]
              }
            ]
          })
    };
    const input = { skills: [skill], balanceProfiles: [{ id: 2, name: 'Reward', effects: [] }] };
    assert.throws(() => createCanonicalCatalog(input), /unsupported field.*captured/);
    const catalog = createCanonicalCatalog({ ...input, metadataFields });
    const acceptedAction =
      trigger === 'cast' ? catalog.skills[0].sideEffects[0].do : catalog.skills[0].effects[0].reactions[0].do[0];
    sourceMetadata.captured = 9;
    assert.equal(acceptedAction.attribution.metadata.captured, 2);
    assert.notEqual(acceptedAction.attribution.metadata, sourceMetadata);
    assert.ok(Object.isFrozen(acceptedAction.attribution.metadata));
    assert.throws(() => createCanonicalCatalog({ ...input, skills: catalog.skills }), /unsupported field.*captured/);
    sourceMetadata.captured = 'invalid';
    assert.throws(() => createCanonicalCatalog({ ...input, metadataFields }), /captured must be a finite number/);
  }
});

// Real family catalogs admit specialized packet annotations without exposing them to foreign families.
test('specialization annotations retain finite kinds and family ownership', () => {
  const engineer = {
    holosmithStrikeFactor: 0,
    holosmithConditionBaseDurationFactor: 0,
    holosmithStrikeSkillId: 0,
    mechBasicAttack: false
  };
  assert.deepEqual(normalizeEffectMetadata(engineer, engineerCatalog.metadataFields), engineer);
  for (const metadata of [
    { holosmithStrikeFactor: NaN },
    { holosmithConditionBaseDurationFactor: Infinity },
    { holosmithStrikeSkillId: {} },
    { mechBasicAttack: 1 }
  ]) {
    assert.throws(() => normalizeEffectMetadata(metadata, engineerCatalog.metadataFields), /metadata/);
  }

  const guardian = { radiantWeapon: 'fixture', guardianRadiantCourage: false, guardianAutomaticForgeExit: false };
  assert.deepEqual(normalizeEffectMetadata(guardian, guardianCatalog.metadataFields), guardian);
  assert.throws(() => normalizeEffectMetadata(guardian, engineerCatalog.metadataFields), /unsupported field/);
  assert.throws(() => normalizeEffectMetadata(engineer, guardianCatalog.metadataFields), /unsupported field/);
});

// Captured factors and false flags survive family admission; foreign families cannot emit them.
test('remaining captured annotations use their native family schema', () => {
  for (const [catalog, metadata] of [
    [
      mesmerCatalog,
      {
        chronophantasmaDamageFactor: 0,
        chronophantasmaConditionDurationFactor: 0,
        bountifulBladesDamageFactor: 0,
        crescendoInstrumentCount: 0,
        crescendoEffectiveness: 0
      }
    ],
    [revenantCatalog, { reaversCurseDamageFactor: 0, forerunnerOfDeathActive: false }],
    [guardianCatalog, { willbenderFlames: false }]
  ]) {
    const admitted = normalizeEffectMetadata(metadata, catalog.metadataFields);
    assert.deepEqual(admitted, metadata);
    assert.notEqual(admitted, metadata);
    assert.ok(Object.isFrozen(admitted));
    assert.throws(() => normalizeEffectMetadata(metadata, engineerCatalog.metadataFields), /unsupported field/);
    for (const key of Object.keys(metadata)) {
      assert.throws(() => normalizeEffectMetadata({ [key]: 'invalid' }, catalog.metadataFields), /metadata/);
    }
  }
});
