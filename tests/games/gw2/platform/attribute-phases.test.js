import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyWarriorBuildAttributeRules } from '#gw2/professions/warrior/build/attributes.js';
import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAttributeContributions,
  applyFinalConditionAttributes,
  applyMightAttributes,
  attributeContext,
  resolveAttributeContributions
} from '#gw2/platform/builds/attribute-evaluation.js';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { bloodReactionSource } from '#gw2/professions/warrior/specializations/berserker/attribute-sources.js';

const families = {};
for (const name of ['engineer', 'mesmer', 'revenant', 'warrior'])
  families[name] = (await import(`#gw2/professions/${name}/profession.js`))[`${name}Profession`];

// Minimal builds exercise shared phases without saved-rotation or packet-schedule assertions.
function scenario(name, specialization, names = [], options = {}, family = families[name]) {
  const config = {
    specialization,
    selectedTraitIds: names.map((name) => family.catalog.traits.find((trait) => trait.name === name).id),
    selectedSkillIds: [],
    attributeInputs: baseAttributeInputs(),
    ...options
  };
  const profession = family.runtimeFor(config);
  const query = createGw2CombatQuery({ config, profession });
  const facts = attributeContext(
    { config, profession, time: 0 },
    { catalog: profession.catalog, modifierRulesById: new Map() }
  );
  return { family, config, profession, query, facts };
}

test('Might applies baseline and Notoriety together while unbuffed declarations exclude both', () => {
  const probe = scenario('revenant', 'Core', ['Notoriety'], { boons: { might: 25 } });
  const contributions = probe.family.attributeContributions(probe.facts);
  assert.deepEqual(resolveAttributeContributions({}, contributions).attributes, {});
  const seed = probe.config.attributeInputs.weaponSets[0].commonTotals;
  const build = applyAttributeContributions(probe.facts, seed, probe.family.attributeContributions);
  assert.equal(build.conditionDamage, 0);
  const live = probe.query.statsAt(0);
  assert.equal(live.power, 2000);
  assert.equal(live.conditionDamage, 500);
  const preview = createGw2CombatQuery({
    config: probe.config,
    profession: probe.profession,
    attributePreviewPlayerHealthFraction: 0.25
  }).statsAt(0);
  assert.deepEqual(preview, live);
  const buffed = applyMightAttributes(build, 25, contributions);
  assert.equal(buffed.power, live.power);
  assert.equal(buffed.conditionDamage, live.conditionDamage);
  assert.equal(seed.power, 1000);
  assert.equal(seed.conditionDamage, 0);
  const pet = {
    type: 'damage',
    actorType: 'summon',
    independentSummonStrike: true,
    summonOwner: 'pet',
    summonBasePower: 1200,
    summonBaseConditionDamage: 100
  };
  const runtime = {
    boons: new Map([
      [
        'might',
        [
          {
            at: 0,
            expiresAt: 2,
            stacks: 3,
            resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['pet'] }
          }
        ]
      ]
    ])
  };
  assert.equal(probe.query.statsAt(1, pet, runtime).power, 1290);
  assert.equal(probe.query.statsAt(1, pet, runtime).conditionDamage, 190);
  assert.equal(probe.query.statsAt(2, pet, runtime).power, 1200);
});

for (const [name, trait, kind, stat, perStack, maximum] of [
  ['mesmer', "Fencer's Finesse", 'fencer', 'ferocity', 15, 10],
  ['warrior', 'Furious', 'furious-surge', 'conditionDamage', 15, 25]
]) {
  test(`${trait} grants survive deselection and observe recipient, same-time updates, cap and expiry`, () => {
    const selected = scenario(name, 'Core', [trait]);
    const unselected = scenario(name, 'Core');
    const grants = [];
    const runtime = { buffs: new Map([[kind, grants]]) };
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 0);
    grants.push({ at: 1, expiresAt: 5, stacks: 2, resolvedAudience: { includesSelf: true } });
    grants.push({
      at: 1,
      expiresAt: 5,
      stacks: 8,
      resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['other'] }
    });
    assert.equal(selected.query.statsAt(1, null, runtime)[stat], 2 * perStack);
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 2 * perStack);
    grants.push({ at: 1, expiresAt: 5, stacks: 1, resolvedAudience: { includesSelf: true } });
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 3 * perStack);
    grants.push({ at: 1, expiresAt: 5, stacks: 100, resolvedAudience: { includesSelf: true } });
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], maximum * perStack);
    const before = structuredClone(runtime);
    assert.equal(unselected.query.statsAt(5, null, runtime)[stat], 0);
    assert.deepEqual(runtime, before);
  });
}

test('accepted Insight remains until its exclusive expiry with no selected trait', () => {
  const probe = scenario('warrior', 'Spellbreaker');
  const expiries = [2, 3];
  const runtime = {
    profession: { specialization: { kind: 'Spellbreaker', state: { attackerInsightExpiries: expiries } } }
  };
  assert.equal(probe.query.statsAt(1, null, runtime).power, 1100);
  expiries.push(4);
  assert.equal(probe.query.statsAt(1, null, runtime).power, 1150);
  assert.equal(probe.query.statsAt(2, null, runtime).power, 1100);
  assert.equal(probe.query.statsAt(4, null, runtime).power, 1000);
  assert.deepEqual(expiries, [2, 3, 4]);
});

test('ordinary conversions, accumulated scaling, actor projection and final replacement have distinct inputs', () => {
  const probe = scenario('engineer', 'Core');
  const facts = { ...probe.facts, event: { type: 'condition', condition: 'Bleeding', actorType: 'player' } };
  const declarations = () => [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Power', amount: 100, feedsConversions: false },
        { kind: 'conversion', from: 'Power', to: 'Ferocity', multiplier: 0.1, input: 'common', rounding: 'none' }
      ],
      // Projection must follow scaling even when listed first.
      transforms: [
        { kind: 'project', replace: false, attributes: { power: 1800 } },
        { kind: 'scale', factor: 1.2 }
      ],
      finalCondition: { condition: 'Bleeding', powerMultiplier: 0.5 },
      traitDurations: { 'Boon Duration': 10 },
      uncappedBoonDuration: 20
    }
  ];
  const initial = { power: 1000, ferocity: 0 };
  const ordinary = applyAttributeContributions(facts, applyMightAttributes(initial, 10, []), declarations);
  assert.equal(ordinary.power, 1800);
  assert.equal(ordinary.ferocity, 120);
  assert.equal(ordinary.boonDurationBonus, 10);
  assert.equal(ordinary.uncappedBoonDurationBonus, 20);
  const final = applyFinalConditionAttributes(facts, { ...ordinary, conditionDamage: 300 }, declarations);
  assert.equal(final.conditionDamage, 900);
  assert.equal(
    applyFinalConditionAttributes(
      { ...facts, event: { ...facts.event, actorType: 'summon' } },
      { ...ordinary, conditionDamage: 300 },
      declarations
    ).conditionDamage,
    300
  );
  assert.deepEqual(initial, { power: 1000, ferocity: 0 });
});

test('Blood Reaction names its owner source and excludes Might and Berserk grants', () => {
  const probe = scenario('warrior', 'Berserker', ['Blood Reaction', 'Pinnacle of Strength', 'Great Fortitude'], {
    boons: { might: 25 }
  });
  const runtime = { profession: { specialization: { kind: 'Berserker', state: { berserkActive: true } } } };
  const source = bloodReactionSource({ ...probe.facts, runtime });
  assert.equal(source.power, 1000);
  assert.equal(source.precision, 1000);
  // Named sub-sources must ignore a caller's sampled main-pipeline declarations.
  assert.equal(
    bloodReactionSource({
      ...probe.facts,
      runtime,
      attributeContributions: [
        { attributeEffects: [{ kind: 'flat', to: 'Power', amount: 999, feedsConversions: false }] }
      ]
    }).power,
    1000
  );
  const active = probe.query.statsAt(0, null, runtime);
  assert.equal(active.power, 2300);
  assert.equal(active.conditionDamage, 1140);
  assert.equal(active.ferocity, 370);
  assert.equal(active.vitality, 1130);
  runtime.profession.specialization.state.berserkActive = false;
  assert.equal(probe.query.statsAt(0, null, runtime).ferocity, 220);
});

test('Chemical Rounds declares base-duration eligibility and respects patch tuning without a recharge grant', () => {
  const probe = scenario('engineer', 'Core', ['Chemical Rounds']);
  const id = probe.config.selectedTraitIds[0];
  const multiplier = (event, profession = probe.profession, config = probe.config) =>
    profession.modifyConditionBaseDuration({ profession, config, time: 0, event }, 1);
  for (const event of [{ skillWeapon: 'Pistol' }, { application: { skillWeapon: 'Pistol' } }])
    assert.equal(multiplier(event), 4 / 3);
  assert.equal(multiplier({ skillWeapon: 'Rifle' }), 1);
  assert.equal(multiplier({ skillWeapon: 'Pistol', application: { source: 'Trait' } }), 1);
  assert.equal(multiplier({ skillWeapon: 'Pistol' }, probe.profession, { ...probe.config, selectedTraitIds: [] }), 1);
  const patched = withPatchPreview(probe.family, {
    id: 'chemical-rounds-duration',
    label: 'Chemical Rounds duration',
    professions: { engineer: { balanceProfiles: { [id]: { fields: { conditionDurationMultiplier: 1.5 } } } } }
  });
  const patchedConfig = { ...probe.config, patchId: 'chemical-rounds-duration' };
  assert.equal(multiplier({ skillWeapon: 'Pistol' }, patched.runtimeFor(patchedConfig), patchedConfig), 1.5);
  assert.equal(
    probe.profession.rechargeRules.some((rule) => rule.trait === id),
    false
  );
});

// The panel and live query must supply the same equipment source to specialized conversions.
test('Blood Reaction build and live sources agree for both equipment sets', () => {
  const family = families.warrior;
  const calculate = createCalculateAttributes(applyWarriorBuildAttributeRules, family.attributeContributions);
  const build = createWarriorBuildDefaults();
  build.specializations = [{ name: 'Berserker', traits: '1-1-1' }];
  build.alternateWeaponPrefixes = ["Assassin's", "Assassin's"];
  const panels = [1, 2].map((set) => calculate(build, [], set));
  const attributeInputs = { weaponSets: panels.map((panel) => panel.attributeSeed) };
  assert.notEqual(
    attributeInputs.weaponSets[0].commonTotals.precision,
    attributeInputs.weaponSets[1].commonTotals.precision
  );
  for (const weaponSet of [1, 2]) {
    const panel = panels[weaponSet - 1];
    const seed = panel.attributeSeed.commonTotals;
    assert.equal(panel.attributes.Ferocity.traits, seed.precision * 0.12);
    assert.equal(panel.attributes['Condition Damage'].traits, seed.power * 0.12);
    const probe = scenario('warrior', 'Berserker', ['Blood Reaction'], {
      attributeInputs,
      startingWeaponSet: weaponSet
    });
    const live = probe.query.statsAt(0);
    assert.equal(live.ferocity, panel.attributes.Ferocity.final);
    assert.equal(live.conditionDamage, panel.attributes['Condition Damage'].final);
    assert.equal(calculate(build, [], weaponSet, 'Blood Reaction').attributes.Ferocity.traits, 0);
  }
});
