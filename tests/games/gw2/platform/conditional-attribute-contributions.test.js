import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeContext, resolveAttributeContributions } from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed, baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

const families = {};
for (const name of ['elementalist', 'engineer', 'necromancer', 'revenant', 'thief', 'warrior']) {
  families[name] = (await import(`#gw2/professions/${name}/profession.js`))[`${name}Profession`];
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
        attributeSeed(config, context.weaponSet).conversionPool,
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
  const runtime = { profession: { specialization: { kind: 'Berserker', state: { berserkActive: false } } } };
  const before = probe.query.statsAt(0, null, runtime);
  assert.equal(before.power, 2000);
  assert.equal(before.vitality, 1100);
  assert.equal(before.ferocity, 220);
  assert.equal(before.conditionDamage, 870);
  runtime.profession.specialization.state.berserkActive = true;
  const after = probe.query.statsAt(0, null, runtime);
  assert.equal(after.power, 2300);
  assert.equal(after.vitality, 1130);
  assert.equal(after.ferocity, 370);
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
