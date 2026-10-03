import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { skillFlipVisible, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/authoring.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { handleElectricArtillery } from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

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

const simulate = createObservedProfessionSimulator(engineerProfession, baseConfig);

// Blade attribution must survive both authored effects and heat-generated events without changing the casting skill.
test('Refraction Cutter blades retain their parent skill and expose a separate damage identity', () => {
  for (const [specialization, initialHeat] of [
    ['Core', 0],
    ['Mechanist', 0],
    ['Holosmith', 0],
    ['Holosmith', 60],
    ['Holosmith', 110]
  ]) {
    const result = simulate(specialization, ['Refraction Cutter', { type: 'wait', durationMs: 1000 }], {
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Pistol',
      initialHeat,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT]
    });
    assert.deepEqual(result.warnings, []);
    const primary = result.resolvedEvents.find(
      (event) =>
        event.type === 'damage' && event.skillName === 'Refraction Cutter' && event.name !== 'Refraction Cutter Blade'
    );
    const blades = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Refraction Cutter Blade'
    );
    assert.ok(primary);
    assert.ok(blades.length > 0);
    for (const blade of blades) {
      assert.equal(blade.damageBreakdownName, 'Refraction Cutter Blade');
      assert.equal(blade.sourceId, ID.REFRACTION_CUTTER_BLADE);
      assert.equal(blade.skillId, primary.skillId);
      assert.equal(blade.skillName, primary.skillName);
    }
  }
});

// Derived projectiles retain their identity, but only their parent may emit them.
test('Refraction Cutter Blade rejects standalone names and IDs while parent blades resolve', () => {
  const config = { primaryWeapon: 'Sword', secondaryWeapon: 'Pistol' };
  const blade = engineerCatalog.skillsById.get(ID.REFRACTION_CUTTER_BLADE);
  assert.equal(
    Object.hasOwn(planningFixture(engineerProfession, { specialization: 'Holosmith' }).availability, blade.id),
    false
  );
  for (const action of [blade.name, blade.id]) {
    const result = simulate('Holosmith', [action], config);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /unavailable for this build/);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage'),
      false
    );
  }

  for (const initialHeat of [0, 60]) {
    const result = simulate('Holosmith', ['Refraction Cutter', { type: 'wait', durationMs: 1000 }], {
      ...config,
      initialHeat
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.resolvedEvents.some((event) => event.name === blade.name && event.damage > 0));
  }
});

// Exercise charge conversion independently of the scheduler's usual eight-charge sequence.
test('Electric Artillery converts whole charges into Focused-sensitive Vulnerability at impact', () => {
  for (const [charges, focusedStacks, unfocusedStacks] of [
    [0, 0, 0],
    [1, 1, 0],
    [3, 3, 1],
    [8, 8, 4],
    [12, 12, 6],
    [20, 12, 6]
  ]) {
    for (const [focusedUntil, expectedStacks] of [
      [11, focusedStacks],
      [10, unfocusedStacks]
    ]) {
      const conditions = [];
      handleElectricArtillery(
        {
          catalog: engineerCatalog,
          profession: { core: { focusedUntil } },
          effects: {
            emit(request) {
              if (request.settlement === 'reaction') conditions.push(request.event);
              return request.event;
            }
          }
        },
        { at: 10, skillId: ID.ELECTRIC_ARTILLERY, skillName: 'Electric Artillery', charges }
      );
      const vulnerability = conditions.find((event) => event.condition === 'Vulnerability');
      assert.equal(vulnerability?.stacks ?? 0, expectedStacks);
      if (expectedStacks) {
        assert.equal(vulnerability.sourceId, ID.ELECTRIC_ARTILLERY);
        assert.equal(vulnerability.duration, 8);
        assert.equal(vulnerability.fixedDuration, true);
      }

      const immobilize = conditions.find((event) => event.condition === 'Immobilized');
      assert.equal(immobilize.sourceId, ID.ELECTRIC_ARTILLERY);
      assert.equal(immobilize.at, 10);
      assert.equal(immobilize.duration, 2);
    }
  }
});

// Healing pulses must not generate additional damage or on-hit procs.
test('Essence of Living Shadows damages only on its initial detonation', () => {
  const result = simulate('Core', ['Essence of Living Shadows', { type: 'wait', durationMs: 5000 }]);
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.ESSENCE_OF_LIVING_SHADOWS
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].coefficient, 1);
});

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
    observedRuntime(result).profession.specialization.state.mech.commandSkillIds.map(
      (id) => engineerCatalog.skillsById.get(id).name
    ),
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
    ['Shred', 'Protect', 'Demolish']
  );
  const protocolGroups = groups;
  const protocolSelections = protocolGroups.flatMap((group) => group.selections);

  assert.deepEqual(
    protocolSelections.map((selection) => engineerCatalog.skillsById.get(selection.skillId).name),
    ['Offensive Protocol: Shred', 'Defensive Protocol: Protect', 'Offensive Protocol: Demolish']
  );
  assert.ok(protocolGroups.every((group) => group.layout === 'engineer-amalgam-protocols'));
  assert.ok(
    protocolSelections.every(
      (selection) => selection.selectionKey === 'selectedMorphSkillIds' && selection.optionSkillIds.length === 7
    )
  );
  assert.deepEqual(
    groups.map((group) => group.id),
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

// Commands reserve the summon lane; only instant commands may overlap an existing summon cast.
test('Mechanist commands declare independent lanes and instant overlap', () => {
  const commands = engineerCatalog.skills.filter(
    (skill) =>
      skill.specialization === 'Mechanist' && Number(skill.mechanicSlot) >= 1 && Number(skill.mechanicSlot) <= 3
  );
  assert.ok(commands.length > 0);
  assert.ok(commands.every((skill) => skill.independentCast === true));
  for (const skill of commands) {
    assert.equal(skill.independentCastCanOverlap === true, skill.castTimeMs === 0, skill.name);
  }
});

test('Engineer sword variants have specialization-owned facts and runtime gating', () => {
  const skill = (id) => engineerCatalog.skillsById.get(id);
  const mechanistRuntime = engineerProfession.resolveProfession({ specialization: 'Mechanist' });
  const holosmithRuntime = engineerProfession.resolveProfession({ specialization: 'Holosmith' });

  for (const id of [
    ID.SUN_EDGE_NON_HOLOSMITH,
    ID.SUN_RIPPER_NON_HOLOSMITH,
    ID.GLEAM_SABER_NON_HOLOSMITH,
    ID.RADIANT_ARC_NON_HOLOSMITH,
    ID.REFRACTION_CUTTER_NON_HOLOSMITH
  ]) {
    assert.equal(skill(id).specialization, '');
  }

  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER), false);
  assert.equal(mechanistRuntime.catalog.skillsById.has(ID.GLEAM_SABER_NON_HOLOSMITH), true);
  assert.equal(
    holosmithRuntime.weaponSkillMatchesSet(
      holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER_NON_HOLOSMITH),
      ['Sword'],
      { specialization: 'Holosmith' }
    ),
    false
  );
  assert.equal(
    holosmithRuntime.weaponSkillMatchesSet(holosmithRuntime.catalog.skillsById.get(ID.GLEAM_SABER), ['Sword'], {
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

  assert.equal(strikeEffectCoefficient(skill(ID.SUN_EDGE_NON_HOLOSMITH).effects[0]), 0.96);
  assert.equal(strikeEffectCoefficient(skill(ID.SUN_RIPPER_NON_HOLOSMITH).effects[0]), 1.02);
  assert.equal(strikeEffectCoefficient(skill(ID.GLEAM_SABER_NON_HOLOSMITH).effects[0]), 1.65);
  assert.equal(strikeEffectCoefficient(skill(ID.RADIANT_ARC_NON_HOLOSMITH).effects[0]), 2.5);
  assert.equal(skill(ID.RADIANT_ARC_NON_HOLOSMITH).cooldown, 14);
  assert.equal(skill(ID.RADIANT_ARC_NON_HOLOSMITH).comboFinishers[0].finisherType, 'Leap');
  assert.deepEqual(
    skill(ID.RADIANT_ARC_NON_HOLOSMITH)
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

  const refraction = skill(ID.REFRACTION_CUTTER_NON_HOLOSMITH);

  assert.equal(refraction.cooldown, 6);
  assert.equal(strikeEffectCoefficient(refraction.effects[0]), 1.4);
  assert.equal(strikeEffectCoefficient(refraction.effects[1]), 0.8);
  assert.equal(strikeEffectTicks(refraction.effects[1]).length, 2);
  assert.equal(refraction.effects[1].comboFinishers[0].chance, 1);
  assert.equal(conditionEffectTicks(refraction.effects[2]).length, 2);

  const replaced = simulate('Holosmith', [{ type: 'cast', skillId: ID.SUN_EDGE_NON_HOLOSMITH }]);

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
    { type: 'cast', skillId: ID.REFRACTION_CUTTER_NON_HOLOSMITH },
    { type: 'cast', skillId: ID.SUN_EDGE_NON_HOLOSMITH },
    { type: 'cast', skillId: ID.SUN_RIPPER_NON_HOLOSMITH },
    { type: 'cast', skillId: ID.GLEAM_SABER_NON_HOLOSMITH },
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
      { type: 'cast', skillId: ID.REFRACTION_CUTTER_NON_HOLOSMITH },
      { type: 'cast', skillId: ID.SUN_EDGE_NON_HOLOSMITH },
      { type: 'cast', skillId: ID.SUN_RIPPER_NON_HOLOSMITH },
      { type: 'cast', skillId: ID.GLEAM_SABER_NON_HOLOSMITH },
      { type: 'cast', skillId: ID.RADIANT_ARC_NON_HOLOSMITH }
    ],
    { primaryWeapon: 'Sword', secondaryWeapon: 'Pistol' }
  );

  assert.deepEqual(core.warnings, []);
  assert.ok(
    result.procSteps.some((step) => step.skill === 'Gleam Saber — Sword Recharge' && step.cooldownReduction === 0.8)
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

  assert.equal(burst.castTimeMs, 640);
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
});

// The opening control precedes the field; each later strike and condition share the same pulse.
test('Thunderclap pairs field strikes with Vulnerability after its opening control', () => {
  const result = simulate('Core', ['Thunderclap', { type: 'wait', durationMs: 5000 }]);
  const strikes = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.THUNDERCLAP);
  const conditions = result.events.filter(
    (event) => event.type === 'condition' && event.skillId === ID.THUNDERCLAP && event.condition === 'Vulnerability'
  );
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.THUNDERCLAP);
  assert.deepEqual(result.warnings, []);
  assert.ok(strikes.length > 0);
  assert.equal(control.controlKind, 'stun');
  assert.ok(control.at < strikes[0].at);
  assert.deepEqual(
    conditions.map((event) => event.at),
    strikes.map((event) => event.at)
  );
});

test('Bomb Kit packets honor fuses, explosions, fields, and finishers', () => {
  const selectedSkills = ['Healing Turret', 'Bomb Kit', 'Grenade Kit', 'Elixir Gun', 'Supply Crate'];
  const waitForBombPackets = () => ({ type: 'wait', durationMs: 5000 });
  const bombSkills = engineerCatalog.skills.filter(
    (candidate) => candidate.kitId === ID.BOMB_KIT && candidate.effects.some((effect) => effect.type === 'strike')
  );

  // Require matching skills so a stale kit lookup cannot bypass the explosion checks.
  assert.ok(bombSkills.length > 0, 'Bomb Kit must contain strike skills');
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
    [1.36, 2.36, 3.36, 4.36]
  );
  assert.ok(fireHits.every((event) => event.coefficient === 0.25));
  assert.deepEqual(
    fireBurns.map((event) => [Number(event.at.toFixed(2)), event.stacks, event.duration]),
    [
      [1.36, 2, 5],
      [2.36, 1, 2],
      [3.36, 1, 2],
      [4.36, 1, 2]
    ]
  );
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').castTimeMs, 600);
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].fieldType, 'Fire');
  assert.equal(engineerCatalog.skillsByName.get('Fire Bomb').comboFields[0].duration, 3);

  const galvanic = simulate('Core', ['Bomb Kit', 'Galvanic Bomb', waitForBombPackets()], { selectedSkills });

  assert.ok(
    galvanic.events.some(
      (event) => event.type === 'damage' && Math.abs(event.at - 1.36) < 1e-12 && event.coefficient === 2.5
    )
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Confusion' && event.stacks === 6 && event.duration === 8
    )
  );
  assert.ok(galvanic.events.some((event) => event.type === 'control' && event.controlKind === 'daze'));
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').comboFinishers[0].finisherType, 'Blast');
  assert.equal(engineerCatalog.skillsByName.get('Galvanic Bomb').castTimeMs, 600);

  const magnetic = engineerCatalog.skillsByName.get('Magnetic Bomb');

  assert.equal(strikeEffectCoefficient(magnetic.effects[0]), 1.5);
  assert.equal(magnetic.effects[1].controlKind, 'pull');
  assert.equal(magnetic.castTimeMs, 600);
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
    big.events.some((event) => event.type === 'damage' && Math.abs(event.at - 3.36) < 1e-12 && event.coefficient === 3)
  );
  assert.ok(
    big.events.some(
      (event) => event.type === 'control' && Math.abs(event.at - 3.36) < 1e-12 && event.controlKind === 'knockdown'
    )
  );
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").comboFinishers[0].successfulCombos, 2);
  assert.equal(engineerCatalog.skillsByName.get("Big Ol' Bomb").castTimeMs, 600);

  // Shortening a committed placed-bomb animation must not remove its delayed reactions.
  for (const [name, reactions] of [
    ['Galvanic Bomb', ['damage', 'condition', 'control']],
    ['Magnetic Bomb', ['damage', 'control']]
  ]) {
    const interrupted = simulate('Core', ['Bomb Kit', { name, interruptMs: 560 }, waitForBombPackets()], {
      selectedSkills
    });

    assert.deepEqual(
      reactions.filter((type) => interrupted.events.some((event) => event.type === type && event.skillName === name)),
      reactions
    );
  }

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

  assertFlooredDamageMultiplier(firstPacket(withBurning).damage, firstPacket(withoutBurning).damage, 1.1);
});

test('Engineer spear focus selects one branch and Lightning Rod pulses eight times', () => {
  const focused = simulate(
    'Amalgam',
    ['Conduit Surge', 'Lightning Rod', 'Electric Artillery', { type: 'wait', durationMs: 4000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
      stats: { expertise: 600 },
      target: { conditions: { Vulnerability: 0 } }
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
    (event) => event.type === 'condition' && event.condition === 'Immobilized'
  );

  assert.equal(immobilize.length, 1);
  assert.equal(immobilize[0].sourceId, ID.ELECTRIC_ARTILLERY);
  assert.equal(immobilize[0].at, focused.events.find((event) => event.type === 'engineer.electric-artillery').at);
  assert.equal(immobilize[0].duration, 2);
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Conduit Surge').length,
    1
  );
  assert.equal(
    focused.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Electric Artillery').length,
    1
  );
  const artilleryBurns = focused.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Electric Artillery — Burning'
  );

  // Focused charges extend both independent burns without increasing the total stack count.
  assert.equal(artilleryBurns.length, 2);
  assert.ok(artilleryBurns.every((event) => event.stacks === 1 && event.duration === 7));
  assert.equal(artilleryBurns[0].at, artilleryBurns[1].at);

  const unfocused = simulate(
    'Amalgam',
    ['Lightning Rod', 'Electric Artillery'],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
      target: { conditions: { Vulnerability: 0 } }
    },
    // Artillery's condition contract is observed at impact after cast completion.
    { kind: 'tail', durationMs: 1000 }
  );
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
  assert.deepEqual(unfocused.planningState.profession.lightningRodChargeExpiries, []);
  assert.equal(unfocused.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], undefined);
  for (const [result, rodStacks, artilleryStacks] of [
    [focused, 2, 8],
    [unfocused, 1, 4]
  ]) {
    const rodVulnerability = result.resolvedEvents.filter(
      (event) => event.condition === 'Vulnerability' && event.sourceId === ID.LIGHTNING_ROD
    );
    assert.ok(rodVulnerability.length > 0);
    assert.ok(rodVulnerability.every((event) => event.stacks === rodStacks && event.duration === 8));
    const artilleryVulnerability = result.resolvedEvents.find(
      (event) => event.condition === 'Vulnerability' && event.sourceId === ID.ELECTRIC_ARTILLERY
    );
    assert.equal(artilleryVulnerability.stacks, artilleryStacks);
    assert.equal(artilleryVulnerability.duration, 8);
    assert.equal(artilleryVulnerability.effectiveDuration, 8);
  }
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
  const rod = engineerCatalog.skillsByName.get('Lightning Rod');
  const artillery = engineerCatalog.skillsByName.get('Electric Artillery');

  assert.equal(charging.planningState.availability[rod.id].ready, false);
  assert.equal(charging.planningState.availability[artillery.id].ready, false);
  assert.equal(charged.planningState.availability[artillery.id].ready, true);
  assert.equal(
    skillFlipVisible(charging.planningState.profession.availableFlips[artillery.id], charging.rotationEndTime),
    false
  );
  assert.equal(
    skillFlipReady(charged.planningState.profession.availableFlips[artillery.id], charged.rotationEndTime),
    true
  );
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

// Resolve the kit and tool-belt catalog entries exercised below.
function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

test('Mine Field automatically detonates five mines with cripple', () => {
  const mineField = mechanic('Mine Field');

  assert.equal(mineField.cooldown, 17);
  assert.equal(mineField.effects[0].coefficient, 3.85);
  assert.equal(mineField.effects[0].hits, 5);

  const result = simulate('Core', ['Mine Field']);

  assert.equal(result.warnings.length, 0);
  const mines = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Damage per Mine');

  assert.equal(mines.length, 5);
  assert.ok(mines.every((event) => event.coefficient === 0.77));

  const cripple = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Crippled');

  assert.equal(cripple.length, 5);
  assert.ok(cripple.every((event) => event.duration === 2.5));

  // A precast field waits for combat; fields cast after the marker still trigger at cast completion.
  const precast = simulate('Core', ['Mine Field', { type: 'wait', durationMs: 1000 }, '__combat_start']);
  const active = simulate('Core', ['__combat_start', 'Mine Field']);
  const mineTimes = (simulation) =>
    simulation.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Damage per Mine')
      .map((event) => event.at);

  assert.deepEqual(mineTimes(precast), Array(5).fill(1.92));
  assert.deepEqual(mineTimes(active), Array(5).fill(0.92));

  // Deferred packets keep their original cast owner, and combat start consumes the pending activation once.
  const mineCast = precast.events.find((event) => event.type === 'action' && event.skillId === ID.MINE_FIELD);
  assert.ok(mineCast?.activationId);
  for (const event of precast.resolvedEvents.filter((event) => event.type === 'damage' || event.type === 'condition')) {
    assert.equal(event.skillId, ID.MINE_FIELD);
    assert.equal(event.skillName, 'Mine Field');
    assert.equal(event.sourceId, ID.MINE_FIELD);
    assert.equal(event.activationId, mineCast.activationId);
  }

  assert.deepEqual(observedRuntime(precast).profession.core.pendingMineFieldActivationIds, []);

  const staticPrecast = simulate('Core', ['Mine Field', { type: 'wait', durationMs: 1000 }, '__combat_start'], {
    selectedTraitIds: [TRAIT.STATIC_DISCHARGE]
  });
  const staticActive = simulate('Core', ['__combat_start', 'Mine Field'], {
    selectedTraitIds: [TRAIT.STATIC_DISCHARGE]
  });
  const discharges = (simulation) =>
    simulation.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge');

  assert.equal(discharges(staticPrecast).length, 1);
  assert.equal(discharges(staticActive).length, 2);
  assert.ok(discharges(staticActive).some((event) => event.parentSkillName === 'Detonate Mine Field'));
});

test('manual Mine Field detonation cannot add damage or toolbelt activations', () => {
  const detonation = mechanic('Detonate Mine Field');
  assert.equal(
    Object.hasOwn(planningFixture(engineerProfession, { specialization: 'Core' }).availability, detonation.id),
    false
  );

  // Parent casts own detonation, including precasts held until combat; manual name/ID inputs grant nothing.
  for (const rotation of [[], ['Mine Field'], ['Mine Field', '__combat_start']]) {
    const config = { selectedTraitIds: [TRAIT.STATIC_DISCHARGE] };
    const baseline = simulate('Core', rotation, config);
    const result = simulate(
      'Core',
      ['Detonate Mine Field', ...rotation, 'Detonate Mine Field', ID.DETONATE_MINE_FIELD],
      config
    );

    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings.every((warning) => /unavailable for this build/.test(warning)));
    assert.equal(result.totalDamage, baseline.totalDamage);
    assert.equal(
      result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge').length,
      baseline.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge').length
    );
  }
});

test('power Scrapper toolbelt skills use their per-hit and control facts', () => {
  const orbitalStrike = mechanic('Orbital Strike');

  assert.equal(orbitalStrike.cooldown, 40);
  assert.equal(orbitalStrike.castTimeMs, 880);
  assert.equal(strikeEffectCoefficient(orbitalStrike.effects[0]), 1.33);
  assert.equal(effectFirstAtMs(orbitalStrike.effects[0]), 1720);
  assert.equal(orbitalStrike.effects[0].timingAnchor, 'castEnd');
  assert.equal(orbitalStrike.comboFinishers[0].finisherType, 'Blast');

  const orbital = simulate('Core', ['Orbital Strike', { type: 'wait', durationMs: 3000 }], {
    boons: { quickness: true },
    selectedSkills: ['A.E.D.', 'Grenade Kit', 'Throw Mine', 'Bomb Kit', 'Elite Mortar Kit']
  });
  const orbitalCast = orbital.steps.find((step) => step.skill === 'Orbital Strike');
  const orbitalHit = orbital.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Orbital Strike');

  assert.equal(orbitalCast.end - orbitalCast.start, 880);
  assert.equal(orbitalHit.at * 1000 - orbitalCast.end, 1720);

  const grenadeBarrage = mechanic('Grenade Barrage');

  assert.equal(grenadeBarrage.cooldown, 25);
  assert.equal(strikeEffectCoefficient(grenadeBarrage.effects[0]), 3.6);
  assert.equal(strikeEffectTicks(grenadeBarrage.effects[0]).length, 6);
  assert.equal(grenadeBarrage.comboFinishers, undefined);

  const staticShock = mechanic('Static Shock');

  assert.equal(staticShock.cooldown, 20);
  assert.equal(strikeEffectCoefficient(staticShock.effects[0]), 1);
  assert.equal(staticShock.effects[1].controlKind, 'daze');

  const result = simulate('Core', ['Grenade Barrage']);
  const grenades = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Grenade Barrage');

  assert.equal(grenades.length, 6);
  assert.ok(grenades.every((event) => event.coefficient === 0.6));
});

test('Poison Gas Shell pulses its five-second poison field', () => {
  const poisonGasShell = mechanic('Poison Gas Shell');

  assert.equal(poisonGasShell.comboFields[0].fieldType, 'Poison');
  assert.equal(poisonGasShell.comboFields[0].duration, 5);
  assert.ok(poisonGasShell.effects[1].ticks.every((tick) => tick.condition === 'Poisoned' && tick.duration === 3));
  assert.deepEqual(
    poisonGasShell.effects[1].ticks.map((tick) => tick.atMs),
    [0, 1000, 2000, 3000, 4000]
  );

  const result = simulate('Core', ['Elite Mortar Kit', 'Poison Gas Shell', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Elite Mortar Kit']
  });
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Poison Gas Shell' && event.condition === 'Poisoned'
  );

  assert.equal(poison.length, 5);
  assert.deepEqual(
    poison.map((event) => Number((event.at - poison[0].at).toFixed(9))),
    [0, 1, 2, 3, 4]
  );
  assert.ok(poison.every((event) => event.duration === 3));
});
