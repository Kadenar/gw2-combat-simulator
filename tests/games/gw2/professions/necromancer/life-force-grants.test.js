import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { effectResourceGrants } from '#gw2/platform/effects/resource-grants.js';
import { validateCanonicalCatalog } from '#gw2/platform/skills/validation.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { cloneCatalogData } from '#gw2/integrations/patches/authoring/immutable.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const base = {
  specialization: 'Core',
  initialResource: 0,
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId, extra = {}) => ({ type: 'cast', skillId, ...extra });

function simulate(skillId, edit, config = base, extra = {}) {
  const native = necromancerProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: { ...native, catalog: applySkillPatch(native.catalog, { skills: { [skillId]: edit } }) },
    config,
    rotation: [cast(skillId, extra)]
  });
  assert.deepEqual(result.warnings, []);
  return result.planningState.profession.lifeForce.value;
}

// Two rewards on one strike retain their own tuning and the bonus's original eligibility gate.
test('Addle resource edits preserve independent base and conditional grants', () => {
  const edit = {
    effects: [
      {
        type: 'strike',
        resourceGrants: {
          'life-force': { percent: { from: 10, to: 3 } },
          'defiant-life-force': { percent: { from: 10, to: 7 } }
        }
      }
    ]
  };
  for (const [defiant, expected] of [
    [false, 3],
    [true, 10]
  ]) {
    const config = { ...base, target: { ...base.target, defiant } };
    assert.equal(simulate(ID.ADDLE, edit, config), expected);
    assert.equal(simulate(ID.ADDLE, edit, config, { offTarget: true }), 0);
  }

  assert.ok(
    Math.abs(
      simulate(ID.ADDLE, edit, {
        ...base,
        selectedTraitIds: [TRAIT.GLUTTONY, TRAIT.SOUL_BATTERY],
        target: { ...base.target, defiant: true }
      }) - 11
    ) < 1e-10
  );
});

// Patch consumers must reach the declared formula; Devouring's own Torment never increases its counted input.
test('conditional resource edits affect accepted strikes and retain live versus snapshot counts', () => {
  const edit = {
    effects: [{ type: 'strike', resourceGrants: { 'life-force': { percent: 4, 'perCondition.percent': 2 } } }]
  };
  for (const skillId of [ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]) {
    const config = {
      ...base,
      selectedTraitIds: skillId === ID.DEVOURING_DARKNESS ? [TRAIT.LINGERING_CURSE] : [],
      target: { ...base.target, conditions: { Bleeding: 1, Poisoned: 1 } }
    };
    assert.equal(simulate(skillId, edit, config), 8);
    assert.equal(simulate(skillId, edit, config, { offTarget: true }), 0);
  }

  const queries = {
    profession: { core: { lifeForce: { maximum: 100 } } },
    traits: new Set(),
    time: 1,
    combat: { targetConditionCount: () => 6 }
  };
  for (const [count, expected] of [
    [{ kind: 'live-target', maximum: 5 }, 13],
    [{ kind: 'packet-snapshot' }, 10]
  ]) {
    const action = lifeForceGrant({
      id: 'gain',
      unit: 'hit',
      grant: { percent: 8, perCondition: { percent: 1, count } }
    });
    const context = { kind: 'effect', trigger: { event: { metadata: { necromancerConditionCount: 2 } } } };
    assert.equal(action.amount.resolve(queries, context, action.amount.parameters), expected);
  }
});

// Innervate's reward belongs to the committed command even when its hostile output misses.
test('patched Innervate grants once on commit independently of hostile output', () => {
  const config = { ...base, specialization: 'Ritualist', initialResource: 50 };
  const native = necromancerProfession.runtimeFor(config);
  const run = (percent, offTarget) => {
    const catalog = applySkillPatch(native.catalog, {
      skills: {
        [ID.INNERVATE_ANGUISH]: { resourceGrants: { innervate: { percent } } }
      }
    });
    const result = observeGw2Runtime({
      profession: { ...native, catalog },
      config,
      rotation: [cast(ID.RITUALISTS_SHROUD), cast(ID.ANGUISH), cast(ID.INNERVATE_ANGUISH, { offTarget })]
    });
    assert.deepEqual(result.warnings, []);
    return result.planningState.profession.lifeForce.value;
  };

  assert.ok(Math.abs(run(17, true) - run(10, true) - 7) < 1e-10);
  assert.equal(run(17, true), run(17, false));
});

// Catalog validation and numeric patches reject broken declarations before a grant can become a silent no-op.
test('life-force declarations reject malformed tuning, duplicate ids, and wrong triggers', () => {
  const catalog = necromancerProfession.catalog;
  for (const fields of [
    { percent: -1 },
    { percent: Infinity },
    { 'perCondition.count.maximum': 1.5 },
    { 'perCondition.count.kind': 1 }
  ])
    assert.throws(
      () =>
        applySkillPatch(catalog, {
          skills: {
            [ID.FEAST_OF_CORRUPTION]: {
              effects: [{ type: 'strike', resourceGrants: { 'life-force': fields } }]
            }
          }
        }),
      /finite|integer|does not expose/
    );
  assert.throws(
    () =>
      applySkillPatch(catalog, {
        skills: {
          [ID.FEAST_OF_CORRUPTION]: {
            effects: [{ type: 'strike', resourceGrants: { missing: { percent: 1 } } }]
          }
        }
      }),
    /no resource grant/
  );
  for (const mutate of [
    (effect) => effect.reactions.push(effect.reactions[0]),
    (effect) => {
      effectResourceGrants(effect)[0].amount.parameters.unit = 'cast';
    },
    (effect) => {
      delete effectResourceGrants(effect)[0].amount.resolve;
    }
  ]) {
    const skill = cloneCatalogData(catalog.skillsById.get(ID.FEAST_OF_CORRUPTION));
    mutate(skill.effects[0]);
    assert.throws(() => validateCanonicalCatalog({ ...catalog, skills: [skill] }), /duplicate|trigger|resolver/);
  }

  assert.throws(
    () => applySkillPatch(catalog, { skills: { [ID.FEAST_OF_CORRUPTION]: { fields: { lifeForceGain: 2 } } } }),
    /unsupported patch field/
  );
});
