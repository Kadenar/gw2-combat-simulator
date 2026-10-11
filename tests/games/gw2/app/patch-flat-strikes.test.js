import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import {
  skillAuthoringReference,
  balanceProfileAuthoringReference,
  skillPatchableNumericFields,
  balanceProfilePatchableNumericFields
} from '#gw2/integrations/patches/authoring/fields.js';
import {
  applySkillPatch,
  applyBalanceProfilePatch,
  normalizeAuthoringSkillEdit
} from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { grantNecromancerSoulShards } from '#gw2/professions/necromancer/core/mechanics/soul-shards.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

// The authoring reference and executable patch grammar must agree for aggregate and inherited tick formulas.
for (const section of ['skills', 'balanceProfiles']) {
  const referenceFor = section === 'skills' ? skillAuthoringReference : balanceProfileAuthoringReference;
  const apply = section === 'skills' ? applySkillPatch : applyBalanceProfilePatch;
  for (const formula of ['flatDamage', 'flatStrikeBase', 'flatStrikePowerCoeff']) {
    for (const shape of ['aggregate', 'tick', 'inherited']) {
      test(`${section} ${shape} ${formula} exposes the flat formula and rejects ordinary coefficients`, () => {
        const flat = { [formula]: 0 };
        const source = {
          id: 1,
          name: 'Flat strike',
          ...(section === 'balanceProfiles' ? { profileKind: 'mechanic' } : {}),
          effects: [
            {
              type: 'strike',
              name: 'Flat',
              ...(shape === 'aggregate'
                ? { ...flat, coefficient: 0 }
                : {
                    ...(shape === 'inherited' ? flat : {}),
                    ticks: [{ atMs: 0, coefficient: 0, ...(shape === 'tick' ? flat : {}) }]
                  })
            },
            { type: 'strike', name: 'Normal', coefficient: 1 }
          ]
        };
        const catalog = createCanonicalCatalog({ [section === 'skills' ? 'generated' : section]: [source] });
        const reference = referenceFor(catalog[section][0]);
        const flatEffect = reference.effects[0];
        const target = shape === 'aggregate' ? flatEffect : flatEffect.ticks[0];
        assert.equal(target.coefficient, undefined);
        assert.equal((shape === 'tick' ? target : flatEffect)[formula], 0);
        assert.equal(reference.effects[1].coefficient, 1);
        const selector = { effectIndex: 0, ...(shape === 'aggregate' ? {} : { tickIndex: 0 }) };
        const invalid = { effects: [{ ...selector, coefficient: 5 }] };
        assert.throws(() => apply(catalog, { [section]: { 1: invalid } }), /cannot tune a flat strike/);
        assert.throws(() => normalizeAuthoringSkillEdit(reference, invalid), /cannot tune a flat strike/);
        assert.throws(() => apply(catalog, { [section]: { 1: { coefficient: 5 } } }), /cannot tune a flat strike/);
        const edit = { effects: [{ effectIndex: 0, ...(shape === 'tick' ? { tickIndex: 0 } : {}), [formula]: 3 }] };
        const normalized = normalizeAuthoringSkillEdit(reference, edit);
        const patched = apply(catalog, { [section]: { 1: normalized } })[section][0];
        assert.equal((shape === 'tick' ? patched.effects[0].ticks[0] : patched.effects[0])[formula], 3);
        assert.equal((shape === 'tick' ? source.effects[0].ticks[0] : source.effects[0])[formula], 0);
        const normal = apply(catalog, { [section]: { 1: { effects: [{ effectIndex: 1, coefficient: 3 }] } } });
        assert.equal(normal[section][0].effects[1].coefficient, 3);
      });
    }
  }

  // Removed allowlist names must fail as unsupported even if a candidate declares matching numeric properties.
  test(`${section} rejects the obsolete activeDamageIncrease and ferocityBonus fields`, () => {
    const source = {
      id: 1,
      name: 'Unused fields',
      activeDamageIncrease: 1,
      ferocityBonus: 20,
      ...(section === 'balanceProfiles' ? { profileKind: 'mechanic' } : {}),
      effects: []
    };
    const fields = (section === 'skills' ? skillPatchableNumericFields : balanceProfilePatchableNumericFields)(source);
    const catalog = createCanonicalCatalog({
      [section === 'skills' ? 'generated' : section]: [
        {
          id: source.id,
          name: source.name,
          effects: [],
          ...(section === 'balanceProfiles' ? { profileKind: 'mechanic' } : {})
        }
      ]
    });
    for (const field of ['activeDamageIncrease', 'ferocityBonus']) {
      assert.equal(fields[field], undefined);
      assert.throws(() => apply(catalog, { [section]: { 1: { fields: { [field]: 2 } } } }), /unsupported patch field/);
    }
  });
}

// The actual Soul Shards emitter consumes both supported formula inputs; weapon scaling remains structural zero.
test('Soul Shards flat formula edits change resolved damage and reject the ignored coefficient', () => {
  const profileId = 'necromancer.core.soul-shards';
  const family = withPatchPreview(necromancerProfession, {
    id: 'flat-formula',
    label: 'Flat formula',
    professions: {
      necromancer: {
        balanceProfiles: {
          [profileId]: {
            effects: [{ name: 'Soul Shards', flatStrikeBase: 100, flatStrikePowerCoeff: 0.2 }]
          }
        }
      }
    }
  });
  assert.throws(
    () =>
      family.validatePatch({
        balanceProfiles: {
          [profileId]: { effects: [{ name: 'Soul Shards', coefficient: 100 }] }
        }
      }),
    /cannot tune a flat strike/
  );
  const run = createProfessionSimulator(family);
  for (const [patchId, expected] of [
    ['current', 1704],
    ['flat-formula', 500],
    ['current', 1704]
  ]) {
    const result = run(
      ['Perforate'],
      {
        patchId,
        specialization: 'Core',
        primaryWeapon: 'Spear',
        attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
        target: { armor: 2597, health: 1_000_000 }
      },
      { initialize: (owner) => grantNecromancerSoulShards(owner.mechanics, 1) }
    );
    assert.deepEqual(result.warnings, []);
    const shard = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.SOUL_SHARDS);
    assert.ok(shard);
    assert.equal(shard.coefficient, 0);
    assert.equal(shard.damage, expected);
  }
});
