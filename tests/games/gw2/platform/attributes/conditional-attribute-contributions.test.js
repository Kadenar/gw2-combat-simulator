import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { attributeContext, resolveAttributeContributions } from '#gw2/platform/attributes/evaluation.js';
import { attributeSeed, baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { createTestLiveEffects, grantTestEffect } from '#tests/helpers/live-effects.js';

const families = {};
for (const name of ['elementalist', 'engineer', 'necromancer', 'thief', 'warrior']) {
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
    // Evaluate declarations directly so their results can be compared with combat-query stats.
    declared(time = 0, runtime = null) {
      const context = attributeContext(
        { config, profession, time, runtime },
        { catalog: profession.catalog, modifierRulesById: new Map() }
      );
      return resolveAttributeContributions(
        attributeSeed(config, context.weaponSet),
        family.attributeContributions(context)
      ).attributes;
    }
  };
}

// A selected trait contributes the same bonus through the build and combat queries.
test('assumed boons reach build and combat contributions once', () => {
  const options = { boons: { might: 10 } };
  const selected = scenario('engineer', 'Scrapper', ['Applied Force'], options);
  const base = scenario('engineer', 'Scrapper', [], options);
  const bonus = selected.declared().Power;
  assert.ok(bonus > 0);
  assert.equal(selected.query.statsAt(0).power - base.query.statsAt(0).power, bonus);
});

// Accepted applications are mutable at one timestamp; reads remain pure and expiry removes only the live bonus.
test('Explosive Temper observes grant, audience, cap and expiry without mutating the seed', () => {
  const probe = scenario('engineer', 'Core', ['Explosive Temper']);
  const grants = [];
  const runtime = { liveEffects: createTestLiveEffects([['explosive-temper', grants]]) };
  const seed = structuredClone(probe.config.attributeInputs);
  assert.equal(probe.query.statsAt(1, null, runtime).ferocity, 0);
  grantTestEffect(runtime.liveEffects, {
    kind: 'explosive-temper',
    at: 1,
    expiresAt: 5,
    stacks: 3,
    resolvedAudience: { includesSelf: true }
  });
  const own = probe.query.statsAt(1, null, runtime).ferocity;
  grantTestEffect(runtime.liveEffects, {
    kind: 'explosive-temper',
    at: 1,
    expiresAt: 5,
    stacks: 10,
    resolvedAudience: { includesSelf: false, includesSummons: true }
  });
  const partial = probe.query.statsAt(1, null, runtime).ferocity;
  assert.ok(partial > 0);
  assert.equal(partial, own);
  assert.equal(probe.declared(1, runtime).Ferocity, partial);
  grantTestEffect(runtime.liveEffects, {
    kind: 'explosive-temper',
    at: 1,
    expiresAt: 5,
    stacks: 12,
    resolvedAudience: { includesSelf: true }
  });
  const capped = probe.query.statsAt(1, null, runtime).ferocity;
  assert.ok(capped > partial);
  grantTestEffect(runtime.liveEffects, {
    kind: 'explosive-temper',
    at: 1,
    expiresAt: 5,
    stacks: 100,
    resolvedAudience: { includesSelf: true }
  });
  assert.equal(probe.query.statsAt(1, null, runtime).ferocity, capped);
  const before = runtime.liveEffects.queries.buffApplications('explosive-temper');
  assert.equal(probe.query.statsAt(5.000001, null, runtime).ferocity, 0);
  assert.deepEqual(runtime.liveEffects.queries.buffApplications('explosive-temper'), before);
  assert.deepEqual(probe.config.attributeInputs, seed);
});

test('Elementalist declarations follow attunement transitions and distinct Weaver hands', () => {
  const probe = scenario('elementalist', 'Core', ['Empowering Flame', 'Power Overwhelming', "Aeromancer's Training"], {
    startAttunement: 'Fire',
    boons: { might: 10 }
  });
  const runtime = { profession: { core: { primaryAttunement: 'Fire' } } };
  const fire = probe.query.statsAt(0, null, runtime);
  runtime.profession.core.primaryAttunement = 'Air';
  const air = probe.query.statsAt(0, null, runtime);
  assert.ok(fire.power > air.power);
  assert.ok(air.ferocity > fire.ferocity);
  const weaver = scenario('elementalist', 'Weaver', ['Elemental Polyphony'], {
    startAttunement: 'Water',
    secondaryAttunement: 'Water'
  });
  const water = weaver.query.statsAt(0);
  const hands = {
    profession: {
      core: { primaryAttunement: 'Fire' },
      specialization: { kind: 'Weaver', state: { secondaryAttunement: 'Air' } }
    }
  };
  const mixed = weaver.query.statsAt(0, null, hands);
  assert.ok(mixed.power > water.power);
  assert.ok(mixed.ferocity > water.ferocity);
  assert.ok(mixed.healingPower < water.healingPower);
});

test('Enhanced Potency respects selection, actor Fury and the active patch', () => {
  const options = { evokerElement: 'Air', boons: { fury: true } };
  assert.equal(scenario('elementalist', 'Evoker', [], options).query.statsAt(0).ferocity, 0);
  const probe = scenario('elementalist', 'Evoker', ['Enhanced Potency'], options);
  assert.ok(probe.declared().Ferocity > 0);
  assert.equal(probe.query.statsAt(0).ferocity, probe.declared().Ferocity);
  assert.equal(probe.query.statsAt(0, { type: 'damage', actorType: 'summon', source: 'Clone' }).ferocity, 0);
  const id = probe.config.selectedTraitIds[0];
  const patched = withPatchPreview(families.elementalist, {
    id: 'conditional-flat-zero',
    label: 'Conditional flat zero',
    professions: { elementalist: { balanceProfiles: { [id]: { fields: { 'attributeBonuses.ferocity': 0 } } } } }
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
  const active = scourge.query.statsAt(3.000001, null, runtime);
  const expired = scourge.query.statsAt(5.000001, null, runtime);
  assert.ok(active.power > expired.power);
  assert.ok(active.expertise > expired.expertise);
  assert.deepEqual(runtime, before);
  const reaper = scenario('necromancer', 'Reaper', ["Reaper's Onslaught"]);
  runtime.profession.core.activeShroud = 'reaper';
  const inShroud = reaper.query.statsAt(0, null, runtime).ferocity;
  runtime.profession.core.activeShroud = '';
  assert.ok(inShroud > reaper.query.statsAt(0, null, runtime).ferocity);
});

test('Revealed Training follows live status for attacks and recalls through its expiry timestamp', () => {
  const probe = scenario('thief', 'Core', ['Revealed Training']);
  const skill = probe.profession.catalog.skills.find((skill) => skill.stealthAttack);
  assert.ok(skill);
  const runtime = { profession: { core: { revealedUntil: 0 } } };
  const attack = { type: 'damage', actorType: 'player', skillId: skill.id };
  // The revealing hit resolves before the stealth exit applies Revealed; later hits read the live status.
  const baseline = probe.query.statsAt(1, attack, runtime).power;
  runtime.profession.core.revealedUntil = 5;
  const revealed = probe.query.statsAt(1, attack, runtime).power;
  assert.ok(revealed > baseline);
  assert.equal(probe.query.statsAt(1, { ...attack, metadata: { recallSkillId: skill.id } }, runtime).power, revealed);
  assert.equal(probe.query.statsAt(5, attack, runtime).power, revealed);
  assert.equal(probe.query.statsAt(5.000001, attack, runtime).power, baseline);
});

test('Blademaster declarations use both configured weapon sets and live swaps', () => {
  const probe = scenario('warrior', 'Core', ['Blademaster'], { primaryWeapon: 'Axe', weaponSet2Primary: 'Sword' });
  assert.equal(probe.query.statsAt(0).conditionDamage, 0);
  const swapped = probe.query.statsAt(0, null, { activeWeaponSet: 2 }).conditionDamage;
  assert.ok(swapped > 0);
  const alternate = scenario('warrior', 'Core', ['Blademaster'], { ...probe.config, startingWeaponSet: 2 });
  assert.equal(alternate.declared()['Condition Damage'], swapped);
});
