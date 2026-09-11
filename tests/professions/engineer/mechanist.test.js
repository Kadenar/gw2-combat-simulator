import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/model.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { engineerMechHasQuickness } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';

// Mechanist contracts cover signet passives, mech boon state, inheritance, and command effects.
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

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

test('Superconducting distributes its coefficient and conditions over one Lightning field', () => {
  // A minimal activation checks field scheduling and combo eligibility independently of saved rotations.
  const config = {
    selectedSkills: [...baseConfig.selectedSkills, 'Superconducting Signet'],
    target: { conditions: {} }
  };
  const result = simulate(
    'Mechanist',
    ['Superconducting Signet', 'Throw Mine', 'Detonate', { type: 'wait', durationMs: 6000 }],
    config
  );
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.SUPERCONDUCTING_SIGNET);
  assert.ok(Math.abs(hits.reduce((total, hit) => total + hit.coefficient, 0) - 2.4) < 1e-12);
  assert.deepEqual(
    hits.map((hit) => Math.round((hit.at - hits[0].at) * 1000)),
    [0, 1000, 2000, 3000, 4000, 5000]
  );
  for (const condition of ['Vulnerability', 'Confusion', 'Burning']) {
    const packets = result.events.filter(
      (event) =>
        event.type === 'condition' && event.skillId === ID.SUPERCONDUCTING_SIGNET && event.condition === condition
    );
    assert.deepEqual(
      packets.map((event) => Math.round(event.at * 1000)),
      hits.map((event) => Math.round(event.at * 1000))
    );
    assert.ok(packets.every((event) => event.stacks === 1 && event.duration === 3));
  }

  const fields = result.events.filter(
    (event) => event.type === 'combo_field' && event.skillId === ID.SUPERCONDUCTING_SIGNET
  );
  assert.equal(fields.length, 1);
  assert.equal(fields[0].at, hits[0].at);
  assert.equal(fields[0].expiresAt - fields[0].at, 5);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'combo' && event.fieldType === 'Lightning'));
  const expired = simulate(
    'Mechanist',
    ['Superconducting Signet', { type: 'wait', durationMs: 6000 }, 'Throw Mine', 'Detonate'],
    config
  );
  assert.ok(!expired.resolvedEvents.some((event) => event.type === 'combo' && event.fieldType === 'Lightning'));
});

for (const [signet, skillId, modifier, baseBonus, jDriveBonus] of [
  ['Force Signet', ID.FORCE_SIGNET, 'modifyStrikeDamage', 0.15, 0.18],
  ['Superconducting Signet', ID.SUPERCONDUCTING_SIGNET, 'modifyConditionDamage', 0.1, 0.12]
]) {
  test(`${signet} passive follows equipment, recharge, and J-Drive`, () => {
    // Cooldown history must remove the ordinary passive and restore it when recharge finishes.
    const runtime = engineerProfession.resolveRuntime({ specialization: 'Mechanist' });
    const events = [{ type: 'action', at: 1, skillId, rechargeReadyAt: 31 }];
    const timeline = createGw2TimelineIndex({ events });
    for (const [selected, traits, time, expected] of [
      [false, [], 0, 1],
      [false, [TRAIT.MECH_CORE_J_DRIVE], 0, 1],
      [true, [], 0, 1 + baseBonus],
      [true, [], 2, 1],
      [true, [], 31, 1 + baseBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 0, 1 + jDriveBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 2, 1 + jDriveBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 31, 1 + jDriveBonus]
    ]) {
      assert.equal(
        runtime[modifier](
          {
            config: {
              specialization: 'Mechanist',
              selectedSkills: selected ? [signet] : [],
              selectedTraitIds: traits
            },
            timeline,
            time
          },
          1
        ),
        expected
      );
    }
  });
}

test('Overclock reduces other signet recharges only while its passive is available', () => {
  // Its own cooldown stays at 90 seconds; J-Drive retains the stronger passive during recharge.
  const runtime = engineerProfession.resolveRuntime({ specialization: 'Mechanist' });
  const context = {
    config: { selectedSkills: ['Overclock Signet'] },
    skill: mechanic('Superconducting Signet'),
    state: { cooldowns: new Map() },
    start: 0
  };
  assert.equal(mechanic('Overclock Signet').cooldown, 90);
  assert.equal(runtime.modifyRechargeDuration(context, 30), 24);
  context.state.cooldowns.set(ID.OVERCLOCK_SIGNET, 90);
  assert.equal(runtime.modifyRechargeDuration(context, 30), 30);
  context.config.selectedTraitIds = [TRAIT.MECH_CORE_J_DRIVE];
  assert.equal(runtime.modifyRechargeDuration(context, 30), 22.8);
  context.skill = mechanic('Overclock Signet');
  assert.equal(runtime.modifyRechargeDuration(context, 90), 90);
});

test('mech Quickness uses its own boon audience and retains copied applications', () => {
  // The player's permanent boon alone is insufficient; copied timed boons retain their own expiry.
  const context = {
    config: { boons: { quickness: true }, selectedSkills: ['Force Signet'] },
    events: [],
    state: { cooldowns: new Map() },
    epsilon: 1e-9
  };
  assert.equal(engineerMechHasQuickness(context, 0), false);
  context.config.selectedSkills = ['Shift Signet'];
  assert.equal(engineerMechHasQuickness(context, 0), true);
  context.state.cooldowns.set(ID.SHIFT_SIGNET, 25);
  assert.equal(engineerMechHasQuickness(context, 1), false);
  context.config.selectedTraitIds = [TRAIT.MECH_CORE_J_DRIVE];
  assert.equal(engineerMechHasQuickness(context, 1), true);
  context.config = { boons: {}, selectedSkills: [] };
  context.events = [
    {
      type: 'buff',
      kind: 'quickness',
      at: 1,
      duration: 2,
      stacks: 1,
      resolvedAudience: { includesSelf: false, includesSummons: true }
    }
  ];
  assert.equal(engineerMechHasQuickness(context, 0), false);
  assert.equal(engineerMechHasQuickness(context, 2), true);
  assert.equal(engineerMechHasQuickness(context, 3), false);

  const result = simulate(
    'Mechanist',
    ['Jade Mortar', { type: 'wait', durationMs: 1800 }, 'Shift Signet', { type: 'wait', durationMs: 4000 }],
    {
      selectedSkills: ['Shift Signet'],
      selectedTraitIds: [TRAIT.MECH_CORE_JADE_DYNAMO],
      target: { conditions: {} }
    }
  );
  const copied = result.events.find(
    (event) => event.type === 'buff' && event.sourceId === ID.SHIFT_SIGNET && event.kind === 'quickness'
  );
  assert.ok(copied?.resolvedAudience.includesSummons);
  assert.equal(copied.resolvedAudience.includesSelf, false);
  context.events = result.events;
  assert.equal(engineerMechHasQuickness(context, copied.at + 0.2), true);
  assert.equal(engineerMechHasQuickness(context, copied.at + copied.duration + 0.1), false);
});

test('Mechanical Genius gives the jade mech independent inherited attributes', () => {
  const player = {
    power: 2000,
    precision: 1500,
    toughness: 1200,
    vitality: 1300,
    ferocity: 600,
    conditionDamage: 1000,
    expertise: 300,
    concentration: 400,
    healingPower: 500
  };
  const base = engineerMechAttributes({ specialization: 'Mechanist' }, player);

  assert.deepEqual(base, {
    power: 2000,
    precision: 1,
    toughness: 2200,
    vitality: 2300,
    ferocity: 300,
    conditionDamage: 500,
    expertise: 150,
    concentration: 200,
    healingPower: 250
  });
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
      },
      player
    ).conditionDamage,
    1000
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
      },
      player
    ).expertise,
    300
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
      },
      player
    ).concentration,
    400
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
      },
      player
    ).healingPower,
    500
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]
      },
      player
    ).precision,
    1501
  );

  const uncapped = {
    power: 10000,
    precision: 10000,
    toughness: 10000,
    vitality: 10000,
    ferocity: 10000,
    conditionDamage: 10000,
    expertise: 10000,
    concentration: 10000,
    healingPower: 10000
  };
  const cappedBase = engineerMechAttributes(
    {
      specialization: 'Mechanist'
    },
    uncapped
  );

  assert.equal(cappedBase.power, 2250);
  assert.equal(cappedBase.ferocity, 750);
  assert.equal(cappedBase.conditionDamage, 750);
  assert.equal(cappedBase.expertise, 750);
  assert.equal(cappedBase.concentration, 750);
  assert.equal(cappedBase.healingPower, 750);
  assert.equal(
    engineerMechAttributes(
      {
        specialization: 'Mechanist',
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]
      },
      uncapped
    ).precision,
    2500
  );
  const cappedConductive = engineerMechAttributes(
    {
      specialization: 'Mechanist',
      selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS]
    },
    uncapped
  );

  assert.equal(cappedConductive.conditionDamage, 1500);
  assert.equal(cappedConductive.expertise, 1500);
  const cappedChanneling = engineerMechAttributes(
    {
      specialization: 'Mechanist',
      selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS]
    },
    uncapped
  );

  assert.equal(cappedChanneling.concentration, 1500);
  assert.equal(cappedChanneling.healingPower, 1500);
  const copiedMightAfterCaps = engineerProfession
    .resolveRuntime({
      specialization: 'Mechanist'
    })
    .modifyAttributes(
      {
        config: {
          specialization: 'Mechanist',
          selectedSkills: ['Shift Signet'],
          boons: { might: 25 }
        },
        event: {
          actorType: 'summon',
          metadata: { engineerMech: true }
        }
      },
      {
        ...uncapped,
        power: uncapped.power + 750,
        conditionDamage: uncapped.conditionDamage + 750
      }
    );

  assert.equal(copiedMightAfterCaps.power, 3000);
  assert.equal(copiedMightAfterCaps.conditionDamage, 1500);

  const firearms = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 1500 }], {
    stats: {
      power: 2811,
      precision: 1960,
      ferocity: 1480
    },
    boons: { fury: true },
    attributeProvenance: {
      professionStaticRulesApplied: true
    },
    selectedTraitIds: [
      TRAIT.HEMATIC_FOCUS,
      TRAIT.NO_SCOPE,
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    target: { conditions: {} }
  });
  const mechStrike = firearms.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Spark Revolver'
  );

  assert.ok(Math.abs(mechStrike.criticalChance - 0.9576190476190476) < 1e-12);
  assert.ok(Math.abs(mechStrike.criticalDamage - 1.9433333333333334) < 1e-12);
});

test('Mechanist arm traits alter mech hits and their command skills', () => {
  const singleEdge = simulate('Mechanist', ['Rolling Smash', { type: 'wait', durationMs: 1500 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const rolling = singleEdge.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Rolling Smash');

  assert.equal(rolling.actorType, 'summon');
  assert.equal(rolling.coefficient, 1.6);
  const rollingBleeds = singleEdge.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Bleeding' &&
      ['Rolling Smash', 'Mech Arms: Single-Edge Cutters'].includes(event.skillName)
  );

  assert.ok(
    rollingBleeds.some((event) => event.skillName === 'Rolling Smash' && event.stacks === 4 && event.duration === 8)
  );
  const cutterBleeds = rollingBleeds.filter((event) => event.skillName === 'Mech Arms: Single-Edge Cutters');

  assert.equal(cutterBleeds.length, 2);
  assert.ok(cutterBleeds.every((event) => event.stacks === 1 && event.duration === 3));
  assert.ok(cutterBleeds[1].at - cutterBleeds[0].at >= 1);

  const highImpact = simulate('Mechanist', ['Explosive Knuckle', { type: 'wait', durationMs: 1500 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const knuckle = highImpact.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Explosive Knuckle'
  );

  assert.equal(knuckle.actorType, 'summon');
  assert.equal(knuckle.coefficient, 1.8);
  assert.equal(knuckle.damageKind, 'explosion');
  assert.equal(knuckle.weaponStrengthProfileId, 'summon.weapon-type-2');
  assert.equal(knuckle.resolvedWeaponStrength, 2878);
  assert.ok(
    highImpact.resolvedEvents.some(
      (event) => event.type === 'condition' && event.condition === 'Weakness' && event.duration === 5
    )
  );
  const highImpactProcs = highImpact.procSteps.filter((step) => step.skill === 'Mech Arms: High-Impact Drivers');

  assert.equal(highImpactProcs.length, 2);
  assert.ok(highImpactProcs[1].start - highImpactProcs[0].start >= 1);

  const jadeCannons = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2300 }], {
    selectedTraitIds: [TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, TRAIT.MECH_CORE_J_DRIVE],
    stats: { precision: 4000 },
    target: { conditions: {} }
  });
  const spark = jadeCannons.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Spark Revolver'
  );

  assert.equal(spark.length, 12);
  assert.ok(
    spark.every(
      (event) =>
        event.actorType === 'summon' &&
        Math.abs(event.coefficient - 0.176) < 1e-12 &&
        event.weaponStrengthProfileId === 'summon.weapon-type-2' &&
        event.resolvedWeaponStrength === 2878
    )
  );
  const autos = jadeCannons.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Jade Energy Shot'
  );

  assert.ok(autos.length >= 2);
  assert.ok(spark.every((event) => event.criticalChance === 0.25));
  assert.deepEqual(
    autos
      .slice(0, 2)
      .map((event) => [
        event.skillId,
        event.coefficient,
        event.criticalChance,
        event.weaponStrengthProfileId,
        event.resolvedWeaponStrength
      ]),
    [
      [ID.JADE_ENERGY_SHOT, 0.42, 0.25, 'summon.weapon-type-1', 2553.5],
      [ID.JADE_ENERGY_SHOT_ID_63348, 0.42, 0.25, 'summon.weapon-type-1', 2553.5]
    ]
  );
  assert.ok(
    jadeCannons.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Mech Arms: Jade Cannons' &&
        event.condition === 'Vulnerability' &&
        event.duration === 6
    )
  );

  const meleeChain = simulate('Mechanist', [{ type: 'wait', durationMs: 3000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  }).resolvedEvents.filter(
    (event) =>
      event.type === 'damage' && ['Hard Strike', 'Heavy Smash (Mech)', 'Twin Strike (Mech)'].includes(event.name)
  );

  assert.deepEqual(
    [...new Set(meleeChain.map((event) => event.name))],
    ['Hard Strike', 'Heavy Smash (Mech)', 'Twin Strike (Mech)']
  );
  assert.ok(
    meleeChain.every(
      (event) => event.weaponStrengthProfileId === 'summon.weapon-type-2' && event.resolvedWeaponStrength === 2878
    )
  );
});

test('Mechanist frame commands use mech stats and requested pulse profiles', () => {
  const conductive = simulate('Mechanist', ['Discharge Array', { type: 'wait', durationMs: 5000 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const discharge = conductive.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Discharge Array'
  );

  assert.equal(discharge.length, 5);
  assert.ok(
    discharge.every((event, index) => event.actorType === 'summon' && event.coefficient === 0.3 && event.at === index)
  );
  for (const [condition, stacks, duration] of [
    ['Slow', 1, 2],
    ['Confusion', 2, 3],
    ['Burning', 1, 3]
  ]) {
    const applications = conductive.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Discharge Array' && event.condition === condition
    );

    assert.equal(applications.length, 5);
    assert.ok(applications.every((event) => event.stacks === stacks && event.duration === duration));
  }

  const variable = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 700 }], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    target: { conditions: {} }
  });
  const reactor = variable.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Core Reactor Shot'
  );

  assert.equal(reactor.actorType, 'summon');
  assert.equal(reactor.coefficient, 2.5);
  assert.equal(reactor.weaponStrengthProfileId, 'summon.weapon-type-1');
  assert.equal(reactor.resolvedWeaponStrength, 2553.5);
  assert.ok(
    variable.events.some(
      (event) => event.type === 'control' && event.skillName === 'Core Reactor Shot' && event.controlKind === 'launch'
    )
  );
});

describe('Mechanist grandmaster active effects', () => {
  test('Mech Fighter adds Rocket Punch', () => {
    const fighter = simulate('Mechanist', ['Lightning Rod'], {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE
      ],
      target: { conditions: {} }
    });
    const punch = fighter.resolvedEvents.find(
      (event) => event.type === 'damage' && event.name === 'Rocket Punch (Mech)'
    );

    assert.equal(punch.actorType, 'summon');
    assert.equal(punch.coefficient, 1);
    assert.equal(punch.explosion, true);
    assert.equal(punch.weaponStrengthProfileId, 'summon.weapon-type-1');
    assert.equal(punch.resolvedWeaponStrength, 2553.5);
    const punchBreakdown = fighter.breakdown.find((entry) => entry.name === 'Rocket Punch (Mech)');

    assert.equal(punchBreakdown.skillId, ID.ROCKET_PUNCH_MECH);
    assert.equal(punchBreakdown.actorType, 'summon');
    const punchRow = skillBreakdownRows(fighter).find((row) => row.name === 'Rocket Punch (Mech)');

    assert.equal(punchRow.skillId, ID.ROCKET_PUNCH_MECH);
    assert.equal(punchRow.actorType, 'summon');
    assert.equal(punchRow.group, 'Entities');
    assert.ok(
      fighter.resolvedEvents.some(
        (event) =>
          event.type === 'condition' &&
          event.skillName === 'Rocket Punch (Mech)' &&
          event.condition === 'Burning' &&
          event.duration === 5
      )
    );
    assert.ok(
      fighter.events.some(
        (event) =>
          event.type === 'control' &&
          event.skillName === 'Rocket Punch (Mech)' &&
          event.controlKind === 'defiance' &&
          event.duration === 100
      )
    );
  });

  test('Jade Dynamo adds quickness and Jade Buster Cannon', () => {
    const dynamo = simulate('Mechanist', ['Jade Mortar', 'Jade Mortar'], {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_JADE_DYNAMO
      ],
      target: { conditions: {} }
    });
    const mortarSteps = dynamo.steps.filter((step) => step.skill === 'Jade Mortar');

    assert.equal(mortarSteps[0].end - mortarSteps[0].start, 1620);
    assert.equal(mortarSteps[1].start - mortarSteps[0].start, 16000);
    assert.equal(
      dynamo.events.filter((event) => event.type === 'buff' && event.kind === 'quickness' && event.duration === 2.5)
        .length,
      2
    );
    const mortar = dynamo.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Jade Mortar');

    assert.equal(mortar.actorType, 'summon');
    assert.equal(mortar.coefficient, 2.2);
    assert.equal(mortar.weaponStrengthProfileId, 'summon.weapon-type-2');
    assert.equal(mortar.resolvedWeaponStrength, 2878);

    const overclock = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 4000 }], {
      selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Shift Signet', 'Force Signet', 'Overclock Signet'],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO
      ],
      target: { conditions: {} }
    });
    const buster = overclock.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Jade Buster Cannon'
    );
    const busterBurns = overclock.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Jade Buster Cannon' && event.condition === 'Burning'
    );

    assert.equal(buster.length, 5);
    assert.ok(
      buster.every(
        (event) =>
          event.actorType === 'summon' &&
          event.coefficient === 0.95 &&
          event.weaponStrengthProfileId === 'summon.weapon-type-3' &&
          event.resolvedWeaponStrength === 2749
      )
    );
    assert.equal(new Set(buster.map((event) => event.activationId)).size, 1);
    assert.equal(busterBurns.length, 5);
    assert.ok(busterBurns.every((event) => event.stacks === 1 && event.duration === 6));
    const stochasticBuster = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 4000 }], {
      selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Shift Signet', 'Force Signet', 'Overclock Signet'],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO
      ],
      randomness: { mode: 'stochastic', seed: 63374 },
      target: { conditions: {} }
    }).resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Jade Buster Cannon');
    const stochasticStrengths = [...new Set(stochasticBuster.map((event) => event.resolvedWeaponStrength))];

    assert.equal(stochasticStrengths.length, 1);
    assert.ok(stochasticStrengths[0] >= 2448 && stochasticStrengths[0] < 3050);
    assert.ok(stochasticBuster.every((event) => event.weaponStrengthSampled === true));
  });

  test('J-Drive adds mech attacks and improves signets', () => {
    const jDriveConfig = {
      selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Force Signet', 'Superconducting Signet', 'Overclock Signet'],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE
      ],
      target: { conditions: {} }
    };
    const sky = simulate('Mechanist', ['Sky Circus'], jDriveConfig);
    const missiles = sky.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Missile Damage');

    assert.equal(missiles.length, 1);
    assert.ok(missiles.every((event) => event.actorType === 'summon' && event.coefficient === 0.6));
    assert.equal(
      sky.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Landing Damage').coefficient,
      1.2
    );
    assert.ok(
      sky.events.some(
        (event) => event.type === 'control' && event.skillName === 'Sky Circus' && event.controlKind === 'knockback'
      )
    );

    const base = simulate('Mechanist', ['Puncturing Jab'], {
      target: { conditions: {} }
    });
    const standardSignetConfig = {
      selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Force Signet', 'Shift Signet', 'Overclock Signet'],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_BARRIER_ENGINE
      ],
      target: { conditions: {} }
    };
    const standardSigned = simulate('Mechanist', ['Puncturing Jab'], standardSignetConfig);
    const signed = simulate('Mechanist', ['Puncturing Jab'], jDriveConfig);
    const strike = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Puncturing Jab');

    assert.ok(Math.abs(strike(standardSigned).damage / strike(base).damage - 1.15) < 1e-12);
    assert.ok(Math.abs(strike(signed).damage / strike(base).damage - 1.18) < 1e-12);

    const mechWithoutShift = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 1000 }], {
      ...standardSignetConfig,
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_BARRIER_ENGINE
      ],
      selectedSkills: standardSignetConfig.selectedSkills.filter((skill) => skill !== 'Shift Signet'),
      boons: { might: 25 }
    });
    const mechWithShift = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 1000 }], {
      ...standardSignetConfig,
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_BARRIER_ENGINE
      ],
      boons: { might: 25 }
    });
    const mechStrike = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Core Reactor Shot');

    assert.ok(Math.abs(mechStrike(mechWithShift).damage / mechStrike(mechWithoutShift).damage - 1.375) < 1e-12);
    assert.equal(
      engineerProfession
        .resolveRuntime({
          specialization: 'Mechanist'
        })
        .modifyConditionDamage(
          {
            config: jDriveConfig,
            time: 0
          },
          1
        ),
      1.12
    );

    const signetRecharge = simulate('Mechanist', ['Force Signet', 'Force Signet'], jDriveConfig);
    const signetSteps = signetRecharge.steps.filter((step) => step.skill === 'Force Signet');

    assert.equal(signetSteps[1].start - signetSteps[0].end, 22800);
  });
});
