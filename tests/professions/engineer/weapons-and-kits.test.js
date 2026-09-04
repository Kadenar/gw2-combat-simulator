import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { selectableSkillBarGroups } from '#gw2/app/build/panels/skills.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/timelines.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createProfessionSimulator(engineerProfession, baseConfig);

test('Mechanist commands are selected by traits and mech attacks persist', () => {
  const result = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_BARRIER_ENGINE
    ]
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.profession.mech.commandSkillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Spark Revolver', 'Crisis Zone', 'Barrier Burst']
  );
  assert.ok(
    result.resolvedEvents.some((event) => event.skillName === 'Jade Energy Shot' && event.actorType === 'summon')
  );
});

test('Mechanist commands use a serial mech lane without reserving the engineer lane', () => {
  const result = simulate('Mechanist', ['Refraction Cutter', 'Spark Revolver', 'Radiant Arc', 'Core Reactor Shot'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ]
  });
  const refraction = result.steps.find((step) => step.skill === 'Refraction Cutter');
  const spark = result.steps.find((step) => step.skill === 'Spark Revolver');
  const radiant = result.steps.find((step) => step.skill === 'Radiant Arc');
  const reactor = result.steps.find((step) => step.skill === 'Core Reactor Shot');

  // The engineer advances after its own cast while the second mech command
  // waits for the first command's independent animation to finish.
  assert.deepEqual(result.warnings, []);
  assert.equal(spark.start, refraction.start);
  assert.equal(radiant.start, refraction.end);
  assert.ok(radiant.start < spark.end);
  assert.equal(reactor.start, spark.end);

  const instant = simulate('Mechanist', ['Spark Revolver', 'Crisis Zone'], {
    selectedTraitIds: [TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_FRAME_CHANNELING_CONDUITS, TRAIT.MECH_CORE_JADE_DYNAMO]
  }).steps;

  assert.equal(instant[1].start, instant[0].start);
  assert.equal(instant[1].start, instant[1].end);
});

test('Amalgam exposes only persisted F2-F4 morph choices', () => {
  const selected = simulate('Amalgam', [77103], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.equal(selected.warnings.length, 0);
  assert.ok(selected.totalDamage > 0);

  const denied = simulate('Amalgam', [76568], {
    selectedMorphSkillIds: [77103, 77203, 76954]
  });

  assert.match(denied.warnings[0], /another morph is selected/);

  const groups = engineerProfession.ui.skillBarGroups({
    specialization: 'Amalgam',
    build: {
      selectedSkills: {
        Heal: 'Healing Turret'
      },
      selectedMorphSkillIds: [77103, 77203, 76954]
    }
  });

  assert.deepEqual(
    groups.map((group) => group.label),
    ['F Skills', 'Shred', 'Protect', 'Demolish']
  );
  assert.deepEqual(
    groups[0].skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Regenerating Mist', 'Evolve']
  );
  const protocolGroups = groups.slice(1);
  const protocolSelections = protocolGroups.flatMap((group) => group.selections);

  assert.deepEqual(
    protocolSelections.map((selection) => engineerCatalog.skillsById.get(selection.skillId).name),
    ['Offensive Protocol: Shred', 'Defensive Protocol: Protect', 'Offensive Protocol: Demolish']
  );
  assert.ok(protocolGroups.every((group) => group.layout === 'engineer-amalgam-protocols'));
  assert.ok(protocolSelections.every((selection) => !selection.keyLabel && !selection.typeLabel));
  assert.ok(
    protocolSelections.every(
      (selection) => selection.selectionKey === 'selectedMorphSkillIds' && selection.optionSkillIds.length === 7
    )
  );
  assert.deepEqual(
    selectableSkillBarGroups('engineer', groups).map((group) => group.id),
    [
      'engineer-amalgam-protocol-2-selection',
      'engineer-amalgam-protocol-3-selection',
      'engineer-amalgam-protocol-4-selection'
    ]
  );
});

test('Amalgam protocol selection swaps conflicting protocol names', () => {
  const build = {
    selectedMorphSkillIds: [77103, 77203, 76954]
  };
  const select = (index, skillId) =>
    engineerProfession.ui.updateSkillBarSelection(
      { specialization: 'Amalgam', build },
      {
        key: 'selectedMorphSkillIds',
        index,
        skillId
      }
    );

  assert.equal(select(0, 76959), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76866, 76954]);
  assert.deepEqual(
    build.selectedMorphSkillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ['Defensive Protocol: Protect', 'Offensive Protocol: Shred', 'Offensive Protocol: Demolish']
  );

  assert.equal(select(1, 76693), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76693, 76568]);
  assert.equal(new Set(build.selectedMorphSkillIds.map((id) => engineerCatalog.skillsById.get(id).name)).size, 3);
});

describe('Engineer packet profiles', () => {
  const mechanic = (name) => engineerCatalog.skillsByName.get(name);

  test('weapon kits retain their authored cadence and packets', () => {
    assert.deepEqual(
      ['Shrapnel Grenade', 'Poison Grenade', 'Freeze Grenade'].map((name) => mechanic(name).quicknessCastTimeMs),
      [680, 680, 680]
    );
    assert.equal(mechanic('Flame Jet').castTimeMs, 2570);
    assert.equal(strikeEffectCoefficient(mechanic('Flame Jet').effects[0]), 2.5);
    assert.equal(
      mechanic('Napalm').effects[0].ticks.reduce((total, packet) => total + packet.coefficient, 0),
      5
    );
    assert.equal(mechanic('Napalm').quicknessCastTimeMs, 1760);
    assert.equal(mechanic('Napalm').cooldown, 25);
    assert.equal(mechanic('Napalm').interruptMode, 'per-packet');
    assert.deepEqual(
      mechanic('Napalm').effects[0].ticks.map((packet) => packet.atMs),
      [280, 441, 560, 679, 842, 955, 1077, 1240, 1361, 1482]
    );
    assert.deepEqual(
      mechanic('Napalm').effects[1].ticks.map((packet) => packet.atMs),
      mechanic('Napalm').effects[0].ticks.map((packet) => packet.atMs)
    );
    assert.deepEqual([mechanic('Flame Blast').cooldown, mechanic('Flame Blast').quicknessCastTimeMs], [6, 800]);
    assert.equal(mechanic('Flame Blast').effects[0].damageKind, 'explosion');
  });

  test('pistol and Holosmith packets retain their authored mechanics', () => {
    assert.deepEqual(
      [
        'Fragmentation Shot',
        'Poison Dart Volley',
        'Static Shot',
        'Glue Shot',
        'Blowtorch',
        'Prime Light Beam',
        'Corona Burst',
        'Photon Blitz'
      ].map((name) => [name, mechanic(name).quicknessCastTimeMs]),
      [
        ['Fragmentation Shot', 520],
        ['Poison Dart Volley', 840],
        ['Static Shot', 320],
        ['Glue Shot', 560],
        ['Blowtorch', 560],
        ['Prime Light Beam', 1160],
        ['Corona Burst', 480],
        ['Photon Blitz', 1320]
      ]
    );
    assert.equal(strikeEffectCoefficient(mechanic('Poison Dart Volley').effects[0]), 2);
    assert.equal(mechanic('Poison Dart Volley').effects[1].ticks.length, 5);
    assert.deepEqual(
      [
        conditionEffectTicks(mechanic('Static Shot').effects[1])[0].stacks,
        conditionEffectTicks(mechanic('Static Shot').effects[1])[0].duration
      ],
      [3, 5]
    );
    assert.equal(strikeEffectCoefficient(mechanic('Glue Shot').effects[0]), 2.5);
    assert.equal(strikeEffectCoefficient(mechanic('Blowtorch').effects[0]), 2);
    assert.equal(conditionEffectTicks(mechanic('Blowtorch').effects[1])[0].duration, 4.5);
    assert.deepEqual(
      mechanic('Corona Burst')
        .effects.filter((effect) => effect.type === 'strike')
        .map((effect) => [strikeEffectCoefficient(effect), effect.damageKind]),
      [
        [1.5, 'explosion'],
        [1.5, 'explosion']
      ]
    );
    assert.equal(
      mechanic('Photon Blitz').effects[0].ticks.reduce((total, tick) => total + tick.coefficient, 0),
      5.12
    );
    assert.equal(mechanic('Photon Blitz').effects[0].ticks[0].atMs, 280);
  });

  test('profession mechanics retain cooldown, timing, and classification facts', () => {
    assert.deepEqual(
      ['Laser Disk', 'Photon Wall', 'Launch Wall', 'Prime Light Beam'].map((name) => [
        name,
        mechanic(name).cooldown,
        mechanic(name).quicknessCastTimeMs
      ]),
      [
        ['Laser Disk', 30, 960],
        ['Photon Wall', 25, 400],
        ['Launch Wall', 0.5, 520],
        ['Prime Light Beam', 60, 1160]
      ]
    );
    assert.deepEqual(
      [
        strikeEffectCoefficient(mechanic('Prime Light Beam').effects[0]),
        mechanic('Prime Light Beam').effects[0].damageKind,
        mechanic('Prime Light Beam').effects[2].controlKind,
        mechanic('Prime Light Beam').effects[1].eventType
      ],
      [3, 'explosion', 'launch', 'engineer.prime-light-beam-field']
    );

    for (const name of ['Grenade Barrage', 'Blade Burst', 'Particle Accelerator', 'Static Shock']) {
      assert.equal(mechanic(name).effects[0].weapon, 'Profession mechanic', name);
    }

    assert.equal(mechanic('Grenade Barrage').effects[0].damageKind, 'explosion');
  });

  test('Amalgam skills retain their authored cast timing', () => {
    assert.deepEqual(
      [
        ['Air Blast', 'quicknessCastTimeMs'],
        ['Puncturing Jab', 'quicknessCastTimeMs'],
        ['Rending Strike', 'quicknessCastTimeMs'],
        ['Amplifying Slice', 'quicknessCastTimeMs'],
        ['Lightning Rod', 'castTimeMs'],
        ['Conduit Surge', 'castTimeMs'],
        ['Electric Artillery', 'quicknessCastTimeMs'],
        ['Stoke the Flames', 'quicknessCastTimeMs'],
        ['Evolve', 'quicknessCastTimeMs'],
        ['Devastator', 'castTimeMs']
      ].map(([name, field]) => mechanic(name)[field]),
      [360, 440, 520, 640, 400, 520, 520, 440, 640, 1000]
    );
    for (const name of ['Lightning Rod', 'Conduit Surge', 'Devastator']) {
      assert.equal(mechanic(name).unaffectedByQuickness, true, name);
    }
  });

  test('Shred retains its packet and control profile', () => {
    const shredSkill = mechanic('Offensive Protocol: Shred');
    const shred = shredSkill.effects[0];

    assert.equal(shredSkill.quicknessCastTimeMs, 760);
    assert.deepEqual(
      shred.ticks.map((packet) => packet.coefficient),
      [0.96, 0.96, 0.96]
    );
    assert.deepEqual(
      shred.ticks.map((packet) => packet.atMs),
      [638.4, 684, 729.6]
    );
    assert.equal(conditionEffectTicks(shredSkill.effects[1])[0].condition, 'Immobilized');
    assert.equal(conditionEffectTicks(shredSkill.effects[1])[0].duration, 3);
  });

  test('Demolish and Obliterate retain their packet profiles', () => {
    const demolish = mechanic('Offensive Protocol: Demolish');

    assert.equal(demolish.castTimeMs, 2340);
    assert.equal(demolish.quicknessCastTimeMs, 1000 + 560);
    assert.equal(demolish.rechargeAnchor, 'castStart');
    assert.equal(demolish.rechargeOffsetMs, 1000);
    assert.deepEqual(
      demolish.effects[0].ticks.map((packet) => [packet.atMs, packet.coefficient]),
      [
        [360, 0.9],
        [640, 0.9],
        [920, 0.9]
      ]
    );
    assert.equal(strikeEffectCoefficient(demolish.effects[1]), 2.25);
    assert.equal(effectFirstAtMs(demolish.effects[1]), 1440);
    assert.equal(
      demolish.effects.some((effect) => effect.boon === 'stability'),
      false
    );
    const obliterate = mechanic('Offensive Protocol: Obliterate');

    assert.equal(obliterate.quicknessCastTimeMs, 800);
    assert.equal(strikeEffectCoefficient(obliterate.effects[0]), 2.88);
    assert.equal(effectFirstAtMs(obliterate.effects[0]), 640);
    assert.equal(obliterate.effects[0].timingAnchor, 'castStart');
    assert.equal(conditionEffectTicks(obliterate.effects[1])[0].condition, 'Bleeding');
    assert.equal(conditionEffectTicks(obliterate.effects[1])[0].stacks, 8);
    assert.equal(conditionEffectTicks(obliterate.effects[1])[0].duration, 6);
    assert.equal(effectFirstAtMs(obliterate.effects[1]), 640);
  });

  test('Flux and Plasmatic State retain their multi-phase cadence', () => {
    const flux = mechanic('Flux State');

    assert.equal(flux.quicknessCastTimeMs, 640);
    assert.equal(strikeEffectCoefficient(flux.effects[1]), 9);
    assert.equal(strikeEffectTicks(flux.effects[1]).length, 12);
    assert.deepEqual(
      strikeEffectTicks(flux.effects[1]).map((tick) => tick.atMs),
      Array.from({ length: 12 }, (_, index) => 520 + index * 520)
    );
    assert.equal(flux.effects[2].ticks.length, 12);

    const plasmatic = mechanic('Plasmatic State');

    assert.equal(plasmatic.castTimeMs, 1440);
    assert.equal(plasmatic.quicknessCastTimeMs, 480 + 480);
    assert.equal(plasmatic.rechargeAnchor, 'castStart');
    assert.equal(plasmatic.rechargeOffsetMs, 480);
    assert.equal(
      plasmatic.effects[0].ticks.reduce((sum, packet) => sum + packet.coefficient, 0),
      4.5
    );
    assert.equal(plasmatic.effects[1].ticks.length, 2);
  });

  test('Mechanist commands retain their lane and summon packet facts', () => {
    const spark = mechanic('Spark Revolver').effects[0];

    const mechCommands = engineerCatalog.skills.filter(
      (skill) =>
        skill.specialization === 'Mechanist' && Number(skill.mechanicSlot) >= 1 && Number(skill.mechanicSlot) <= 3
    );

    assert.equal(mechCommands.length, 9);
    assert.equal(
      mechCommands.every((skill) => skill.independentCast === true),
      true
    );
    const instantMechCommands = mechCommands.filter((skill) => skill.castTimeMs === 0);

    assert.deepEqual(
      instantMechCommands.map((skill) => skill.name),
      ['Crisis Zone', 'Discharge Array']
    );
    assert.equal(
      instantMechCommands.every((skill) => skill.independentCastCanOverlap === true),
      true
    );
    assert.equal(
      mechCommands.filter((skill) => skill.castTimeMs > 0).every((skill) => skill.independentCastCanOverlap !== true),
      true
    );
    assert.deepEqual(
      ['Core Reactor Shot', 'Jade Mortar', 'Spark Revolver'].map((name) => mechanic(name).quicknessCastTimeMs),
      [1000, 1080, 1400]
    );
    assert.equal(
      ['Core Reactor Shot', 'Jade Mortar', 'Spark Revolver'].every(
        (name) => mechanic(name).rechargeAnchor === 'castStart'
      ),
      true
    );

    assert.ok(Math.abs(spark.ticks.reduce((sum, packet) => sum + packet.coefficient, 0) - 2.112) < 1e-12);
    assert.equal(spark.ticks.length, 12);
    assert.equal(spark.actorType, 'summon');
  });
});

test('Engineer sword variants have specialization-owned facts and runtime gating', () => {
  const skill = (id) => engineerCatalog.skillsById.get(id);
  const mechanistRuntime = engineerProfession.resolveRuntime({ specialization: 'Mechanist' });
  const holosmithRuntime = engineerProfession.resolveRuntime({ specialization: 'Holosmith' });

  for (const id of [
    ID.SUN_EDGE_ID_70514,
    ID.SUN_RIPPER_ID_69906,
    ID.GLEAM_SABER_ID_70771,
    ID.RADIANT_ARC_ID_69565,
    ID.REFRACTION_CUTTER_ID_71121
  ]) {
    assert.equal(skill(id).specialization, '');
  }

  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER), false);
  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER_ID_70771), true);
  assert.equal(
    holosmithRuntime.ui.weaponSkillMatchesSet(
      holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER_ID_70771),
      ['Sword'],
      { specialization: 'Holosmith' }
    ),
    false
  );
  assert.equal(
    holosmithRuntime.ui.weaponSkillMatchesSet(holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER), ['Sword'], {
      specialization: 'Holosmith'
    }),
    true
  );

  assert.equal(strikeEffectCoefficient(skill(ID.SUN_EDGE).effects[0]), 0.88);
  assert.deepEqual(
    skill(ID.SUN_EDGE)
      .effects.slice(1)
      .flatMap((effect) => conditionEffectTicks(effect).map((tick) => [tick.condition, tick.stacks, tick.duration])),
    [['Vulnerability', 1, 10]]
  );
  assert.equal(strikeEffectCoefficient(skill(ID.SUN_RIPPER).effects[0]), 0.93);
  assert.equal(strikeEffectCoefficient(skill(ID.GLEAM_SABER).effects[0]), 1.5);
  assert.equal(strikeEffectCoefficient(skill(ID.RADIANT_ARC).effects[0]), 2.5);
  assert.equal(skill(ID.RADIANT_ARC).cooldown, 12);
  assert.equal(skill(ID.RADIANT_ARC).comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    skill(ID.RADIANT_ARC)
      .effects.filter((effect) => effect.type === 'condition')
      .flatMap((effect) => conditionEffectTicks(effect).map((tick) => [tick.condition, tick.stacks, tick.duration])),
    [['Crippled', 1, 4]]
  );
  assert.equal(strikeEffectCoefficient(skill(ID.REFRACTION_CUTTER).effects[0]), 1.4);
  assert.equal(strikeEffectCoefficient(skill(ID.REFRACTION_CUTTER).effects[1]), 0.4);
  assert.equal(skill(ID.REFRACTION_CUTTER).effects[1].comboFinishers[0].chance, 1);
  assert.equal(strikeEffectCoefficient(skill(ID.REFRACTION_CUTTER_BLADE).effects[0]), 0.4);

  assert.equal(strikeEffectCoefficient(skill(ID.SUN_EDGE_ID_70514).effects[0]), 0.96);
  assert.equal(strikeEffectCoefficient(skill(ID.SUN_RIPPER_ID_69906).effects[0]), 1.02);
  assert.equal(strikeEffectCoefficient(skill(ID.GLEAM_SABER_ID_70771).effects[0]), 1.65);
  assert.equal(strikeEffectCoefficient(skill(ID.RADIANT_ARC_ID_69565).effects[0]), 2.5);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).cooldown, 14);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    skill(ID.RADIANT_ARC_ID_69565)
      .effects.slice(1)
      .flatMap((effect) =>
        effect.type === 'condition'
          ? conditionEffectTicks(effect).map((tick) => [tick.condition, tick.stacks, tick.duration])
          : [[effect.boon, effect.stacks, effect.duration]]
      ),
    [
      ['Crippled', 1, 4],
      ['quickness', 1, 3]
    ]
  );

  const refraction = skill(ID.REFRACTION_CUTTER_ID_71121);

  assert.equal(refraction.cooldown, 6);
  assert.equal(strikeEffectCoefficient(refraction.effects[0]), 1.4);
  assert.equal(strikeEffectCoefficient(refraction.effects[1]), 0.8);
  assert.equal(strikeEffectTicks(refraction.effects[1]).length, 2);
  assert.equal(refraction.effects[1].comboFinishers[0].chance, 1);
  assert.equal(conditionEffectTicks(refraction.effects[2]).length, 2);

  const replaced = simulate('Holosmith', [{ type: 'cast', skillId: ID.SUN_EDGE_ID_70514 }]);

  assert.match(replaced.warnings[0], /Holosmith replaces this sword skill/);

  const quicknessDurations = [
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 0 }),
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 60 }),
    simulate('Holosmith', ['Radiant Arc'], { initialHeat: 101 }),
    simulate('Holosmith', ['Radiant Arc'], {
      initialHeat: 100,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    }),
    simulate('Holosmith', ['Radiant Arc'], {
      initialHeat: 101,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    })
  ].map(
    (simulation) =>
      simulation.events.find(
        (event) => event.type === 'engineer.radiant-arc-quickness' && event.name === 'Radiant Arc - quickness'
      ).duration
  );

  assert.deepEqual(quicknessDurations, [2, 4, 4, 4, 6]);

  const result = simulate('Mechanist', [
    { type: 'cast', skillId: ID.REFRACTION_CUTTER_ID_71121 },
    { type: 'cast', skillId: ID.SUN_EDGE_ID_70514 },
    { type: 'cast', skillId: ID.SUN_RIPPER_ID_69906 },
    { type: 'cast', skillId: ID.GLEAM_SABER_ID_70771 },
    { type: 'wait', durationMs: 200 }
  ]);
  const blades = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Refraction Cutter Blade'
  );
  const bleeds = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Refraction Cutter' && event.condition === 'Bleeding'
  );

  assert.deepEqual(
    blades.map((event) => event.coefficient),
    [0.4, 0.4]
  );
  assert.ok(blades.every((event) => event.comboFinishers[0].chance === 1));
  assert.equal(bleeds.length, 2);
  assert.ok(bleeds.every((event) => event.stacks === 1 && event.duration === 4));
  const core = simulate(
    'Core',
    [
      { type: 'cast', skillId: ID.REFRACTION_CUTTER_ID_71121 },
      { type: 'cast', skillId: ID.SUN_EDGE_ID_70514 },
      { type: 'cast', skillId: ID.SUN_RIPPER_ID_69906 },
      { type: 'cast', skillId: ID.GLEAM_SABER_ID_70771 },
      { type: 'cast', skillId: ID.RADIANT_ARC_ID_69565 }
    ],
    { primaryWeapon: 'Sword', secondaryWeapon: 'Pistol' }
  );

  assert.deepEqual(core.warnings, []);
  assert.ok(
    result.procSteps.some((step) => step.skill === 'Gleam Saber — Sword Recharge' && step.cooldownReduction === 1)
  );
});

test('Engineer mace packets retain player, explosion, and finisher classifications', () => {
  const result = simulate('Mechanist', ['Mace Strike', 'Mace Smash', 'Mace Blast', 'Rocket Fist Prototype']);

  assert.equal(result.warnings.length, 0);
  const damage = (name) => result.events.find((event) => event.type === 'damage' && event.name === name);
  const smash = damage('Mace Smash');
  const blast = damage('Mace Blast');
  const fist = damage('Rocket Fist Prototype');

  assert.equal(smash.actorType, 'player');
  assert.equal(
    result.events.find((event) => event.type === 'condition' && event.skillName === 'Mace Smash').actorType,
    'player'
  );
  assert.equal(blast.damageKind, 'explosion');
  assert.equal(engineerCatalog.skillsById.get(ID.MACE_BLAST).comboFinishers[0].finisherType, 'Leap');
  assert.equal(fist.damageKind, 'explosion');
  assert.equal(fist.projectile, true);
  assert.equal(fist.comboFinishers[0].finisherType, 'Projectile');
});

test('Mechanist rifle uses live close-range packets and measured cadence', () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);
  const burst = skill('Rifle Burst');

  assert.equal(burst.castTimeMs, 960);
  assert.equal(burst.quicknessCastTimeMs, 640);
  assert.equal(burst.interruptMode, 'per-packet');
  assert.deepEqual(
    burst.effects.map((effect) => [strikeEffectCoefficient(effect), effectFirstAtMs(effect)]),
    [
      [0.6, 320],
      [0.8, 600]
    ]
  );
  assert.equal(burst.effects[0].comboFinishers[0].chance, 0.2);
  assert.equal(burst.effects[1].damageKind, 'explosion');

  const blunderbuss = skill('Blunderbuss');

  assert.equal(blunderbuss.cooldown, 6);
  assert.equal(strikeEffectCoefficient(blunderbuss.effects[0]), 2.2);
  assert.deepEqual(
    blunderbuss.effects
      .flatMap((effect) => (effect.type === 'condition' ? conditionEffectTicks(effect) : []))
      .filter((tick) => tick.condition === 'Bleeding')
      .map((tick) => [tick.stacks, tick.duration]),
    [[3, 9]]
  );

  const net = skill('Net Shot');

  assert.equal(net.cooldown, 9);
  assert.equal(strikeEffectCoefficient(net.effects[0]), 1.25);
  assert.ok(
    net.effects.some(
      (effect) =>
        effect.type === 'condition' &&
        conditionEffectTicks(effect).some((tick) => tick.condition === 'Immobilized' && tick.duration === 4)
    )
  );
  assert.ok(
    net.effects.some(
      (effect) =>
        effect.type === 'condition' &&
        conditionEffectTicks(effect).some(
          (tick) => tick.condition === 'Vulnerability' && tick.stacks === 8 && tick.duration === 8
        )
    )
  );

  const overcharged = skill('Overcharged Shot');

  assert.equal(overcharged.cooldown, 14);
  assert.equal(strikeEffectCoefficient(overcharged.effects[0]), 1);
  assert.equal(overcharged.effects[1].controlKind, 'launch');

  const result = simulate('Mechanist', ['Rifle Burst'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'damage' && ['Rifle Burst', 'Rifle Burst Grenade'].includes(event.name))
      .map((event) => [event.name, event.at, event.coefficient]),
    [
      ['Rifle Burst', 0.32, 0.6],
      ['Rifle Burst Grenade', 0.6, 0.8]
    ]
  );

  const interruptedPackets = (interruptMs) =>
    simulate(
      'Mechanist',
      [
        { name: 'Rifle Burst', interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      { boons: { quickness: true } }
    ).events.filter((event) => event.type === 'damage' && ['Rifle Burst', 'Rifle Burst Grenade'].includes(event.name));

  assert.deepEqual(
    interruptedPackets(319).map((event) => event.name),
    []
  );
  assert.deepEqual(
    interruptedPackets(320).map((event) => event.name),
    ['Rifle Burst']
  );
  assert.deepEqual(
    interruptedPackets(599).map((event) => event.name),
    ['Rifle Burst']
  );
  assert.deepEqual(
    interruptedPackets(600).map((event) => event.name),
    ['Rifle Burst', 'Rifle Burst Grenade']
  );
});

test('Engineer hammer skills use the requested packets and field cadence', () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);

  assert.equal(skill('Positive Strike').quicknessCastTimeMs, 480);
  assert.equal(strikeEffectCoefficient(skill('Positive Strike').effects[0]), 0.7);
  assert.deepEqual(skill('Positive Strike').effects[1], {
    type: 'boon',
    boon: 'might',
    duration: 8,
    stacks: 1,
    atMs: 360,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  });
  assert.equal(skill('Negative Bash').quicknessCastTimeMs, 640);
  assert.equal(strikeEffectCoefficient(skill('Negative Bash').effects[0]), 1);
  assert.equal(skill('Negative Bash').effects[1].ticks[0].duration, 8);
  assert.equal(skill('Equalizing Blow').quicknessCastTimeMs, 440);
  assert.equal(strikeEffectCoefficient(skill('Equalizing Blow').effects[0]), 1.4);
  assert.equal(skill('Equalizing Blow').effects[1].ticks[0].stacks, 3);
  assert.equal(skill('Equalizing Blow').effects[2].stacks, 3);

  const electro = skill('Electro-whirl');

  assert.equal(electro.cooldown, 6);
  assert.equal(strikeEffectCoefficient(electro.effects[0]), 3);
  assert.equal(strikeEffectTicks(electro.effects[0]).length, 2);
  assert.equal(electro.effects[0].damageKind, 'explosion');
  assert.equal(electro.comboFinishers[0].finisherType, 'Whirl');

  const rocket = skill('Rocket Charge');

  assert.equal(rocket.castTimeMs, 1920);
  assert.equal(rocket.quicknessCastTimeMs, undefined);
  assert.equal(rocket.unaffectedByQuickness, true);
  assert.equal(rocket.cooldown, 12);
  assert.deepEqual(rocket.effects[0].ticks, [
    { atMs: 640, coefficient: 1.2 },
    { atMs: 1240, coefficient: 1.2 },
    { atMs: 1920, coefficient: 1.2 }
  ]);

  const hammerTiming = simulate('Core', ['Positive Strike', 'Negative Bash', 'Equalizing Blow', 'Rocket Charge'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    hammerTiming.steps.map((step) => step.end - step.start),
    [480, 640, 440, 1920]
  );
  assert.deepEqual(
    hammerTiming.events
      .filter(
        (event) =>
          event.type === 'damage' &&
          ['Positive Strike', 'Negative Bash', 'Equalizing Blow', 'Rocket Charge'].includes(event.name)
      )
      .map((event) => [event.name, Number(event.at.toFixed(2))]),
    [
      ['Positive Strike', 0.36],
      ['Negative Bash', 0.8],
      ['Equalizing Blow', 1.44],
      ['Rocket Charge', 2.2],
      ['Rocket Charge', 2.8],
      ['Rocket Charge', 3.48]
    ]
  );

  const shield = skill('Shock Shield');

  assert.equal(shield.cooldown, 18);
  assert.equal(shield.blockDuration, 2);
  assert.equal(strikeEffectCoefficient(shield.effects[0]), 1.25);
  assert.equal(strikeEffectTicks(shield.effects[0]).length, 5);
  assert.equal(shield.effects[1].stacks, 10);
  assert.equal(shield.effects[1].duration, 5);

  const thunder = simulate('Core', ['Thunderclap', { type: 'wait', durationMs: 5000 }]);
  const thunderDamage = thunder.events.filter((event) => event.type === 'damage' && event.name === 'Thunderclap');
  const thunderVulnerability = thunder.events.filter(
    (event) => event.type === 'condition' && event.name === 'Thunderclap — Vulnerability'
  );
  const thunderControl = thunder.events.find((event) => event.type === 'control' && event.skillName === 'Thunderclap');

  assert.deepEqual(
    thunderDamage.map((event) => event.at),
    [1.75, 2.75, 3.75, 4.75, 5.75]
  );
  assert.ok(thunderDamage.every((event) => event.coefficient === 0.8));
  assert.equal(thunderVulnerability.length, 5);
  assert.ok(thunderVulnerability.every((event) => event.stacks === 1 && event.duration === 8));
  assert.equal(thunderControl.at, 0.75);
  assert.equal(thunderControl.controlKind, 'stun');
  assert.equal(skill('Thunderclap').comboFields[0].fieldType, 'Lightning');

  const quickThunder = simulate('Core', ['Thunderclap', { type: 'wait', durationMs: 5000 }], {
    boons: { quickness: true }
  });

  assert.equal(quickThunder.steps[0].end, 520);
  assert.deepEqual(
    quickThunder.events
      .filter((event) => event.type === 'damage' && event.name === 'Thunderclap')
      .map((event) => Number(event.at.toFixed(2))),
    [1.52, 2.52, 3.52, 4.52, 5.52]
  );
});

test('Bomb Kit packets honor fuses, explosions, fields, and finishers', () => {
  const selectedSkills = ['Healing Turret', 'Bomb Kit', 'Grenade Kit', 'Elixir Gun', 'Supply Crate'];
  const waitForBombPackets = () => ({ type: 'wait', durationMs: 5000 });
  const bombSkills = engineerCatalog.skills.filter(
    (candidate) => candidate.kit === 'Bomb Kit' && candidate.effects.some((effect) => effect.type === 'strike')
  );

  assert.ok(
    bombSkills.every((candidate) =>
      candidate.effects
        .filter((effect) => effect.type === 'strike')
        .every((effect) => effect.damageKind === 'explosion')
    )
  );

  const bomb = simulate('Core', ['Bomb Kit', 'Bomb', waitForBombPackets()], {
    selectedSkills
  });
  const bombHit = bomb.events.find((event) => event.type === 'damage' && event.name === 'Bomb');

  assert.equal(bombHit.at, 1);
  assert.equal(bombHit.coefficient, 1.2);
  assert.equal(bombHit.damageKind, 'explosion');

  const fire = simulate('Core', ['Bomb Kit', 'Fire Bomb', waitForBombPackets()], { selectedSkills });
  const fireHits = fire.events.filter((event) => event.type === 'damage' && event.name === 'Fire Bomb');
  const fireBurns = fire.events.filter((event) => event.type === 'condition' && event.name === 'Fire Bomb — Burning');

  assert.deepEqual(
    fireHits.map((event) => Number(event.at.toFixed(2))),
    [1.66, 2.66, 3.66, 4.66]
  );
  assert.ok(fireHits.every((event) => event.coefficient === 0.25));
  assert.deepEqual(
    fireBurns.map((event) => [Number(event.at.toFixed(2)), event.stacks, event.duration]),
    [
      [1.66, 2, 5],
      [2.66, 1, 2],
      [3.66, 1, 2],
      [4.66, 1, 2]
    ]
  );
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').quicknessCastTimeMs, 600);
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').interruptCommitMs, 400);
  const interruptedFire = (interruptMs) =>
    simulate('Core', ['Bomb Kit', { name: 'Fire Bomb', interruptMs }, waitForBombPackets()], {
      selectedSkills,
      boons: { quickness: true }
    }).events.filter((event) => event.type === 'damage' && event.name === 'Fire Bomb');

  assert.equal(interruptedFire(399).length, 0);
  assert.equal(interruptedFire(400).length, 4);
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].fieldType, 'Fire');
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].duration, 3);

  const galvanic = simulate('Core', ['Bomb Kit', 'Galvanic Bomb', waitForBombPackets()], { selectedSkills });

  assert.ok(
    galvanic.events.some(
      (event) => event.type === 'damage' && Math.abs(event.at - 1.66) < 1e-12 && event.coefficient === 2.5
    )
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Confusion' && event.stacks === 6 && event.duration === 8
    )
  );
  assert.ok(
    galvanic.events.some((event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 1)
  );
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').comboFinishers[0].finisherType, 'Blast');
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').quicknessCastTimeMs, 600);

  const magnetic = engineerCatalog.skillsByName.get('Magnetic Bomb');

  assert.equal(strikeEffectCoefficient(magnetic.effects[0]), 1.5);
  assert.equal(magnetic.effects[1].controlKind, 'pull');
  assert.equal(magnetic.quicknessCastTimeMs, 600);
  const magneticResult = simulate('Core', ['Bomb Kit', 'Magnetic Bomb', waitForBombPackets()], {
    selectedSkills,
    boons: { quickness: true }
  });

  assert.ok(
    magneticResult.events.some(
      (event) => event.type === 'damage' && event.name === 'Magnetic Bomb' && Math.abs(event.at - 2.36) < 1e-12
    )
  );
  assert.ok(
    magneticResult.events.some(
      (event) => event.type === 'control' && event.skillName === 'Magnetic Bomb' && Math.abs(event.at - 2.36) < 1e-12
    )
  );

  const big = simulate('Core', ['Bomb Kit', "Big Ol' Bomb", waitForBombPackets()], { selectedSkills });

  assert.ok(
    big.events.some((event) => event.type === 'damage' && Math.abs(event.at - 3.66) < 1e-12 && event.coefficient === 3)
  );
  assert.ok(
    big.events.some(
      (event) => event.type === 'control' && Math.abs(event.at - 3.66) < 1e-12 && event.controlKind === 'knockdown'
    )
  );
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").comboFinishers[0].successfulCombos, 2);
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").quicknessCastTimeMs, 600);

  const quickDamageTimes = (name) =>
    simulate('Core', ['Bomb Kit', name, waitForBombPackets()], {
      selectedSkills,
      boons: { quickness: true }
    })
      .events.filter((event) => event.type === 'damage' && event.name === name)
      .map((event) => Number(event.at.toFixed(2)));

  assert.deepEqual(quickDamageTimes('Fire Bomb'), [1.36, 2.36, 3.36, 4.36]);
  assert.deepEqual(quickDamageTimes('Galvanic Bomb'), [1.36]);
  assert.deepEqual(quickDamageTimes('Magnetic Bomb'), [2.36]);
  assert.deepEqual(quickDamageTimes("Big Ol' Bomb"), [3.36]);

  const doubleBlast = simulate(
    'Core',
    [
      'Bomb Kit',
      "Big Ol' Bomb",
      'Fire Bomb',
      'Galvanic Bomb',
      'Stow Bomb Kit',
      'Glue Shot',
      { type: 'wait', durationMs: 5000 }
    ],
    {
      selectedSkills,
      weapons: ['Pistol', 'Pistol'],
      relic: 'Bloodstone'
    }
  );

  assert.ok(
    doubleBlast.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Bloodstone Explosion')
  );
  assert.ok(
    doubleBlast.procSteps.some((step) => step.skill === 'Relic of Bloodstone' && step.sourceSkill === "Big Ol' Bomb")
  );

  const unboundBlasts = simulate(
    'Core',
    ['Bomb Kit', "Big Ol' Bomb", 'Galvanic Bomb', { type: 'wait', durationMs: 5000 }],
    { selectedSkills, relic: 'Bloodstone' }
  );

  assert.equal(
    unboundBlasts.procSteps.some(
      (step) => step.skill === 'Bloodstone Volatility' || step.skill === 'Relic of Bloodstone'
    ),
    false
  );
});

test('Grenade Kit emits three explosive grenade packets', () => {
  const profiles = [
    ['Grenade', 0, 0.33, null],
    ['Shrapnel Grenade', 5, 0.63, 'Bleeding'],
    ['Flash Grenade', 10, 0.1, 'Blind'],
    ['Freeze Grenade', 20, 0.75, 'Chilled'],
    ['Poison Grenade', 20, 0.75, 'Poisoned']
  ];

  for (const [name, cooldown, coefficient, secondary] of profiles) {
    const candidate = engineerCatalog.skillsByName.get(name);
    const strike = candidate.effects.find((effect) => effect.type === 'strike');

    assert.equal(candidate.cooldown, cooldown, name);
    const packetCoefficients = strike.ticks
      ? strike.ticks.map((packet) => packet.coefficient)
      : Array(strike.hits).fill(strike.coefficient / strike.hits);

    assert.equal(packetCoefficients.length, 3, name);
    assert.ok(
      packetCoefficients.every((packetCoefficient) => Math.abs(packetCoefficient - coefficient) < 1e-12),
      name
    );
    assert.equal(strike.damageKind, 'explosion', name);

    if (secondary === 'Blind') {
      assert.equal(candidate.effects.find((effect) => effect.type === 'blind').duration, 5);
    } else if (secondary) {
      assert.ok(
        candidate.effects[1].ticks.every((packet) => packet.condition === secondary),
        name
      );
    }
  }

  const committedGrenades = ['Grenade', 'Shrapnel Grenade', 'Freeze Grenade', 'Poison Grenade'];

  for (const name of committedGrenades) {
    const grenadeSkill = engineerCatalog.skillsByName.get(name);

    assert.equal(grenadeSkill.interruptCommitMs, 360, name);
    assert.ok(
      grenadeSkill.effects.every((effect) => effect.persistsAfterInterrupt === true),
      name
    );

    const interruptedPackets = (interruptMs) =>
      simulate('Core', ['Grenade Kit', { name, interruptMs }, { type: 'wait', durationMs: 1000 }]).events.filter(
        (event) => event.type === 'damage' && event.name === name
      );

    assert.equal(interruptedPackets(359).length, 0, name);
    assert.equal(interruptedPackets(360).length, 3, name);
  }

  const shrapnel = engineerCatalog.skillsByName.get('Shrapnel Grenade');

  assert.equal(shrapnel.comboFinishers, undefined);
  for (const name of ['Poison Grenade', 'Freeze Grenade']) {
    assert.equal(engineerCatalog.skillsByName.get(name).comboFinishers, undefined, name);
  }

  assert.equal(
    shrapnel.effects[1].ticks.reduce((total, packet) => total + packet.stacks, 0),
    3
  );
  assert.ok(shrapnel.effects[1].ticks.every((packet) => packet.duration === 7));

  const result = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade']);
  const packets = result.events.filter((event) => event.type === 'damage' && event.name === 'Shrapnel Grenade');

  assert.equal(packets.length, 3);
  assert.ok(packets.every((event) => Math.abs(event.coefficient - 0.63) < 1e-12 && event.damageKind === 'explosion'));
  assert.deepEqual(
    packets.map((event) => event.at),
    [0.4, 0.44, 0.44]
  );
  const bleeding = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel Grenade'
  );

  assert.deepEqual(
    bleeding.map((event) => [event.at, event.stacks, event.duration]),
    [
      [0.4, 1, 7],
      [0.44, 1, 7],
      [0.44, 1, 7]
    ]
  );

  const grenade = simulate('Core', ['Grenade Kit', 'Grenade']);

  assert.deepEqual(
    grenade.events
      .filter((event) => event.type === 'damage' && event.name === 'Grenade')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.4, 0.33],
      [0.44, 0.33],
      [0.44, 0.33]
    ]
  );
});

test('Shred fires three Burning Bolts through Stoke the Flames', () => {
  const stoke = engineerCatalog.skillsByName.get('Stoke the Flames');
  const shred = engineerCatalog.skillsById.get(77103);

  assert.equal(stoke.comboFields[0].fieldType, 'Fire');
  assert.equal(stoke.comboFields[0].duration, 1);
  assert.equal(shred.comboFinishers[0].finisherType, 'Projectile');
  assert.equal(shred.comboFinishers[0].chance, 1);

  const config = {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  };
  const result = simulate(
    'Amalgam',
    ['Flamethrower', 'Stoke the Flames', { name: 'Offensive Protocol: Shred', skillId: 77103 }],
    config
  );
  const combos = result.resolvedEvents.filter(
    (event) =>
      event.type === 'combo' &&
      event.skillName === 'Offensive Protocol: Shred' &&
      event.fieldType === 'Fire' &&
      event.finisherType === 'Projectile'
  );

  assert.equal(combos.length, 3);
  assert.ok(
    combos.every(
      (event) => event.outcome.condition === 'Burning' && event.outcome.stacks === 1 && event.outcome.duration === 1
    )
  );

  const withoutField = simulate('Amalgam', [{ name: 'Offensive Protocol: Shred', skillId: 77103 }], config);

  assert.equal(
    withoutField.resolvedEvents.some(
      (event) => event.type === 'combo' && event.skillName === 'Offensive Protocol: Shred'
    ),
    false
  );
});

test('measured Quickness animations and Flame Blast commitment drive steps', () => {
  const grenades = simulate(
    'Amalgam',
    ['Grenade Kit', { name: 'Shrapnel Grenade', interruptAfterMs: 360 }, 'Freeze Grenade'],
    {
      boons: { quickness: true },
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );
  const shrapnel = grenades.steps.find((step) => step.skill === 'Shrapnel Grenade');
  const freeze = grenades.steps.find((step) => step.skill === 'Freeze Grenade');

  // The grenade launches at its commit point, while the next serial action remains locked to the full throw animation.
  assert.equal(shrapnel.end - shrapnel.start, 360);
  assert.equal(freeze.start - shrapnel.start, 680);

  const flamethrower = simulate(
    'Amalgam',
    ['Flamethrower', { name: 'Flame Blast', interruptAfterMs: 480 }, 'Flame Jet'],
    {
      boons: { quickness: true },
      selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate'],
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );
  const flameBlast = flamethrower.steps.find((step) => step.skill === 'Flame Blast');
  const flameJet = flamethrower.steps.find((step) => step.skill === 'Flame Jet');
  const flameBlastAction = flamethrower.events.find(
    (event) => event.type === 'action' && event.skillName === 'Flame Blast'
  );
  const flameBlastDamage = flamethrower.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Flame Blast'
  );

  // The packet and recharge commit at 480 ms, but the next serial cast remains locked to the full 800 ms animation.
  assert.equal(flameBlast.end - flameBlast.start, 480);
  assert.equal(flameBlast.fullCastMs, 800);
  assert.equal(flameBlast.interrupted, true);
  assert.equal(flameJet.start - flameBlast.start, 800);
  assert.equal(flameBlastAction.rechargeReadyAt, 6.48);
  assert.equal(flameBlastDamage.at - flameBlast.start / 1000, 0.48);
  assert.equal(
    flamethrower.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Flame Blast').length,
    1
  );

  const full = simulate('Amalgam', ['Flamethrower', 'Flame Blast'], {
    boons: { quickness: true },
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const fullFlameBlast = full.steps.find((step) => step.skill === 'Flame Blast');

  assert.equal(fullFlameBlast.end - fullFlameBlast.start, 800);
  assert.equal(fullFlameBlast.interrupted, false);

  const demolish = simulate('Amalgam', [76927], {
    boons: { quickness: true },
    selectedMorphSkillIds: [76927, 77104, 76705]
  });
  const demolishStep = demolish.steps.find((step) => step.skill === 'Offensive Protocol: Demolish');

  assert.equal(demolishStep.end - demolishStep.start, 1000 + 560);
  const smash = demolish.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Smash Damage');

  assert.equal(Math.round((smash.at - demolishStep.start / 1000) * 1000), 1440);
});

test('Flame Jet gains ten percent strike damage against burning targets', () => {
  const config = {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Flamethrower', 'Elixir Gun', 'Supply Crate'],
    selectedMorphSkillIds: [77103, 77104, 76705]
  };
  const withoutBurning = simulate('Amalgam', ['Flamethrower', 'Flame Jet'], {
    ...config,
    target: { conditions: { Vulnerability: 25 } }
  });
  const withBurning = simulate('Amalgam', ['Flamethrower', 'Flame Jet'], {
    ...config,
    target: { conditions: { Vulnerability: 25, Burning: 1 } }
  });
  const firstPacket = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Flame Jet');

  assert.ok(Math.abs(firstPacket(withBurning).damage / firstPacket(withoutBurning).damage - 1.1) < 1e-12);
});

test('Engineer spear focus selects one branch and Lightning Rod pulses eight times', () => {
  const focused = simulate(
    'Amalgam',
    ['Conduit Surge', 'Lightning Rod', 'Electric Artillery', { type: 'wait', durationMs: 4000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705]
    }
  );

  assert.equal(focused.warnings.length, 0);
  const lightning = focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Lightning Rod');

  assert.equal(lightning.length, 8);
  assert.ok(lightning.every((event) => event.coefficient === 0.3));
  assert.deepEqual(
    lightning.slice(1).map((event, index) => Number((event.at - lightning[index].at).toFixed(3))),
    Array(7).fill(0.5)
  );
  const rodStep = focused.steps.find((step) => step.skill === 'Lightning Rod');
  const artilleryStep = focused.steps.find((step) => step.skill === 'Electric Artillery');

  assert.equal(artilleryStep.start - rodStep.start, 4200);
  assert.equal(focused.events.find((event) => event.type === 'engineer.electric-artillery').charges, 8);
  const immobilize = focused.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Lightning Rod' && event.condition === 'Immobilized'
  );

  assert.equal(immobilize.length, 1);
  assert.equal(immobilize[0].duration, 2);
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Conduit Surge').length,
    1
  );
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Electric Artillery').length,
    1
  );
  const artilleryBurn = focused.resolvedEvents.find(
    (event) => event.type === 'condition' && event.name === 'Electric Artillery — Burning'
  );

  assert.equal(artilleryBurn.stacks, 2);
  assert.equal(artilleryBurn.duration, 7);

  const unfocused = simulate('Amalgam', ['Lightning Rod', 'Electric Artillery'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const unfocusedHits = unfocused.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Lightning Rod'
  );

  assert.equal(unfocusedHits.length, 8);
  assert.ok(unfocusedHits.every((event) => event.coefficient === 0.17));
  assert.equal(
    unfocused.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Electric Artillery')
      .coefficient,
    1
  );
  assert.equal(
    unfocused.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Electric Artillery' && event.condition === 'Burning'
    ).duration,
    5
  );
  assert.deepEqual(unfocused.endState.profession.lightningRodChargeExpiries, []);
  assert.equal(unfocused.endState.profession.electricArtilleryAvailable, false);
});

test('Electric Artillery is unavailable until Lightning Rod creates its flip', () => {
  const result = simulate('Amalgam', ['Electric Artillery'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Lightning Rod has not finished charging/);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Electric Artillery'),
    false
  );
});

test('Lightning Rod exposes Electric Artillery after charging', () => {
  const charging = simulate('Amalgam', ['Lightning Rod'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const charged = simulate('Amalgam', ['Lightning Rod', { type: 'wait', durationMs: 4000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const chargingContext = {
    professionState: charging.endState.profession,
    time: charging.duration
  };
  const chargedContext = {
    professionState: charged.endState.profession,
    time: charged.duration
  };
  const rod = engineerCatalog.skillsByName.get('Lightning Rod');
  const artillery = engineerCatalog.skillsByName.get('Electric Artillery');

  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargingContext, rod), false);
  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargingContext, artillery), false);
  assert.equal(engineerProfession.ui.isPaletteSkillAvailable(chargedContext, artillery), true);
  assert.equal(charging.endState.profession.availableFlips[artillery.id], false);
  assert.equal(charged.endState.profession.availableFlips[artillery.id], true);
});

test('Roiling Skies changes control branch with focus and always cripples', () => {
  const unfocused = simulate('Amalgam', ['Roiling Skies'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });
  const focused = simulate('Amalgam', ['Conduit Surge', 'Roiling Skies'], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(
    unfocused.events.find((event) => event.type === 'control' && event.skillName === 'Roiling Skies').controlKind,
    'stun'
  );
  assert.equal(
    focused.events.find((event) => event.type === 'control' && event.skillName === 'Roiling Skies').controlKind,
    'launch'
  );
  assert.equal(
    focused.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Roiling Skies' && event.condition === 'Crippled'
    ).duration,
    5
  );
});

test('focused Devastator completes its full cast and triggers six hits', () => {
  const result = simulate('Amalgam', ['Conduit Surge', 'Devastator', { type: 'wait', durationMs: 2000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705]
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.steps.find((step) => step.skill === 'Devastator').end -
      result.steps.find((step) => step.skill === 'Devastator').start,
    1000
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Devastator').length,
    1
  );
  const focused = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Focused Devastation'
  );

  assert.equal(focused.length, 6);
  assert.ok(focused.every((event) => event.coefficient === 0.2));
  assert.ok(focused.every((event) => event.skillId === 73064));
  assert.ok(focused.every((event) => event.sourceId === 73064));
  assert.equal(new Set(focused.map((event) => event.activationId)).size, 1);
  assert.notEqual(
    focused[0].activationId,
    result.resolvedEvents.find((event) => event.name === 'Devastator').activationId
  );
  assert.ok(
    focused.every(
      (event) => event.weaponStrengthProfileId === 'nonweapon.unequipped' && event.resolvedWeaponStrength === 690.5
    )
  );
  assert.ok(
    result.resolvedEvents.filter((event) => event.name === 'Devastator').every((event) => event.skillId === 72974)
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.name === 'Focused Devastation — Burning'
    ).length,
    6
  );
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.name === 'Focused Devastation — Burning')
      .every((event) => event.skillId === 73064 && event.sourceId === 73064)
  );
  assert.equal(result.breakdown.find((entry) => entry.name === 'Devastator').skillId, 72974);
  assert.equal(result.breakdown.find((entry) => entry.name === 'Focused Devastation').skillId, 73064);

  const stochastic = simulate('Amalgam', ['Conduit Surge', 'Devastator', { type: 'wait', durationMs: 2000 }], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    randomness: { mode: 'stochastic', seed: 73064 }
  });
  const stochasticStrengths = new Set(
    stochastic.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Focused Devastation')
      .map((event) => event.resolvedWeaponStrength)
  );

  assert.equal(stochasticStrengths.size, 1);
  assert.ok([...stochasticStrengths][0] >= 656);
  assert.ok([...stochasticStrengths][0] < 725);
});
