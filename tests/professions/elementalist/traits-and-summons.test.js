import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createNativeApp, runNative, resolvedAndScheduledEvents } from '../../helpers/elementalist-simulation.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { paletteActionSkills } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { applyElementalistBuildAttributeRules } from '#gw2/professions/elementalist/build/attributes.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { elementalistCoreModifierRules } from '#gw2/professions/elementalist/core/traits/modifiers.js';
import { weaverModifierRules } from '#gw2/professions/elementalist/specializations/weaver/traits/modifiers.js';

// Attribute assertions use the same calculator composed into the Elementalist adapter.
const calculateAttributes = createCalculateAttributes(applyElementalistBuildAttributeRules);

test('Evoker familiar flip interruption cancels both familiar attacks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 'Zap', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && ['Lightning Blitz', 'Zap'].includes(event.skillName)
    ),
    false
  );
  assert.equal(result.endState.profession.empowered, 1);
});

test("Fox's Fury schedules its bonus hit from cast start", () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ["Fox's Fury"],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === "Fox's Fury");
  const hit = result.events.find((event) => event.type === 'damage' && event.skillName === "Fox's Fury");

  assert.ok(hit.at > action.at);
  assert.ok(hit.at < action.endsAt);
});

test('core damage traits expose their exact resolver modifiers', () => {
  const rules = new Map([...elementalistCoreModifierRules, ...weaverModifierRules].map((rule) => [rule.id, rule]));

  assert.equal(rules.get('elementalist.pyromancers-training').factor, 1.07);
  assert.equal(rules.get('elementalist.serrated-stones').factor, 1.05);
  assert.equal(rules.get('elementalist.stormsoul').factor, 1.07);
  assert.equal(rules.get('elementalist.flow-like-water').factor, 1.1);
  assert.equal(rules.get('elementalist.bolt-to-the-heart').factor, 1.2);
  assert.equal(rules.get('elementalist.bountiful-power').amount, 0.2);
  assert.equal(rules.get('elementalist.zephyrs-speed-critical-chance').amount, 0.05);
  assert.equal(rules.get('elementalist.superior-elements').amount, 0.2);
  assert.equal(rules.get('elementalist.weave-self-fire').amount, 0.2);
  assert.equal(rules.get('elementalist.weave-self-fire').operation, 'damage-additive');
  assert.equal(rules.get('elementalist.weave-self-air').amount, 0.1);
  assert.equal(rules.get('elementalist.elements-of-rage-condition').amount, 0.1);
  assert.equal(rules.get('elementalist.elements-of-rage-condition').operation, 'damage-additive');
  assert.equal(rules.get('elementalist.elements-of-rage-strike').amount, 0.15);
  assert.equal(rules.get('elementalist.persisting-flames').operation, 'damage-additive');
  const inferno = rules.get('elementalist.inferno');
  assert.equal(inferno.target, 'conditionDamage');
  assert.equal(
    inferno.factor(
      { time: 0, query: { statsAt: () => ({ power: 1000, conditionDamage: 1000 }) } },
      'conditionDamage',
      inferno.parameters
    ),
    213.5 / 286
  );

  const { app: core } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Arcane']]
  });

  assert.equal(core.attributeData.attributes['Condition Damage'].traits, 180);
  assert.equal(core.attributeData.attributes.Ferocity.traits, 150);
  assert.equal(core.attributeData.attributes.Concentration.traits, 180);
  assert.equal(core.attributeData.attributes['Critical Chance'].traits, 5);
  assert.equal(core.attributeData.attributes['Burning Duration'].traits, 20);

  const { app: water } = createNativeApp({
    lines: [['Water', '1-1-3'], ['Air'], ['Arcane']]
  });

  assert.equal(water.attributeData.attributes.Vitality.traits, 300);
  const withoutSoothingPower = calculateAttributes(water.build, [], 1, 'Soothing Power');

  assert.equal(withoutSoothingPower.attributes.Vitality.traits, 0);
  assert.equal(
    withoutSoothingPower.activeTraits.some((trait) => trait.name === 'Soothing Power'),
    false
  );

  const { app: tempest } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Tempest']]
  });

  assert.equal(tempest.attributeData.attributes.Concentration.traits, 240);

  const { app: weaver } = createNativeApp({
    lines: [['Fire'], ['Earth'], ['Weaver']]
  });

  assert.equal(weaver.attributeData.attributes.Vitality.traits, 180);

  const persistingFlames = runNative({
    lines: [['Fire', '1-3-1'], ['Air'], ['Tempest']],
    rotation: ['Flame Uprising', 5000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Warhorn']
  });

  assert.equal(
    persistingFlames.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Uprising').length,
    5
  );
});

test('core attunement and aura traits emit named boon and damage payloads', () => {
  const fire = runNative({
    lines: [['Fire', '2-2-2'], ['Air'], ['Arcane', '1-2-2']],
    rotation: ['Conjure Frost Bow', '__drop_bundle', 'Fire Attunement', 'Glyph of Elemental Harmony'],
    startAttunement: 'Air',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Conjure Frost Bow',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const fireAura = fire.events.find((event) => event.type === 'elementalist.aura' && event.source === 'Conjurer');

  assert.equal(fireAura.aura, 'Fire Aura');
  assert.ok(Math.abs(fireAura.duration - 5.32) < 0.001);
  for (const source of ['Sunspot', 'Arcane Prowess', 'Elemental Attunement']) {
    assert.equal(
      fire.events.some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    fire.procSteps.some((step) => step.skill === 'Sunspot'),
    true
  );
  assert.deepEqual(
    fire.events.filter((event) => event.type === 'buff' && event.source === 'Conjurer').map((event) => event.kind),
    ['fury', 'swiftness']
  );

  const earth = runNative({
    lines: [['Earth', '1-2-2'], ['Water'], ['Air']],
    rotation: ['Glyph of Elemental Harmony', 'Earth Attunement', 'Signet of Earth'],
    startAttunement: 'Water',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Signet of Earth',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  for (const source of ["Earth's Embrace", 'Earthen Blast', 'Rock Solid', 'Written in Stone']) {
    assert.equal(
      earth.events.some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    earth.procSteps.some((step) => step.skill === 'Earthen Blast'),
    true
  );

  const strength = runNative({
    lines: [['Earth', '1-1-2'], ['Water'], ['Air']],
    rotation: ['Signet of Earth'],
    startAttunement: 'Earth',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Signet of Earth',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const strengthBleeds = resolvedAndScheduledEvents(strength).filter(
    (event) => event.type === 'condition' && event.source === 'Strength of Stone'
  );

  assert.equal(strengthBleeds.length, 1);
  assert.equal(strengthBleeds[0].stacks, 3);
  assert.equal(strengthBleeds[0].duration, 10);
  assert.equal(
    strength.procSteps.some((step) => step.skill === 'Strength of Stone'),
    true
  );
});

test('core critical-hit and control traits enforce their proc rules', () => {
  const critical = runNative({
    lines: [['Fire'], ['Air', '1-2-3'], ['Arcane', '1-2-1']],
    rotation: ['Updraft', 'Charged Strike', 'Polaric Slash', 'Call Lightning'],
    startAttunement: 'Air'
  });

  for (const source of [
    'Lightning Rod',
    'Elemental Lockdown',
    'Raging Storm',
    'Burning Precision',
    'Arcane Precision'
  ]) {
    assert.equal(
      resolvedAndScheduledEvents(critical).some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    resolvedAndScheduledEvents(critical).some(
      (event) => event.source === 'Lightning Rod' && event.type === 'condition' && event.condition === 'Weakness'
    ),
    true
  );
  for (const proc of ['Arcane Precision', 'Burning Precision', 'Lightning Rod']) {
    assert.equal(
      critical.procSteps.some((step) => step.skill === proc),
      true,
      proc
    );
  }

  const stamina = runNative({
    lines: [['Fire'], ['Air', '1-2-3'], ['Arcane', '2-2-1']],
    rotation: ['Updraft', 'Charged Strike', 'Polaric Slash', 'Call Lightning'],
    startAttunement: 'Air'
  });

  assert.equal(
    resolvedAndScheduledEvents(stamina).some((event) => event.type === 'buff' && event.source === 'Renewing Stamina'),
    true
  );
});

test('Tempest traits enforce overload dwell, auras, boons, and damage windows', () => {
  const offensive = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: [1000, 'Fire Attunement', 'Overload Fire'],
    startAttunement: 'Air'
  });
  const attunement = offensive.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = offensive.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');

  assert.ok(Math.abs(overload.at - attunement.at - 3.2) < 0.001);
  for (const source of ['Hardy Conduit', 'Harmonious Conduit', 'Unstable Conduit', 'Transcendent Tempest']) {
    assert.equal(
      offensive.events.some((event) => event.source === source),
      true,
      source
    );
  }

  const auraSupport = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-3-3']],
    rotation: ['Overload Fire'],
    startAttunement: 'Fire'
  });

  for (const kind of ['vigor', 'regeneration', 'alacrity']) {
    assert.equal(
      auraSupport.events.some((event) => event.type === 'buff' && event.kind === kind),
      true,
      kind
    );
  }

  const healingAndShout = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '1-1-1']],
    rotation: [{ name: '__combat_start' }, 'Glyph of Elemental Harmony', 'Aftershock!'],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Aftershock!',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.equal(
    healingAndShout.events.some((event) => event.source === 'Gale Song'),
    true
  );
  assert.equal(
    healingAndShout.procSteps.some((step) => step.skill === 'Tempestuous Aria'),
    true
  );

  const latent = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '2-1-1']],
    rotation: ['Water Attunement'],
    startAttunement: 'Fire'
  });

  assert.equal(
    latent.events.some((event) => event.source === 'Latent Stamina'),
    true
  );
});

test('Weaver traits enforce dual-attunement, boon, modifier, and recharge rules', () => {
  const dual = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-2-1']],
    rotation: ['Air Attunement', 'Pyro Vortex', 'Air Attunement'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.equal(
    dual.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Pyro Vortex' && event.condition === 'Weakness'
    ),
    true
  );
  assert.deepEqual(
    dual.events
      .filter(
        (event) =>
          event.type === 'buff' && event.source === 'Pyro Vortex' && ['might', 'swiftness'].includes(event.kind)
      )
      .map((event) => event.kind),
    ['might', 'swiftness']
  );
  assert.equal(
    dual.events.some((event) => event.kind === 'elements of rage'),
    true
  );

  const flow = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-3']],
    rotation: ['Water Attunement', 'Air Attunement'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.deepEqual(
    flow.steps.filter((step) => String(step.skill).endsWith(' Attunement')).map((step) => step.start),
    [0, 3000]
  );

  const flowDualAttack = runNative({
    lines: [['Fire'], ['Earth'], ['Weaver', '1-1-3']],
    rotation: ['Molten Meteor'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Earth',
    weapons: ['Pistol', 'Dagger'],
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const moltenMeteor = flowDualAttack.events.find(
    (event) => event.type === 'action' && event.skillName === 'Molten Meteor'
  );

  assert.ok(Math.abs(moltenMeteor.rechargeReadyAt - moltenMeteor.endsAt - 9.6) < 1e-9);

  const pursuit = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '2-3-1']],
    rotation: ['Updraft', 'Primordial Stance (Air)'],
    startAttunement: 'Air',
    secondaryAttunement: 'Air',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Air)',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });

  assert.equal(
    pursuit.events.some((event) => event.source === 'Elemental Pursuit'),
    true
  );
  assert.equal(
    pursuit.events.some((event) => String(event.source).startsWith('Primordial Stance') && event.kind === 'protection'),
    true
  );
});

test('Elemental Polyphony applies both active Weaver attunement bonuses', () => {
  const common = {
    lines: [['Fire'], ['Earth'], ['Weaver', '1-1-3']],
    rotation: ['Flame Uprising', 3000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Warhorn']
  };
  const fireFire = runNative({
    ...common,
    secondaryAttunement: 'Fire'
  });
  const fireEarth = runNative({
    ...common,
    secondaryAttunement: 'Earth'
  });
  const strike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Flame Uprising').damage;
  const burning = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Flame Uprising' && event.condition === 'Burning'
    ).damage;

  assert.equal(strike(fireEarth), strike(fireFire));
  assert.ok(burning(fireEarth) > burning(fireFire));
});

test('Catalyst traits enforce energy, empowerment, aura, and sphere rules', () => {
  const sphere = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '3-3-3']],
    rotation: ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000, 'Air Attunement'],
    initialCatalystEnergy: 30
  });

  assert.equal(
    sphere.events.some((event) => event.type === 'resource' && event.source === 'Energized Elements'),
    true
  );
  assert.equal(
    resolvedAndScheduledEvents(sphere).some(
      (event) => event.type === 'elementalist.aura' && event.source === 'Elemental Epitome'
    ),
    true
  );
  assert.equal(
    sphere.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Deploy Jade Sphere (Fire)' &&
        event.kind === 'quickness' &&
        event.duration >= 2
    ),
    true
  );

  const control = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '2-1-1']],
    rotation: ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000, 'Air Attunement', 'Updraft'],
    initialCatalystEnergy: 30
  });

  for (const source of ['Elemental Synergy', 'Elemental Epitome']) {
    assert.equal(
      control.procSteps.some((step) => step.skill === source),
      true,
      source
    );
  }

  assert.equal(
    control.procSteps.some((step) => step.skill === 'Vicious Empowerment'),
    true
  );
  assert.equal(
    control.procSteps.some((step) => step.skill === 'Empowering Auras'),
    true
  );
});

test('Evoker traits enforce familiar boons, enchantments, and charge rules', () => {
  const offensive = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Zap', 'Charged Strike', 'Polaric Slash', 3000],
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });

  assert.equal(
    offensive.events.some((event) => event.source === "Familiar's Prowess"),
    true
  );
  assert.equal(
    offensive.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Electric Enchantment')
      .length,
    2
  );
  assert.equal(offensive.endState.profession.maximumCharges, 6);

  const boons = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '2-2-2']],
    rotation: ['Zap', "Fox's Fury"],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.equal(
    boons.events.some((event) => event.type === 'buff' && event.source === "Familiar's Blessing"),
    true
  );
  assert.equal(
    boons.events.some(
      (event) => event.type === 'buff' && event.source === "Fox's Fury" && event.kind === 'might' && event.stacks === 3
    ),
    true
  );

  const dynamo = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-3-1']],
    rotation: ['Air Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air',
    initialEvokerCharges: 0
  });

  assert.equal(
    dynamo.events.some((event) => event.type === 'resource' && event.source === 'Elemental Dynamo'),
    true
  );
});

test('Fire Elemental autonomously alternates Flame Burst and Fireball', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 15000],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false
    }
  });
  const elementalActions = result.events.filter(
    (event) => event.type === 'action' && event.actorType === 'summon' && event.at < 16
  );
  const flameBurst = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Burst');
  const fireball = result.events.find((event) => event.type === 'damage' && event.skillName === 'Fireball');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    elementalActions.map((event) => [event.skillName, Math.round(event.at * 1000), Boolean(event.interrupted)]),
    [
      ['Flame Burst', 1410, false],
      ['Fireball', 6050, false],
      ['Fireball', 9250, false],
      ['Fireball', 12450, false],
      ['Fireball', 15650, false]
    ]
  );

  assert.equal(
    result.events.some((event) => event.skillName === 'Flame Barrage'),
    false
  );
  assert.equal(
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Fireball' && event.at < 16).length,
    3
  );
  // Autonomous fire attacks retain their documented bases and may scale with the elemental's Might/modifiers.
  assert.equal(flameBurst.summonDamagePerCoefficient, 1150);
  assert.equal(fireball.summonDamagePerCoefficient, 830);
  assert.notEqual(flameBurst.summonUsesMight, false);
  assert.notEqual(fireball.summonUsesEquipmentModifiers, false);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], Infinity);
  assert.equal(result.endState.cooldowns['Glyph of Elementals'], undefined);
});

test('Flame Barrage replaces the active Glyph and obeys rotation timing', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 1000, 'Flame Barrage', 'Flame Barrage', 4000],
    startAttunement: 'Air',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false,
      alacrity: false
    }
  });
  const elementalActions = result.events.filter((event) => event.type === 'action' && event.actorType === 'summon');

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.summonedElemental.element, 'Fire');
  assert.deepEqual(
    elementalActions.filter((event) => event.skillName === 'Flame Barrage').map((event) => Math.round(event.at * 1000)),
    [2250, 17250]
  );
  assert.ok(
    elementalActions.some(
      (event) => event.skillName === 'Flame Burst' && Math.round(event.at * 1000) === 1410 && event.interrupted === true
    )
  );
  assert.ok(
    elementalActions
      .filter((event) => event.skillName === 'Flame Barrage')
      .every((event) => event.playerCommandedElementalSkill === true && event.autonomousElementalSkill === false)
  );

  const firstBarrageDamage = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.at < 5
  );

  assert.deepEqual(
    firstBarrageDamage.map((event) => Math.round(event.at * 1000)),
    [3370, 3570, 3770, 3770]
  );
  assert.ok(firstBarrageDamage.every((event) => event.actorType === 'summon'));

  const firstBarrageBurns = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Flame Barrage' && event.at < 5
  );

  assert.equal(firstBarrageBurns.length, 1);
  assert.ok(
    firstBarrageBurns.every(
      (event) =>
        event.actorType === 'player' && event.condition === 'Burning' && event.stacks === 3 && event.duration === 3
    )
  );

  assert.deepEqual(
    firstBarrageDamage.map((event) => event.coefficient),
    [0.15, 0.15, 0.15, 1.8]
  );
  assert.ok(
    firstBarrageDamage.every(
      (event) =>
        event.summonDamagePerCoefficient === 2500 &&
        event.summonUsesMight === false &&
        event.summonUsesEquipmentModifiers === false
    )
  );

  const resolvedBarrages = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.hitIndex === 1
  );

  assert.equal(resolvedBarrages.length, 2);
  assert.equal(resolvedBarrages[0].damage, resolvedBarrages[1].damage);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], Infinity);

  const armedResult = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 1000],
    startAttunement: 'Air'
  });
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Arcane', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: armedResult
  };
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.doesNotMatch(palette.innerHTML, /data-skill="Glyph of Elementals"/);
  assert.match(palette.innerHTML, /class="pal-skill" data-skill="Flame Barrage"[\s\S]*?draggable="true"/);
  assert.equal(
    elementalistCatalog.skillsByName.get('Flame Barrage').icon,
    'https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png'
  );
  assert.match(palette.innerHTML, /64A5054179704B60614F90964DE1FB3D39AEC972/);
  assert.doesNotMatch(palette.innerHTML, /011D983FEAFB946EF0F45E7F290838CFA31D63D0/);
});

test('selected Earth Elemental auto-summons, attacks, and executes Stomp', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '2-1-1']],
    rotation: ['Stomp', 'Stomp', 9000],
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Elite: 'Glyph of Elementals (Earth)'
    },
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false,
      alacrity: false
    }
  });
  const summonActions = result.events.filter((event) => event.type === 'action' && event.actorType === 'summon');
  const stompDamage = result.events.find((event) => event.type === 'damage' && event.skillName === 'Stomp');
  const immobilize = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Stomp' && event.condition === 'Immobilized'
  );
  const cripple = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Stomp' && event.condition === 'Crippled'
  );
  const protection = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Stomp' && event.kind === 'protection'
  );
  const weakness = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Enervating Punch' && event.condition === 'Weakness'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.summonedElemental.element, 'Earth');
  assert.equal(
    result.events.some((event) => event.type === 'action' && String(event.skillName).startsWith('Glyph of Elementals')),
    false
  );
  assert.deepEqual(
    summonActions.slice(0, 4).map((event) => event.skillName),
    ['Stomp', 'Enervating Punch', 'Punch', 'Punch']
  );
  assert.equal(stompDamage.source, 'Earth Elemental');
  assert.equal(stompDamage.actorType, 'summon');
  assert.equal(Math.round(stompDamage.at * 1000), 1560);
  assert.deepEqual(
    summonActions.filter((event) => event.skillName === 'Stomp').map((event) => Math.round(event.at * 1000)),
    [0, 18000]
  );
  assert.equal(cripple.condition, 'Crippled');
  assert.equal(cripple.duration, 5);
  assert.equal(immobilize.condition, 'Immobilized');
  assert.equal(immobilize.duration, 1);
  assert.equal(immobilize.actorType, 'player');
  assert.equal(immobilize.elementalOwnedCondition, true);
  assert.equal(protection.duration, 3);
  assert.equal(protection.audience.recipients, 'party');
  assert.equal(protection.audience.maximumRecipients, 5);
  assert.equal(weakness.duration, 3);
  assert.equal(weakness.actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Vicious Empowerment' && step.sourceSkill === 'Stomp'),
    true
  );
  assert.equal(result.endState.profession.availableFlips.Stomp, Infinity);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], undefined);
});

test('Elementalist small-hitbox caps exclude only excess multi-hit packets', () => {
  const cases = [
    {
      skill: 'Meteor Shower',
      small: 12,
      large: 24,
      weapons: ['Staff', ''],
      startAttunement: 'Fire'
    },
    {
      skill: 'Lightning Orb',
      small: 11,
      large: 20,
      weapons: ['Scepter', 'Warhorn'],
      startAttunement: 'Air'
    },
    {
      skill: 'Frost Storm',
      small: 14,
      large: 24,
      rotationPrefix: ['Conjure Frost Bow'],
      selectedSkill: 'Conjure Frost Bow',
      startAttunement: 'Water'
    },
    {
      skill: 'Invoke Lightning',
      small: 9,
      large: 20,
      rotationPrefix: ['Conjure Lightning Hammer'],
      selectedSkill: 'Conjure Lightning Hammer',
      startAttunement: 'Air'
    },
    {
      skill: 'Glyph of Storms (Air)',
      small: 20,
      large: 36,
      selectedSkill: 'Glyph of Storms (Air)',
      startAttunement: 'Air'
    },
    {
      skill: 'Glyph of Storms (Water)',
      small: 11,
      large: 18,
      selectedSkill: 'Glyph of Storms (Water)',
      startAttunement: 'Water'
    },
    {
      skill: 'Dust Storm',
      small: 6,
      large: 8,
      weapons: ['Scepter', 'Warhorn'],
      startAttunement: 'Earth'
    },
    {
      skill: 'Fiery Whirl',
      small: 4,
      large: 8,
      rotationPrefix: ['Conjure Fiery Greatsword'],
      selectedSkill: 'Conjure Fiery Greatsword',
      selectedSlot: 'Elite',
      startAttunement: 'Fire'
    }
  ];

  for (const hitboxSize of ['small', 'large']) {
    for (const entry of cases) {
      const selectedSkills = {
        ...elementalistProfession.createBuildDefaults().selectedSkills,
        ...(entry.selectedSkill ? { [entry.selectedSlot || 'Utility1']: entry.selectedSkill } : {})
      };
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Arcane']],
        rotation: [...(entry.rotationPrefix || []), entry.skill, 20000],
        startAttunement: entry.startAttunement,
        weapons: entry.weapons || ['Sword', 'Dagger'],
        selectedSkills,
        assumptions: {
          ...elementalistProfession.createBuildDefaults().assumptions,
          hitboxSize,
          quickness: false
        }
      });
      const strikes = result.events.filter((event) => event.type === 'damage' && event.skillName === entry.skill);

      assert.equal(strikes.length, entry[hitboxSize], `${entry.skill} on ${hitboxSize}`);
    }
  }
});

test('large Elementalist hitboxes extend Wildfire by two packets', () => {
  const counts = Object.fromEntries(
    ['small', 'large'].map((hitboxSize) => {
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Arcane']],
        rotation: ['Wildfire', 20000],
        startAttunement: 'Fire',
        weapons: ['Scepter', 'Warhorn'],
        assumptions: {
          ...elementalistProfession.createBuildDefaults().assumptions,
          hitboxSize,
          quickness: false
        }
      });

      return [
        hitboxSize,
        result.events.filter((event) => event.type === 'damage' && event.skillName === 'Wildfire').length
      ];
    })
  );

  assert.deepEqual(counts, { small: 9, large: 11 });
});

test('Elementalist actions expose Dodge and contextual conjure controls', () => {
  const selectedSkills = {
    Heal: 'Glyph of Elemental Harmony',
    Utility1: 'Conjure Frost Bow',
    Utility2: 'Signet of Fire',
    Utility3: 'Arcane Wave',
    Elite: 'Glyph of Elementals'
  };
  const { app } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Arcane']],
    selectedSkills
  });

  Object.assign(app, {
    skills: elementalistCatalog.skills,
    weaponData: elementalistAppAdapter.weaponData
  });

  assert.deepEqual(
    paletteActionSkills(app).map((skill) => skill.name),
    ['Dodge']
  );

  const renderResult = (result) => {
    app.results = result;
    const palette = { innerHTML: '', querySelectorAll: () => [] };
    const previousDocument = globalThis.document;

    globalThis.document = {
      getElementById: (id) => (id === 'rotation-palette' ? palette : null)
    };
    try {
      renderPalette(app);
    } finally {
      globalThis.document = previousDocument;
    }

    return palette.innerHTML;
  };

  const initialHtml = renderResult(null);

  assert.match(initialHtml, /data-skill="Dodge"/);
  assert.doesNotMatch(initialHtml, /data-skill="__drop_bundle"/);
  assert.doesNotMatch(initialHtml, /data-skill="__pickup_/);

  const equippedHtml = renderResult(
    runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      rotation: ['Conjure Frost Bow'],
      selectedSkills
    })
  );

  assert.match(equippedHtml, /data-skill="Frost Volley"/);
  assert.match(equippedHtml, /data-skill="__drop_bundle"/);
  assert.doesNotMatch(equippedHtml, /data-skill="__pickup_/);
  assert.doesNotMatch(equippedHtml, /data-skill="Flame Uprising"/);

  const pickupHtml = renderResult(
    runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      rotation: ['Conjure Frost Bow', '__drop_bundle'],
      selectedSkills
    })
  );

  assert.match(pickupHtml, /data-skill="__pickup_Frost Bow"/);
  assert.doesNotMatch(pickupHtml, /data-skill="__drop_bundle"/);
  assert.match(pickupHtml, /data-skill="Flame Uprising"/);
});
