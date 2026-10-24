import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeContext, resolveAttributeContributions } from '#gw2/platform/attributes/evaluation.js';
import { attributeSeed, baseAttributeInputs, equipmentAttributeConversions } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

const families = {};
for (const name of ['elementalist', 'engineer', 'guardian', 'necromancer', 'ranger', 'revenant', 'thief', 'warrior']) {
  families[name] = (await import(`#gw2/professions/${name}/profession.js`))[`${name}Profession`];
}

// Audited against https://github.com/discretize/discretize-gear-optimizer/tree/main/src/assets/modifierdata:
// `buff` grants stay out of conversions; Reinforced Potency is explicitly `converted` despite also being always on.
for (const [profession, specialization, trait, attribute, grant, utilityBonus] of [
  ['elementalist', 'Core', 'Soothing Power', 'vitality', 300, 0],
  ['engineer', 'Amalgam', 'Hybrid Vigor', 'vitality', 240, 0],
  ['ranger', 'Untamed', 'Natural Fortitude', 'vitality', 240, 0],
  ['necromancer', 'Core', 'Lingering Curse', 'conditionDamage', 200, 0],
  ['elementalist', 'Core', 'Burning Rage', 'conditionDamage', 180, 0],
  ['revenant', 'Core', 'Seething Malice', 'conditionDamage', 120, 0],
  ['elementalist', 'Core', 'Elemental Enchantment', 'concentration', 180, 0],
  ['elementalist', 'Tempest', 'Gathered Focus', 'concentration', 240, 0],
  ['engineer', 'Core', 'Compounding Chemicals', 'concentration', 240, 0],
  ['guardian', 'Core', 'Honorable Staff', 'concentration', 120, 0],
  ['necromancer', 'Ritualist', 'Boon of Creation', 'concentration', 180, 0],
  ['ranger', 'Core', 'Lingering Magic', 'concentration', 240, 0],
  ['revenant', 'Herald', 'Reinforced Potency', 'concentration', 240, 7]
]) {
  test(`${trait}: permanent grants preserve audited utility and reinforcement eligibility`, () => {
    // Leviathan exercises each grant's source stat directly, exposing accidental conversion of always-on buffs.
    const attributeInputs = baseAttributeInputs({ conditionDamage: 1000, concentration: 1000 });
    for (const seed of attributeInputs.weaponSets)
      seed.conversions = equipmentAttributeConversions('Leviathan Tempering Oil');
    const baseline = scenario(profession, specialization, [], { attributeInputs }).query.statsAt(0);
    const current = scenario(profession, specialization, [trait], { attributeInputs }).query.statsAt(0);
    assert.equal(current[attribute] - baseline[attribute], grant + utilityBonus);
    assert.equal(current.vitality - baseline.vitality, attribute === 'vitality' ? grant : 0);
  });
}

// Exercise the public contribution and combat boundaries with the same minimal selected build.
function scenario(name, specialization, traits, options = {}, family = families[name]) {
  const config = {
    specialization,
    selectedTraitIds: traits.map((name) => family.catalog.traits.find((trait) => trait.name === name).id),
    selectedSkillIds: [],
    attributeInputs: baseAttributeInputs(),
    ...options
  };
  const profession = family.runtimeFor(config);
  const query = createGw2CombatQuery({ profession, config });
  return {
    config,
    profession,
    query,
    declared(time = 0, runtime = null, event = null, liveQuery = false) {
      const context = attributeContext(
        { config, profession, time, runtime, event, query: liveQuery ? query : undefined },
        { catalog: profession.catalog, modifierRulesById: new Map() }
      );
      return resolveAttributeContributions(
        attributeSeed(config, context.weaponSet),
        family.attributeContributions(context)
      ).attributes;
    }
  };
}

// Assumed boons now reach the same declaration as accepted live boons, without a second hook applying them.
for (const [name, specialization, trait, boons, declared, stats] of [
  ['engineer', 'Scrapper', 'Applied Force', { might: 10 }, { Power: 300 }, { power: 1600 }],
  ['necromancer', 'Core', 'Awaken the Pain', { might: 10 }, { Power: 100 }, { power: 1400 }],
  [
    'thief',
    'Deadeye',
    'Be Quick or Be Killed',
    { quickness: true },
    { Power: 200, Precision: 200 },
    { power: 1200, precision: 1200 }
  ],
  ['warrior', 'Core', 'Pinnacle of Strength', { might: 10 }, { Power: 100 }, { power: 1400 }]
]) {
  test(`${trait}: build facts and live query share one conditional contribution`, () => {
    const probe = scenario(name, specialization, [trait], { boons });
    assert.deepEqual(probe.declared(), declared);
    const live = probe.query.statsAt(0);
    for (const [key, expected] of Object.entries(stats)) assert.equal(live[key], expected, key);
    assert.deepEqual(scenario(name, specialization, [], { boons }).declared(), {});
  });
}

// Accepted applications are mutable at one timestamp; reads remain pure and expiry removes only the live bonus.
test('Explosive Temper observes grant, audience, cap and expiry without mutating the seed', () => {
  const probe = scenario('engineer', 'Core', ['Explosive Temper']);
  const grants = [];
  const runtime = { buffs: new Map([['explosive-temper', grants]]) };
  const seed = structuredClone(probe.config.attributeInputs);
  assert.equal(probe.query.statsAt(1, null, runtime).ferocity, 0);
  grants.push({ at: 1, expiresAt: 5, stacks: 3, resolvedAudience: { includesSelf: true } });
  grants.push({ at: 1, expiresAt: 5, stacks: 10, resolvedAudience: { includesSelf: false, includesSummons: true } });
  assert.equal(probe.query.statsAt(1, null, runtime).ferocity, 60);
  assert.equal(probe.declared(1, runtime).Ferocity, 60);
  grants.push({ at: 1, expiresAt: 5, stacks: 12, resolvedAudience: { includesSelf: true } });
  assert.equal(probe.query.statsAt(1, null, runtime).ferocity, 200);
  const before = structuredClone(runtime);
  assert.equal(probe.query.statsAt(5, null, runtime).ferocity, 0);
  assert.deepEqual(runtime, before);
  assert.deepEqual(probe.config.attributeInputs, seed);
});

test('Elementalist declarations follow attunement transitions and distinct Weaver hands', () => {
  const probe = scenario('elementalist', 'Core', ['Empowering Flame', 'Power Overwhelming', "Aeromancer's Training"], {
    startAttunement: 'Fire',
    boons: { might: 10 }
  });
  assert.equal(probe.declared().Power, 450);
  const runtime = { profession: { core: { primaryAttunement: 'Fire' } } };
  assert.equal(probe.query.statsAt(0, null, runtime).power, 1750);
  runtime.profession.core.primaryAttunement = 'Air';
  assert.equal(probe.query.statsAt(0, null, runtime).power, 1450);
  assert.equal(probe.query.statsAt(0, null, runtime).ferocity, 300);
  const weaver = scenario('elementalist', 'Weaver', ['Elemental Polyphony'], {
    startAttunement: 'Water',
    secondaryAttunement: 'Water'
  });
  assert.equal(weaver.declared()['Healing Power'], 200);
  const hands = {
    profession: {
      core: { primaryAttunement: 'Fire' },
      specialization: { kind: 'Weaver', state: { secondaryAttunement: 'Air' } }
    }
  };
  assert.equal(weaver.query.statsAt(0, null, hands).power, 1200);
  assert.equal(weaver.query.statsAt(0, null, hands).ferocity, 200);
});

test('Enhanced Potency respects selection, actor Fury and the active patch', () => {
  const options = { evokerElement: 'Air', boons: { fury: true } };
  assert.equal(scenario('elementalist', 'Evoker', [], options).query.statsAt(0).ferocity, 0);
  const probe = scenario('elementalist', 'Evoker', ['Enhanced Potency'], options);
  assert.equal(probe.declared().Ferocity, 75);
  assert.equal(probe.query.statsAt(0).ferocity, 75);
  assert.equal(probe.query.statsAt(0, { type: 'damage', actorType: 'summon', source: 'Clone' }).ferocity, 0);
  const id = probe.config.selectedTraitIds[0];
  const patched = withPatchPreview(families.elementalist, {
    id: 'conditional-flat-zero',
    label: 'Conditional flat zero',
    professions: { elementalist: { balanceProfiles: { [id]: { fields: { attributeBonus: 0 } } } } }
  });
  assert.equal(
    scenario(
      'elementalist',
      'Evoker',
      ['Enhanced Potency'],
      { ...options, patchId: 'conditional-flat-zero' },
      patched
    ).query.statsAt(0).ferocity,
    0
  );
});

test('Elemental Refreshment feeds utility and reinforcement without compounding either conversion', () => {
  // The intrinsic grant joins base Vitality, while reinforcement never feeds the tuning crystal back.
  const attributeInputs = baseAttributeInputs({ vitality: 1235 });
  for (const seed of attributeInputs.weaponSets)
    seed.conversions = equipmentAttributeConversions('Magnanimous Tuning Crystal');
  const weaver = scenario('elementalist', 'Weaver', ['Elemental Refreshment'], { attributeInputs });
  const original = structuredClone(attributeInputs);
  const stats = weaver.query.statsAt(0);
  assert.equal(stats.vitality, 1486);
  assert.equal(stats.conditionDamage, 72);
  assert.deepEqual(attributeInputs, original);
});

test('Sand Sage feeds utility conversions only while a shade lives without chaining Fell Beacon', () => {
  // The shade's flat Expertise feeds the crystal, while Expertise converted from Condition Damage cannot feed it back.
  const attributeInputs = baseAttributeInputs({ precision: 1000, expertise: 600, conditionDamage: 1000 });
  for (const seed of attributeInputs.weaponSets) seed.conversions = equipmentAttributeConversions('Tuning Icicle');
  const scourge = scenario('necromancer', 'Scourge', ['Sand Sage', 'Fell Beacon'], { attributeInputs });
  const runtime = { profession: { specialization: { kind: 'Scourge', state: { shades: [5] } } } };
  const original = structuredClone({ attributeInputs, runtime });
  const active = scourge.query.statsAt(4, null, runtime);
  const expired = scourge.query.statsAt(5, null, runtime);
  assert.equal(active.expertise, 895);
  assert.equal(expired.expertise, 670);
  assert.equal(active.conditionDamage, 1096);
  assert.equal(expired.conditionDamage, 1078);
  assert.deepEqual({ attributeInputs, runtime }, original);
});

test('Necromancer declarations observe shade and shroud expiry while Carapace reads stay pure', () => {
  const scourge = scenario('necromancer', 'Scourge', ['Sand Sage', 'Deadly Strength', 'Flesh of the Master']);
  const runtime = {
    profession: {
      core: { carapaceExpiries: [3, 5], activeMinions: { boneMinion: 2 } },
      specialization: { kind: 'Scourge', state: { shades: [5] } }
    }
  };
  const before = structuredClone(runtime);
  assert.equal(scourge.query.statsAt(3, null, runtime).power, 1050);
  assert.equal(scourge.query.statsAt(3, null, runtime).expertise, 225);
  assert.equal(scourge.query.statsAt(5, null, runtime).power, 1040);
  assert.equal(scourge.query.statsAt(5, null, runtime).expertise, 0);
  assert.deepEqual(runtime, before);
  const reaper = scenario('necromancer', 'Reaper', ["Reaper's Onslaught"]);
  runtime.profession.core.activeShroud = 'reaper';
  assert.equal(reaper.query.statsAt(0, null, runtime).ferocity, 300);
  runtime.profession.core.activeShroud = '';
  assert.equal(reaper.query.statsAt(0, null, runtime).ferocity, 0);
});

test('Revealed Training excludes its revealing attack but includes subsequent recalls until expiry', () => {
  const probe = scenario('thief', 'Core', ['Revealed Training']);
  const skill = probe.profession.catalog.skills.find((skill) => skill.stealthAttack);
  assert.ok(skill);
  const runtime = { profession: { core: { revealedUntil: 5 } } };
  const attack = { type: 'damage', actorType: 'player', skillId: skill.id };
  assert.equal(probe.query.statsAt(1, attack, runtime).power, 1080);
  assert.equal(probe.query.statsAt(1, { ...attack, metadata: { recallSkillId: skill.id } }, runtime).power, 1200);
  assert.equal(probe.query.statsAt(5, null, runtime).power, 1080);
});

test('Warrior live flats stay outside ordinary conversions and Blood Reaction sources', () => {
  const probe = scenario('warrior', 'Berserker', ['Pinnacle of Strength', 'Great Fortitude', 'Blood Reaction'], {
    boons: { might: 25 }
  });
  const runtime = { profession: { specialization: { kind: 'Berserker', state: { berserkUntil: null } } } };
  const before = probe.query.statsAt(0, null, runtime);
  assert.equal(before.power, 2000);
  assert.equal(before.vitality, 1150); // Reinforcement excludes converted Vitality.
  assert.equal(before.ferocity, 220);
  assert.equal(before.conditionDamage, 870);
  runtime.profession.specialization.state.berserkUntil = Infinity;
  const after = probe.query.statsAt(0, null, runtime);
  assert.equal(after.power, 2300);
  assert.equal(after.vitality, 1150);
  assert.equal(after.ferocity, 340);
  assert.equal(after.conditionDamage, 1140);
});

test('Blademaster declarations use both configured weapon sets and live swaps', () => {
  const probe = scenario('warrior', 'Core', ['Blademaster'], { primaryWeapon: 'Axe', weaponSet2Primary: 'Sword' });
  assert.equal(probe.declared().Expertise, 120);
  assert.equal(probe.query.statsAt(0).conditionDamage, 0);
  assert.equal(probe.query.statsAt(0, null, { activeWeaponSet: 2 }).conditionDamage, 120);
  const alternate = scenario('warrior', 'Core', ['Blademaster'], { ...probe.config, startingWeaponSet: 2 });
  assert.equal(alternate.declared()['Condition Damage'], 120);
});
