import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBuffedAttributes } from '#gw2/app/build/buffed-attributes.js';
import { attributeEffectControls, normalizeAttributePreview } from '#gw2/app/build/attribute-effects.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';

const adapters = {};
for (const name of [
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
  adapters[name] = (await import('#gw2/professions/' + name + '/app/app-definition.js'))[name + 'AppAdapter'];
}

// Minimal trait selections isolate conditional stat contracts from presets and rotations.
function previewApp(name, traitNames = [], specialization = null) {
  const adapter = adapters[name];
  const selections = new Map(specialization ? [[specialization, [0, 0, 0]]] : []);
  for (const name of traitNames) {
    const trait = adapter.profession.catalog.traits.find((trait) => trait.name === name);
    assert.ok(trait, name);
    const choices = selections.get(trait.specialization) || [0, 0, 0];
    const tier =
      typeof trait.tier === 'number'
        ? trait.tier
        : ['Major Adept', 'Major Master', 'Major Grandmaster'].indexOf(trait.tier) + 1;
    if (trait.position > 0 && tier > 0) choices[tier - 1] = trait.position;
    selections.set(trait.specialization, choices);
  }

  const app = {
    adapter,
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    patchId: 'current',
    attributeWeaponSet: 1,
    build: {
      ...createDefaultBuild(adapter),
      specializations: [...selections].map(([name, choices]) => ({ name, traits: choices.join('-') })),
      selectedSkills: {}
    }
  };
  adapter.recalculate(app);
  for (const name of traitNames)
    assert.ok(
      app.attributeData.activeTraits.some((trait) => trait.name === name),
      name
    );
  return app;
}

const stats = (app, input = {}) => calculateBuffedAttributes(app, input).attributes;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);

test('attribute controls require selected trait stack caps from the active catalog', () => {
  const app = previewApp('mesmer', ["Fencer's Finesse"]);
  const traitId = app.attributeData.activeTraits.find((trait) => trait.name === "Fencer's Finesse").id;
  const profiles = new Map(app.activeCatalog.balanceProfilesById);
  app.activeCatalog = { ...app.activeCatalog, balanceProfilesById: profiles };
  profiles.set(traitId, { ...profiles.get(traitId), maximumStacks: 7 });
  assert.equal(attributeEffectControls(app).find((control) => control.key === 'fencer').max, 7);
  profiles.delete(traitId);
  assert.throws(() => attributeEffectControls(app), /missing required profile/);
  assert.equal(
    attributeEffectControls(previewApp('guardian')).some((control) => control.key === 'fencer'),
    false
  );
});

// Relic stacks affect duration only while equipped, and preview state never leaks into the build.
test('Aristocracy previews bounded condition duration stacks for every profession', () => {
  for (const profession of Object.keys(adapters)) {
    const app = previewApp(profession);
    app.build.relic = 'Aristocracy';
    app.adapter.recalculate(app);
    const original = structuredClone({ build: app.build, attributes: app.attributeData });
    const control = attributeEffectControls(app).find((control) => control.key === 'aristocracy');
    assert.equal(control.max, 5);
    const base = stats(app);
    for (const [input, stacks] of [
      [0, 0],
      [2, 2],
      [5, 5],
      [99, 5],
      [-1, 0]
    ]) {
      const current = stats(app, { aristocracy: input });
      close(current['Condition Duration'].final, base['Condition Duration'].final + stacks * 3);
      assert.equal(current.Expertise.final, base.Expertise.final);
    }

    assert.deepEqual({ build: app.build, attributes: app.attributeData }, original);
    app.build.relic = '';
    app.adapter.recalculate(app);
    assert.ok(!attributeEffectControls(app).some((control) => control.key === 'aristocracy'));
    close(stats(app, { aristocracy: 5 })['Condition Duration'].final, stats(app)['Condition Duration'].final);
  }
});

test('boons are independent, bounded, reversible and isolated from the displayed weapon set and saved build', () => {
  const app = previewApp('guardian');
  app.attributeWeaponSet = 2;
  app.build.alternateWeaponPrefixes = ["Assassin's", "Assassin's"];
  app.adapter.recalculate(app);
  const original = structuredClone({ build: app.build, attributes: app.attributeData });
  const base = stats(app);
  for (const might of [0, 5, 25]) {
    const current = stats(app, { might });
    assert.equal(current.Power.final, base.Power.final + 30 * might);
    assert.equal(current['Condition Damage'].final, base['Condition Damage'].final + 30 * might);
    close(current['Critical Chance'].final, base['Critical Chance'].final);
  }

  close(stats(app, { fury: 1 })['Critical Chance'].final, base['Critical Chance'].final + 25);
  for (const name of ['Precision', 'Toughness', 'Vitality', 'Healing Power'])
    assert.equal(base[name].final, app.attributeData.attributes[name].final);
  const controls = attributeEffectControls(app);
  assert.deepEqual(normalizeAttributePreview(controls, { might: 999, fury: 1, elementalEmpowerment: 10 }), {
    might: 25,
    fury: 1
  });
  assert.equal(stats(app, { might: -1 }).Power.final, base.Power.final);
  assert.equal(stats(app, { might: NaN }).Power.final, base.Power.final);
  assert.equal(stats(app, { might: 2.9 }).Power.final, base.Power.final + 60);
  assert.deepEqual({ build: app.build, attributes: app.attributeData }, original);
});

test('Catalyst accepts zero, partial and maximum empowerment stacks with the correct conversion pool', () => {
  for (const empowered of [false, true]) {
    const app = previewApp('elementalist', empowered ? ['Empowered Empowerment'] : [], 'Catalyst');
    const base = stats(app);
    const pool = app.adapter.simulationConfig(app).catalystEmpowermentPool;
    for (const stacks of [0, 5, 10]) {
      const factor = empowered ? (stacks === 10 ? 0.2 : stacks * 0.015) : stacks * 0.01;
      const current = stats(app, { elementalEmpowerment: stacks, might: 25 });
      assert.equal(current.Power.final, base.Power.final + 750 + Math.round(pool.power * factor));
      close(current.Precision.final, base.Precision.final + pool.precision * factor);
      close(current['Critical Damage'].final, 150 + current.Ferocity.final / 15);
      close(current['Condition Duration'].final, base['Condition Duration'].final + (pool.expertise * factor) / 15);
    }

    assert.equal(
      stats(app, { elementalEmpowerment: 99 }).Power.final,
      stats(app, { elementalEmpowerment: 10 }).Power.final
    );
  }
});

test('Elementalist attunement, Fresh Air and hammer orbs are independent and weapon-gated', () => {
  const app = previewApp('elementalist', ['Fresh Air', 'Empowering Flame']);
  app.build.weapons = ['Hammer', ''];
  app.adapter.recalculate(app);
  const base = stats(app);
  assert.equal(stats(app, { freshAir: 1 }).Ferocity.final, base.Ferocity.final + 250);
  assert.equal(stats(app, { attunement: 'Fire' }).Power.final, base.Power.final + 150);
  close(stats(app, { crescentWind: 1 })['Critical Chance'].final, base['Critical Chance'].final + 15);
  app.build.weapons = ['Dagger', 'Focus'];
  app.adapter.recalculate(app);
  assert.ok(!attributeEffectControls(app).some((control) => control.key === 'crescentWind'));
  close(stats(app, { crescentWind: 1 })['Critical Chance'].final, stats(app)['Critical Chance'].final);
});

test('Engineer previews stack counts and Might-dependent specialization traits', () => {
  const app = previewApp('engineer', ['Explosive Temper', 'Applied Force']);
  const base = stats(app);
  assert.equal(stats(app, { explosiveTemper: 3 }).Ferocity.final, base.Ferocity.final + 60);
  assert.equal(stats(app, { might: 25 }).Power.final, base.Power.final + 1500);
});

test('Guardian previews Resolution, target Burning and Quickness without baked-in boon bonuses', () => {
  const app = previewApp('guardian', ['Righteous Instincts', 'Imbued Haste']);
  const base = stats(app);
  close(stats(app, { resolution: 1 })['Critical Chance'].final, base['Critical Chance'].final + 25);
  close(stats(app, { 'condition:Burning': 1 })['Critical Chance'].final, base['Critical Chance'].final + 10);
  assert.ok(stats(app, { quickness: 1 }).Vitality.final > base.Vitality.final);
  assert.equal(stats(app).Vitality.final, base.Vitality.final);
});

test('Mesmer previews timed and boon-dependent attributes separately', () => {
  const app = previewApp('mesmer', ["Fencer's Finesse", 'Chaotic Persistence']);
  const base = stats(app);
  assert.equal(stats(app, { fencer: 5 }).Ferocity.final, base.Ferocity.final + 75);
  assert.equal(stats(app, { regeneration: 1 }).Expertise.final, base.Expertise.final + 100);
  assert.equal(stats(app, { regeneration: 1 }).Concentration.final, base.Concentration.final + 250);
});

// Shroud is useful only with a selected attribute source; Scourge never enters shroud.
test('Shroud preview appears only for relevant traits or Signet of Spite', () => {
  const shroud = (app) => attributeEffectControls(app).find((control) => control.key === 'shroud');
  for (const specialization of [null, 'Reaper', 'Harbinger', 'Ritualist', 'Scourge'])
    assert.equal(shroud(previewApp('necromancer', [], specialization)), undefined);
  for (const trait of ['Death Perception', "Reaper's Onslaught"])
    assert.equal(shroud(previewApp('necromancer', [trait])).description, trait);

  const app = previewApp('necromancer');
  app.build.selectedSkills.Utility1 = 'Signet of Spite';
  app.adapter.recalculate(app);
  assert.equal(shroud(app).description, 'Signet of Spite');
  assert.equal(stats(app, { shroud: 1 }).Power.final, stats(app).Power.final - 180);
  delete app.build.selectedSkills.Utility1;
  app.adapter.recalculate(app);
  assert.equal(shroud(app), undefined);

  const scourge = previewApp('necromancer', ['Death Perception'], 'Scourge');
  scourge.build.selectedSkills.Utility1 = 'Signet of Spite';
  scourge.adapter.recalculate(scourge);
  assert.equal(shroud(scourge), undefined);
});

test('Necromancer previews Carapace, shroud and target Vulnerability', () => {
  const app = previewApp('necromancer', ['Deadly Strength', "Reaper's Onslaught", 'Decimate Defenses']);
  const base = stats(app);
  assert.equal(stats(app, { carapace: 5 }).Power.final, base.Power.final + 50);
  assert.equal(stats(app, { shroud: 1 }).Ferocity.final, base.Ferocity.final + 300);
  close(stats(app, { 'condition:Vulnerability': 10 })['Critical Chance'].final, base['Critical Chance'].final + 20);
});

// The compact count includes each explicitly enabled condition once, regardless of its stacks.
test('Target the Weak counts condition types without activating other condition-specific traits', () => {
  const app = previewApp('necromancer', ['Target the Weak', 'Decimate Defenses']);
  const original = structuredClone(app.build);
  const base = stats(app)['Critical Chance'].final;
  const controls = attributeEffectControls(app);
  assert.deepEqual(
    controls.filter((control) => control.kind === 'condition').map((control) => control.field),
    ['Vulnerability']
  );
  close(stats(app, { targetTheWeak: 5 })['Critical Chance'].final, base + 10);
  close(stats(app, { targetTheWeak: 5, 'condition:Vulnerability': 10 })['Critical Chance'].final, base + 32);
  close(stats(app, { targetTheWeak: 99 })['Critical Chance'].final, base + 26);
  close(stats(app, { targetTheWeak: -1 })['Critical Chance'].final, base);
  assert.deepEqual(app.build, original);

  const harbinger = previewApp('necromancer', ['Target the Weak', 'Wicked Corruption']);
  close(stats(harbinger, { targetTheWeak: 5 })['Critical Damage'].final, stats(harbinger)['Critical Damage'].final);
  close(
    stats(harbinger, { targetTheWeak: 5, 'condition:Torment': 1 })['Critical Chance'].final,
    stats(harbinger)['Critical Chance'].final + 12
  );
});

test('Ranger previews Fury-dependent Ferocity and flanking critical chance', () => {
  const opening = previewApp('ranger', ['Precise Strike']);
  assert.ok(!attributeEffectControls(opening).some((control) => control.key === 'openingStrike'));
  close(
    stats(opening, { openingStrike: 1 })['Critical Chance'].final,
    stats(previewApp('ranger'))['Critical Chance'].final
  );
  const app = previewApp('ranger', ['Vicious Quarry']);
  const base = stats(app);
  assert.equal(stats(app, { fury: 1 }).Ferocity.final, base.Ferocity.final + 250);
  close(stats(app, { fury: 1 })['Critical Chance'].final, base['Critical Chance'].final + 40);
  close(stats(app, { flanking: 1 })['Critical Chance'].final, base['Critical Chance'].final + 10);
});

test('Death Perception changes critical damage only in shroud and composes with other critical bonuses', () => {
  for (const specialization of [null, 'Reaper', 'Harbinger', 'Ritualist']) {
    const app = previewApp('necromancer', ['Death Perception'], specialization);
    const base = stats(app);
    const shroud = stats(app, { shroud: 1 });
    close(shroud['Critical Damage'].final, base['Critical Damage'].final * 1.1);
    close(shroud['Critical Chance'].final, base['Critical Chance'].final);
    close(stats(app, { shroud: 0 })['Critical Damage'].final, base['Critical Damage'].final);
  }

  const harbinger = previewApp('necromancer', ['Death Perception', 'Wicked Corruption']);
  const base = stats(harbinger);
  close(stats(harbinger, { 'condition:Torment': 1 })['Critical Damage'].final, base['Critical Damage'].final * 1.1);
  close(
    stats(harbinger, { shroud: 1, 'condition:Torment': 1 })['Critical Damage'].final,
    base['Critical Damage'].final * 1.21
  );
  const scourge = previewApp('necromancer', ['Death Perception'], 'Scourge');
  assert.ok(!attributeEffectControls(scourge).some((control) => control.key === 'shroud'));
});

test('Roiling Mists adds its critical chance only while the Fury preview is enabled', () => {
  for (const selected of [false, true]) {
    const app = previewApp('revenant', selected ? ['Roiling Mists'] : []);
    const base = stats(app);
    close(stats(app, { fury: 1 })['Critical Chance'].final, base['Critical Chance'].final + (selected ? 50 : 25));
    close(stats(app, { fury: 0 })['Critical Chance'].final, base['Critical Chance'].final);
  }
});

test('player health changes only the isolated stat preview', () => {
  // Preview health must affect conditional stats without leaking into builds or simulation configuration.
  for (const [profession, traits] of [
    ['thief', ['Twin Fangs', 'Keen Observer']],
    ['revenant', ['Empire Divided']]
  ]) {
    const app = previewApp(profession, traits);
    assert.ok(attributeEffectControls(app).some((control) => control.key === 'playerHealth'));
    const original = structuredClone({ build: app.build, attributes: app.attributeData });
    const config = app.adapter.simulationConfig(app);
    const low = stats(app, { playerHealth: 50 });
    const high = stats(app, { playerHealth: 51 });
    if (profession === 'thief') {
      close(high['Critical Chance'].final, low['Critical Chance'].final + 5);
      close(high['Critical Damage'].final, (low['Critical Damage'].final / 1.05) * 1.07);
    } else {
      close(high.Power.final, low.Power.final + 240);
    }

    assert.deepEqual(stats(app, { playerHealth: 0 }), low);
    assert.deepEqual(stats(app, { playerHealth: 100 }), high);
    assert.deepEqual({ build: app.build, attributes: app.attributeData }, original);
    assert.deepEqual(app.adapter.simulationConfig(app), config);
  }
});

test('all professions remove legacy player-health assumptions and expose no simulation health input', () => {
  // Exercise actual adapters so migration and simulation configuration share the same scope.
  for (const profession of Object.keys(adapters)) {
    const app = previewApp(profession);
    app.build.assumptions.playerHealthPercent = 20;
    app.build.assumptions.playerHealthFraction = 0.2;
    app.build = app.adapter.toApplicationBuild(app.build);
    assert.equal(Object.hasOwn(app.build.assumptions, 'playerHealthPercent'), false, profession);
    assert.equal(Object.hasOwn(app.build.assumptions, 'playerHealthFraction'), false, profession);
    assert.ok(!app.adapter.assumptionControls.some((control) => control.key === 'playerHealthPercent'), profession);
    app.adapter.recalculate(app);
    assert.equal(Object.hasOwn(app.adapter.simulationConfig(app), 'playerHealthFraction'), false, profession);
  }
});

test('Revenant previews improved Might and full-endurance critical chance', () => {
  const app = previewApp('revenant', ['Notoriety', 'Brutal Momentum']);
  const base = stats(app);
  assert.equal(stats(app, { might: 5 }).Power.final, base.Power.final + 200);
  assert.equal(stats(app, { might: 5 })['Condition Damage'].final, base['Condition Damage'].final + 100);
  close(stats(app, { fullEndurance: 1 })['Critical Chance'].final, base['Critical Chance'].final + 23);
});

test('Thief previews Revealed and stealth without activating zero-valued timers', () => {
  const app = previewApp('thief', ['Revealed Training', 'Hidden Killer']);
  const base = stats(app);
  assert.equal(stats(app, { revealed: 1 }).Power.final, base.Power.final + 120);
  close(stats(app, { stealth: 1 })['Critical Chance'].final, base['Critical Chance'].final + 100);
});

test('Warrior previews Signet Mastery stacks and Berserk attributes', () => {
  const app = previewApp('warrior', ['Signet Mastery'], 'Berserker');
  const base = stats(app);
  assert.equal(stats(app, { signetMastery: 2 }).Ferocity.final, base.Ferocity.final + 200);
  assert.equal(stats(app, { berserk: 1 }).Power.final, base.Power.final + 300);
  assert.equal(stats(app, { berserk: 1 })['Condition Damage'].final, base['Condition Damage'].final + 150);
});

test('all professions and specializations accept their available controls and reject unrelated effects', () => {
  for (const [name, adapter] of Object.entries(adapters)) {
    for (const specialization of adapter.profession.catalog.specializations) {
      for (const choices of ['1-1-1', '2-2-2', '3-3-3']) {
        const app = previewApp(name);
        app.build.specializations = [{ name: specialization.name, traits: choices }];
        app.adapter.recalculate(app);
        const controls = attributeEffectControls(app);
        assert.equal(new Set(controls.map((control) => control.key)).size, controls.length);
        const inputs = Object.fromEntries(
          controls.map((control) => [control.key, control.options?.at(-1) ?? control.max ?? 1])
        );
        const current = stats(app, inputs);
        for (const [attribute, value] of Object.entries(current))
          assert.ok(Number.isFinite(value.final), name + ' ' + specialization.name + ' ' + attribute);
        assert.equal(normalizeAttributePreview(controls, { unrelated: 1 }).unrelated, undefined);
      }
    }
  }
});
