import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { calculateBuffedAttributes, calculateSkillDamageAttributes } from '#gw2/app/build/buffed-attributes.js';
import { skillDamageControls, clearedValues, createSkillDamagePlan } from '#gw2/app/build/skill-damage/plan.js';
import { createSkillDamagePreview } from '#gw2/app/build/skill-damage/preview.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/query-preview.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { attributeEffectControls } from '#gw2/app/build/attribute-effects.js';
import { ENGINEER_SKILL_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
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
    if (trait.position > 0 && trait.tier > 0) choices[trait.tier - 1] = trait.position;
    selections.set(trait.specialization, choices);
  }

  const app = {
    adapter,
    gameId: 'gw2',
    contentId: name,
    skills: [...adapter.profession.catalog.skills],
    weaponData: adapter.weaponData,
    results: null,
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    patchId: 'current',
    attributeWeaponSet: 1,
    build: {
      ...createDefaultBuild(adapter),
      specializations: [...selections].map(([name, choices]) => ({ name, traits: choices.join('-') })),
      selectedSkillIds: {}
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

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const stats = (app, input = {}) => {
  const controls = skillDamageControls(app);
  return calculateSkillDamageAttributes(app, { ...clearedValues(controls), ...input }, controls).attributes;
};

// Native signet cooldown and active-buff states must agree in both previews for every Warrior specialization.
test('Signet of Fury replaces passive Precision with active Precision and Ferocity', () => {
  for (const specialization of ['Core', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon']) {
    const app = previewApp('warrior', [], specialization === 'Core' ? null : specialization);
    const base = stats(app);
    const id = app.skills.find((skill) => skill.name === 'Signet of Fury').id;
    app.build.selectedSkillIds.Utility1 = id;
    app.adapter.recalculate(app);
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    assert.equal(clearedValues(controls).signetOfFury, 'off');
    assert.equal(
      calculateSkillDamageAttributes(app, {}, controls).attributes.Precision.final,
      base.Precision.final + 180
    );
    for (const [signetOfFury, precision, ferocity] of [
      ['off', 0, 0],
      ['passive', 180, 0],
      ['active', 360, 360],
      ['off', 0, 0]
    ]) {
      const values = { ...clearedValues(controls), signetOfFury };
      for (const attributes of [
        calculateBuffedAttributes(app, values).attributes,
        calculateSkillDamageAttributes(app, values, controls).attributes
      ]) {
        assert.equal(attributes.Precision.final, base.Precision.final + precision, specialization);
        assert.equal(attributes.Ferocity.final, base.Ferocity.final + ferocity, specialization);
      }
    }

    assert.deepEqual(app.build, saved);
    delete app.build.selectedSkillIds.Utility1;
    app.adapter.recalculate(app);
    assert.equal(
      skillDamageControls(app).some((control) => control.key === 'signetOfFury'),
      false
    );
  }
});

// Explicit Off suppresses signet bonuses even with J-Drive; enabled bonuses keep the trait's stronger values.
test('Mechanist signet toggles independently honor J-Drive bonus strength', () => {
  for (const jdrive of [false, true]) {
    const app = previewApp('engineer', jdrive ? ['Mech Core: J-Drive'] : [], 'Mechanist');
    app.build.selectedSkillIds.Utility1 = ENGINEER.FORCE_SIGNET;
    app.build.selectedSkillIds.Utility2 = ENGINEER.SUPERCONDUCTING_SIGNET;
    app.adapter.recalculate(app);
    const saved = structuredClone(app.build);
    const controls = skillDamageControls(app);
    const forceKey = `passive:${ENGINEER.FORCE_SIGNET}`;
    const superconductingKey = `passive:${ENGINEER.SUPERCONDUCTING_SIGNET}`;
    for (const key of [forceKey, superconductingKey])
      assert.equal(controls.find((control) => control.key === key).initial, 1);
    const base = stats(app);
    for (const [force, superconducting] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 0]
    ]) {
      const active = stats(app, { [forceKey]: force, [superconductingKey]: superconducting });
      close(active['Strike Multiplier'].final - base['Strike Multiplier'].final, force * (jdrive ? 0.18 : 0.15));
      close(
        active['Condition Multiplier'].final - base['Condition Multiplier'].final,
        superconducting * (jdrive ? 0.12 : 0.1)
      );
    }

    assert.deepEqual(app.build, saved);
  }
});

// The editor's sword rows must resolve to identities present in the selected specialization's runtime.
test('Engineer sword damage rows use Holosmith variants only for Holosmith', () => {
  const ordinary = [
    ENGINEER.SUN_EDGE_NON_HOLOSMITH,
    ENGINEER.SUN_RIPPER_NON_HOLOSMITH,
    ENGINEER.GLEAM_SABER_NON_HOLOSMITH,
    ENGINEER.REFRACTION_CUTTER_NON_HOLOSMITH,
    ENGINEER.RADIANT_ARC_NON_HOLOSMITH
  ];
  const holosmith = [
    ENGINEER.SUN_EDGE,
    ENGINEER.SUN_RIPPER,
    ENGINEER.GLEAM_SABER,
    ENGINEER.REFRACTION_CUTTER,
    ENGINEER.RADIANT_ARC
  ];
  for (const specialization of ['Core', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam']) {
    const app = previewApp('engineer', [], specialization === 'Core' ? null : specialization);
    app.build.weapons = ['Sword', 'Pistol'];
    app.adapter.recalculate(app);
    const controls = skillDamageControls(app);
    const plan = createSkillDamagePlan(app, controls, clearedValues(controls));
    const ids = new Set(plan.groups.find((group) => group.id === 'weapon-1-Sword').rowIds);
    const occurrences = plan.request.occurrences.filter((occurrence) => ids.has(occurrence.id));
    assert.deepEqual(
      new Set(occurrences.map((entry) => entry.effect.id)),
      new Set(specialization === 'Holosmith' ? holosmith : ordinary),
      specialization
    );
    const results = evaluateSkillDamage({ ...plan.request, occurrences }, app.profession).occurrences;
    for (const result of results) assert.equal(result.status, 'measured', `${specialization}: ${result.reason}`);
  }
});

// Signet states replace each other in both panels and the actual skill breakdown, without changing the loadout.
test("Assassin's Signet previews Off, Passive and Active as mutually exclusive Power bonuses", () => {
  const app = previewApp('thief');
  const signet = app.skills.find((skill) => skill.name === "Assassin's Signet");
  app.build.weapons = ['Dagger', 'Dagger'];
  app.adapter.recalculate(app);
  const unequipped = stats(app).Power.final;
  app.build.selectedSkillIds.Utility1 = signet.id;
  app.adapter.recalculate(app);
  const saved = structuredClone({ build: app.build, attributes: app.attributeData });
  const controls = skillDamageControls(app);
  const control = controls.find((entry) => entry.key === 'assassinsSignet');
  assert.deepEqual(control.options, ['off', 'passive', 'active']);
  assert.equal(control.initial, 'passive');
  assert.equal(
    controls.some((entry) => entry.key === `passive:${signet.id}`),
    false
  );
  assert.equal(clearedValues(controls).assassinsSignet, 'off');
  assert.equal(calculateBuffedAttributes(app).attributes.Power.final, unequipped + 180);
  assert.equal(calculateSkillDamageAttributes(app, {}, controls).attributes.Power.final, unequipped + 180);
  for (const [assassinsSignet, bonus] of [
    ['off', 0],
    ['passive', 180],
    ['active', 540],
    ['off', 0]
  ]) {
    const values = { ...clearedValues(controls), assassinsSignet };
    assert.equal(calculateBuffedAttributes(app, values).attributes.Power.final, unequipped + bonus);
    assert.equal(calculateSkillDamageAttributes(app, values, controls).attributes.Power.final, unequipped + bonus);
    const { request } = createSkillDamagePlan(app, controls, values);
    assert.ok(request.config.selectedSkillIds.includes(signet.id));
    const strike = request.occurrences.find((entry) => entry.name === 'Double Strike');
    assert.ok(strike);
    const [result] = evaluateSkillDamage({ ...request, occurrences: [strike] }, app.profession).occurrences;
    assert.equal(result.status, 'measured', result.reason);
    assert.equal(result.measurement.strikeBreakdown.power, unequipped + bonus);
  }

  assert.deepEqual({ build: app.build, attributes: app.attributeData }, saved);
  delete app.build.selectedSkillIds.Utility1;
  app.adapter.recalculate(app);
  for (const available of [skillDamageControls(app), attributeEffectControls(app)])
    assert.equal(
      available.some((entry) => entry.key === 'assassinsSignet'),
      false
    );
  assert.equal(stats(app, { assassinsSignet: 'active' }).Power.final, unequipped);
});

// Minimal trait selections test the real preview-to-native-modifier path without rotation regressions.
for (const [profession, trait, key, value, attribute] of [
  ['elementalist', 'Bountiful Power', 'bountifulPower', 1, 'Strike Multiplier'],
  ['engineer', 'Thermal Vision', 'thermalVision', 1, 'Condition Multiplier'],
  ['engineer', 'Kinetic Battery', 'kineticBattery', 1, 'Strike Multiplier'],
  ['engineer', 'Excessive Energy', 'vigor', 1, 'Strike Multiplier'],
  ['engineer', 'Object in Motion', 'superspeed', 1, 'Strike Multiplier'],
  ['engineer', 'Object in Motion', 'stability', 1, 'Strike Multiplier'],
  ['engineer', 'Object in Motion', 'swiftness', 1, 'Strike Multiplier'],
  ['guardian', 'Inspiring Virtue', 'inspiringVirtue', 1, 'Strike Multiplier'],
  ['guardian', 'Unscathed Contender', 'aegis', 1, 'Strike Multiplier'],
  ['guardian', 'Big Game Hunter', 'bigGameHunter', 1, 'Strike Multiplier'],
  ['guardian', 'Empowered Armaments', 'empoweredArmaments', 1, 'Strike Multiplier'],
  ['mesmer', 'Compounding Power', 'compoundingPower', 5, 'Strike Multiplier'],
  ['mesmer', 'Illusionary Membrane', 'illusionaryMembrane', 1, 'Condition Multiplier'],
  ['mesmer', 'Time Bomb', 'timeBomb', 1, 'Strike Multiplier'],
  ['mesmer', 'Phantom Pain', 'phantomPain', 4, 'Strike Multiplier'],
  ['mesmer', 'Deadly Blades', 'deadlyBlades', 1, 'Strike Multiplier'],
  ['mesmer', 'Altered Chord', 'alteredChord', 1, 'Strike Multiplier'],
  ['necromancer', 'Deadly Strength', 'carapace', 10, 'Power'],
  ['necromancer', 'Sand Sage', 'shade', 1, 'Expertise'],
  ['necromancer', 'Target the Weak', 'targetTheWeak', 3, 'Critical Chance'],
  ['necromancer', 'Cold Shoulder', 'condition:Chilled', 1, 'Strike Multiplier'],
  ['ranger', 'Light on your Feet', 'lightOnYourFeet', 1, 'Strike Multiplier'],
  ['ranger', 'Natural Balance', 'naturalBalance', 1, 'Condition Multiplier'],
  ['ranger', 'Twice as Vicious', 'twiceAsVicious', 1, 'Strike Multiplier'],
  ['ranger', 'Ferocious Symbiosis', 'ferociousSymbiosis', 5, 'Strike Multiplier'],
  ['revenant', 'Forerunner of Death', 'forerunnerOfDeath', 1, 'Strike Multiplier'],
  ['revenant', 'Brutal Momentum', 'fullEndurance', 1, 'Critical Chance'],
  ['thief', 'Fluid Strikes', 'fluidStrikes', 1, 'Strike Multiplier'],
  ['thief', 'Bounding Dodger', 'boundingDodger', 1, 'Strike Multiplier'],
  ['thief', 'Lotus Training', 'lotusTraining', 1, 'Condition Multiplier'],
  ['thief', 'Revealed Training', 'revealed', 1, 'Power'],
  ['thief', 'Hidden Killer', 'stealth', 1, 'Critical Chance'],
  ['warrior', 'Magebane Tether', 'magebaneTether', 1, 'Strike Multiplier'],
  ['warrior', "Warrior's Sprint", 'swiftness', 1, 'Strike Multiplier'],
  ['warrior', 'Stalwart Strength', 'stability', 1, 'Strike Multiplier']
]) {
  test(`${profession}: ${trait} preview applies and clears ${key}`, () => {
    const app = previewApp(profession, [trait]);
    const saved = structuredClone(app.build);
    assert.ok(
      skillDamageControls(app).some((control) => control.key === key),
      `missing ${key}`
    );
    const base = stats(app);
    const active = stats(app, { [key]: value });
    assert.ok(
      active[attribute].final > base[attribute].final,
      `${attribute}: ${active[attribute].final} <= ${base[attribute].final}`
    );
    close(stats(app)[attribute].final, base[attribute].final);
    assert.deepEqual(app.build, saved);
  });
}

// Perfect Weave inherits both offensive attunement windows, and clearing it removes both.
test('Perfect Weave supplies Air strike and Fire condition bonuses', () => {
  const app = previewApp('elementalist', [], 'Weaver');
  const base = stats(app);
  const active = stats(app, { perfectWeave: 1 });
  close(active['Strike Multiplier'].final - base['Strike Multiplier'].final, 0.1);
  close(active['Condition Multiplier'].final - base['Condition Multiplier'].final, 0.2);
  close(stats(app)['Strike Multiplier'].final, base['Strike Multiplier'].final);
});

// Form state must agree with attributes and ordinary damage, while primal bursts require Berserk inherently.
test('Berserk gives ordinary and primal previews their native attributes and trait bonuses', () => {
  const app = previewApp('warrior', ['Smash Brawler', 'Bloody Roar'], 'Berserker');
  app.build.weapons = ['Dagger', 'Axe'];
  app.adapter.recalculate(app);
  const base = stats(app);
  const active = stats(app, { berserk: 1 });
  close(active.Power.final - base.Power.final, 300);
  assert.ok(active['Critical Chance'].final > base['Critical Chance'].final);
  assert.ok(active['Strike Multiplier'].final > base['Strike Multiplier'].final);
  const controls = skillDamageControls(app);
  const { request } = createSkillDamagePlan(app, controls, clearedValues(controls));
  const primal = request.occurrences.find((entry) => entry.name === 'Slicing Maelstrom');
  assert.ok(primal);
  const [result] = evaluateSkillDamage({ ...request, occurrences: [primal] }, app.profession).occurrences;
  assert.equal(result.status, 'measured', result.reason);
  close(result.measurement.strikeBreakdown.power, active.Power.final);
  close(result.measurement.strikeBreakdown.criticalChance * 100, active['Critical Chance'].final);
});

// Skill windows use actual slotted skills, while native profession windows need no prerequisite cast.
for (const [profession, specialization, skillName, key, weapons] of [
  ['elementalist', 'Catalyst', 'Relentless Fire', 'relentlessFire'],
  ['elementalist', null, null, 'flameWheel', ['Hammer', '']],
  ['engineer', 'Amalgam', null, 'plasmaticState'],
  ['guardian', 'Luminary', 'Piercing Stance', 'piercingStance'],
  ['guardian', 'Luminary', 'Daring Advance', 'daringAdvance'],
  ['ranger', 'Soulbeast', '"Sic \'Em!"', 'sicEm'],
  ['revenant', 'Herald', null, 'burstOfStrength'],
  ['thief', null, null, 'distractingThrow', ['Spear', '']],
  ['thief', 'Antiquary', null, 'artifactMomentum']
]) {
  test(`${profession}: ${key} reaches native outgoing damage`, () => {
    const app = previewApp(profession, [], specialization);
    if (skillName) {
      const skill = app.skills.find((skill) => skill.name === skillName);
      assert.ok(skill, skillName);
      app.build.selectedSkillIds.Utility1 = skill.id;
    }

    if (weapons) app.build.weapons = weapons;
    app.adapter.recalculate(app);
    assert.ok(
      skillDamageControls(app).some((control) => control.key === key),
      key
    );
    assert.ok(stats(app, { [key]: 1 })['Strike Multiplier'].final > stats(app)['Strike Multiplier'].final);
  });
}

// Damage-panel resource inputs must preserve the same conditional attributes as the separate attribute panel.
for (const [profession, trait, key, value, attribute] of [
  ['necromancer', 'Deadly Strength', 'carapace', 5, 'Power'],
  ['necromancer', 'Sand Sage', 'shade', 1, 'Expertise'],
  ['mesmer', 'Fortissimo', 'instruments', 4, 'Power'],
  ['revenant', 'Bolstered Bonds', 'cosmicWisdom', 1, 'Power'],
  ['thief', 'Revealed Training', 'revealed', 1, 'Power']
]) {
  test(`${profession}: ${key} agrees across isolated previews`, () => {
    const app = previewApp(profession, [trait]);
    if (profession === 'revenant') {
      app.build.selectedLegends = ['LegendaryAssassin', 'LegendaryDemon'];
      app.adapter.recalculate(app);
    }

    const delta = stats(app, { [key]: value })[attribute].final - stats(app)[attribute].final;
    assert.ok(delta > 0, `${key} has no effect`);
    close(
      delta,
      calculateBuffedAttributes(app, { [key]: value }).attributes[attribute].final -
        calculateBuffedAttributes(app).attributes[attribute].final
    );
  });
}

test('Paragon previews motivation tiers and the selected refrain independently', () => {
  const app = previewApp('warrior', ['Brisk Pacing', 'Strengthening Stanzas'], 'Paragon');
  const base = stats(app);
  for (const [motivation, strike, condition] of [
    [1, 0.1, 0.05],
    [4, 0.2, 0.15],
    [7, 0.3, 0.25]
  ]) {
    const current = stats(app, { motivation });
    close(current['Strike Multiplier'].final - base['Strike Multiplier'].final, strike);
    close(current['Condition Multiplier'].final - base['Condition Multiplier'].final, condition);
  }

  const refrain = String(app.skills.find((skill) => skill.name === 'Chant of Action').id);
  close(stats(app, { refrain })['Strike Multiplier'].final - base['Strike Multiplier'].final, 0.15);
});

test('Renegade Fervor respects the selected trait cap', () => {
  for (const lasting of [false, true]) {
    const app = previewApp('revenant', lasting ? ['Lasting Legacy'] : [], 'Renegade');
    const control = skillDamageControls(app).find((control) => control.key === 'kallasFervor');
    const base = stats(app)['Condition Multiplier'].final;
    const max = stats(app, { kallasFervor: control.max })['Condition Multiplier'].final;
    assert.ok(max > base);
    close(stats(app, { kallasFervor: 100 })['Condition Multiplier'].final, max);
  }
});

test('Revenant upkeep gives the same outgoing factor to the stat strip and a weapon row', () => {
  const app = previewApp('revenant', ['Forceful Persistence'], 'Herald');
  app.build.selectedLegends = ['LegendaryDragon', 'LegendaryAssassin'];
  app.build.weapons = ['Sword', 'Sword'];
  app.adapter.recalculate(app);
  const controls = skillDamageControls(app);
  const upkeep = String(app.skills.find((skill) => skill.name === 'Facet of Strength').id);
  for (const value of ['null', upkeep]) {
    const values = { ...clearedValues(controls), upkeep: value };
    const { request } = createSkillDamagePlan(app, controls, values);
    const strike = request.occurrences.find((entry) => entry.name === 'Preparation Thrust');
    assert.ok(strike);
    const [result] = evaluateSkillDamage({ ...request, occurrences: [strike] }, app.profession).occurrences;
    assert.equal(result.status, 'measured', result.reason);
    close(
      result.measurement.strikeBreakdown.outgoingMultiplier,
      stats(app, { upkeep: value })['Strike Multiplier'].final
    );
  }

  close(stats(app, { upkeep })['Strike Multiplier'].final - stats(app)['Strike Multiplier'].final, 0.1);
});

test('Cartridges apply the selected explosion bonus and leave ordinary strikes alone', () => {
  const app = previewApp('warrior', [], 'Bladesworn');
  app.build.selectedSkillIds.Utility1 = app.skills.find((skill) => skill.name === 'Overcharged Cartridges').id;
  app.adapter.recalculate(app);
  const controls = skillDamageControls(app);
  for (const [cartridges, bonus] of [
    ['', 0],
    ['overcharged-cartridges', 0.15],
    ['supercharged-cartridges', 0.2]
  ]) {
    const preview = createSkillDamagePreview(app, controls, { ...clearedValues(controls), cartridges });
    const [ordinary, explosion] = queryDamagePreview(app.profession, preview.config, preview.inputs, (runtime) => {
      const event = { type: 'strike', at: runtime.time, actorType: 'player', source: 'Player', sourceId: 'preview' };
      return [
        runtime.query.strikeMultiplier(event, runtime.time, runtime),
        runtime.query.strikeMultiplier({ ...event, damageKind: 'explosion' }, runtime.time, runtime)
      ];
    });
    close(explosion / ordinary, 1 + bonus);
  }
});

// Count assumptions add distinct unnamed types, preserve named gates, and stop at the game's condition count.
test('anonymous target conditions remain bounded alongside named damage condition controls', () => {
  const app = previewApp('necromancer', ['Target the Weak', 'Decimate Defenses']);
  app.build.weapons = ['Dagger', 'Focus'];
  app.adapter.recalculate(app);
  const controls = skillDamageControls(app);
  const { config } = createSkillDamagePreview(app, controls, {
    ...clearedValues(controls),
    targetTheWeak: 99,
    'condition:Chilled': 1,
    'condition:Bleeding': 1,
    'condition:Vulnerability': 25
  });
  assert.equal(Object.keys(config.target.conditions).length, 14);
  assert.equal(config.target.conditions.Bleeding, true);
  assert.equal(config.target.conditions.Chilled, true);
  assert.equal(config.target.conditions.Burning, undefined);
});

// A named target gate must affect the corresponding skill payload, not just the generic stat strip.
test('Life Siphon previews its Bleeding-target bonus without applying actual Bleeding damage', () => {
  const app = previewApp('necromancer');
  app.build.weapons = ['Dagger', 'Focus'];
  app.adapter.recalculate(app);
  const controls = skillDamageControls(app);
  const totals = [];
  for (const bleeding of [0, 1]) {
    const { request } = createSkillDamagePlan(app, controls, {
      ...clearedValues(controls),
      'condition:Bleeding': bleeding
    });
    const siphon = request.occurrences.find((entry) => entry.name === 'Life Siphon');
    assert.ok(siphon);
    const [result] = evaluateSkillDamage({ ...request, occurrences: [siphon] }, app.profession).occurrences;
    assert.equal(result.status, 'measured', result.reason);
    totals.push(result.measurement.total);
    assert.equal(result.measurement.conditionDamage, 0);
  }

  assert.ok(totals[1] > totals[0]);
});

// Revealed changes Revealed Training; Hidden Killer's actual preview input is Stealth.
test('Hidden Killer exposes Stealth without an ineffective Revealed control', () => {
  const hidden = previewApp('thief', ['Hidden Killer']);
  const revealed = previewApp('thief', ['Revealed Training']);
  for (const controls of [skillDamageControls, attributeEffectControls]) {
    assert.equal(
      controls(hidden).some((control) => control.key === 'revealed'),
      false
    );
    assert.equal(
      controls(hidden).some((control) => control.key === 'stealth'),
      true
    );
    assert.equal(
      controls(revealed).some((control) => control.key === 'revealed'),
      true
    );
  }
});
