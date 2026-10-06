import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerMechHasQuickness } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const mechanistRechargeWork = engineerProfession.runtimeFor({ specialization: 'Mechanist' }).rechargeWork;

// Mechanist contracts cover signet passives, mech boon state, inheritance, and command effects.
const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
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

// A real mech command must retain its Force Signet bonus when only the player's Force sigil changes.
test('Jade Mortar does not inherit Force or lose part of its signet bonus', () => {
  const damage = (sigils) =>
    simulate('Mechanist', ['Jade Mortar'], {
      selectedSkillIds: [63253],
      sigilSets: [sigils],
      target: { conditions: {} }
    }).resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Jade Mortar').damage;
  assert.equal(damage({ strike: 1.05, strikeAdd: 0.05 }), damage({ strike: 1, strikeAdd: 0 }));
});

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

for (const [signet, skillId, modifier, baseBonus, jDriveBonus] of [
  ['Force Signet', ID.FORCE_SIGNET, 'modifyStrikeDamage', 0.15, 0.18],
  ['Superconducting Signet', ID.SUPERCONDUCTING_SIGNET, 'modifyConditionDamage', 0.1, 0.12]
]) {
  test(`${signet} passive follows equipment, recharge, and J-Drive`, () => {
    const runtime = engineerProfession.runtimeFor({ specialization: 'Mechanist' });
    // Cooldown history must remove the ordinary passive and restore it when recharge finishes.
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
            catalog: engineerCatalog,
            config: {
              specialization: 'Mechanist',
              selectedSkillIds: selected ? [engineerCatalog.skillsByName.get(signet).id] : [],
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
  const context = {
    catalog: engineerCatalog,
    config: { selectedSkillIds: [63095] },
    skill: mechanic('Superconducting Signet'),
    cooldowns: new Map(),
    cooldownController: {
      readyAt: (id) => context.cooldowns.get(id),
      setReadyAt: (id, at) => context.cooldowns.set(id, at)
    },
    time: 0
  };
  assert.equal(mechanic('Overclock Signet').cooldown, 90);
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 24);
  context.cooldownController.setReadyAt(ID.OVERCLOCK_SIGNET, 90);
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 30);
  context.config = { ...context.config, selectedTraitIds: [TRAIT.MECH_CORE_J_DRIVE] };
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 22.8);
  context.skill = mechanic('Overclock Signet');
  assert.equal(mechanistRechargeWork(context, context.skill, 90), 90);
});

test('mech Quickness uses its own boon audience and retains copied applications', () => {
  // The player's permanent boon alone is insufficient; copied timed boons retain their own expiry.
  const context = {
    catalog: engineerCatalog,
    boons: new Map(),
    buffs: new Map(),
    config: { boons: { quickness: true }, selectedSkillIds: [63253] },
    cooldowns: new Map(),
    cooldownController: {
      readyAt: (id) => context.cooldowns.get(id),
      setReadyAt: (id, at) => context.cooldowns.set(id, at)
    }
  };
  context.combat = createMechanicCombatServices(context);
  context.facts = { read: () => assert.fail('Live mech queries must use accepted applications') };
  assert.equal(engineerMechHasQuickness(context, 0), false);
  context.config.selectedSkillIds = [63111];
  assert.equal(engineerMechHasQuickness(context, 0), true);
  context.cooldownController.setReadyAt(ID.SHIFT_SIGNET, 25);
  assert.equal(engineerMechHasQuickness(context, 1), false);
  context.config.selectedTraitIds = [TRAIT.MECH_CORE_J_DRIVE];
  assert.equal(engineerMechHasQuickness(context, 1), true);
  context.config = { boons: {}, selectedSkillIds: [] };
  recordBuffApplication(context.boons, {
    source: 'fixture',
    sourceId: 'boon',
    actorType: 'player',
    type: 'buff',
    kind: 'quickness',
    at: 1,
    duration: 2,
    stacks: 1,
    resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['engineer.mech'] }
  });
  assert.equal(engineerMechHasQuickness(context, 0), false);
  assert.equal(engineerMechHasQuickness(context, 2), true);
  assert.equal(engineerMechHasQuickness(context, 3), false);

  const result = simulate(
    'Mechanist',
    ['Jade Mortar', { type: 'wait', durationMs: 1800 }, 'Shift Signet', { type: 'wait', durationMs: 4000 }],
    {
      selectedSkillIds: [63111],
      selectedTraitIds: [TRAIT.MECH_CORE_JADE_DYNAMO],
      target: { conditions: {} }
    }
  );
  const copied = result.events.find(
    (event) => event.type === 'buff' && event.sourceId === ID.SHIFT_SIGNET && event.kind === 'quickness'
  );
  assert.ok(copied?.resolvedAudience.includesSummons);
  assert.equal(copied.resolvedAudience.includesSelf, false);
  // Isolate the actual copied grant so the old fixture cannot satisfy the assertions.
  context.boons.clear();
  recordBuffApplication(context.boons, copied);
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
    .resolveProfession({
      specialization: 'Mechanist'
    })
    .modifyAttributes(
      {
        catalog: engineerCatalog,
        config: {
          specialization: 'Mechanist',
          selectedSkillIds: [63111],
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
  const singleEdge = simulate('Mechanist', ['Rolling Smash', { type: 'wait', durationMs: 4000 }], {
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

  const rollingSmashBleeds = rollingBleeds.filter((event) => event.skillName === 'Rolling Smash');
  assert.equal(
    rollingSmashBleeds.reduce((sum, event) => sum + event.stacks, 0),
    4
  );
  assert.ok(rollingSmashBleeds.every((event) => event.duration === 8));
  const cutterBleeds = rollingBleeds.filter((event) => event.skillName === 'Mech Arms: Single-Edge Cutters');

  assert.ok(cutterBleeds.length > 1);
  assert.ok(cutterBleeds.every((event) => event.stacks === 1 && event.duration === 3));
  // Resolver-derived bleeds and scheduled commands must retain the same concrete mech owner.
  assert.ok(
    rollingBleeds.every((event) => event.summonOwner === 'engineer.mech' && event.independentConditionOwner === true)
  );
  assert.ok(cutterBleeds.slice(1).every((event, index) => event.at - cutterBleeds[index].at > 1));

  const highImpact = simulate('Mechanist', ['Explosive Knuckle', { type: 'wait', durationMs: 4000 }], {
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

  assert.ok(highImpactProcs.length > 1);
  assert.ok(highImpactProcs.slice(1).every((step, index) => step.start - highImpactProcs[index].start > 1));

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

  const serratedSteel = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2300 }], {
    selectedTraitIds: [
      TRAIT.SERRATED_STEEL,
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    stats: { precision: 4000 },
    target: { conditions: {} }
  });
  // Firearms procs caused by the mech must stay on its independent condition owner.
  assert.ok(
    serratedSteel.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Serrated Steel' &&
        event.actorType === 'summon' &&
        event.summonOwner === 'engineer.mech'
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

  assert.ok(discharge.length > 0);
  assert.ok(discharge.every((event) => event.actorType === 'summon' && event.coefficient === 0.3));
  for (const [condition, duration] of [
    ['Slow', 2],
    ['Confusion', 3],
    ['Burning', 3]
  ]) {
    const applications = conductive.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Discharge Array' && event.condition === condition
    );

    assert.ok(applications.length > 0);
    assert.ok(applications.every((event) => event.stacks === 1 && event.duration === duration));
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
    const fighter = simulate('Mechanist', ['Lightning Rod', 'Electric Artillery'], {
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
    // Only the attacking spear flip owns the Rocket Punch trigger, never Lightning Rod's setup.
    assert.equal(punch.triggeredBy, 'Electric Artillery');
    assert.ok(
      fighter.resolvedEvents
        .filter((event) => event.skillId === ID.ROCKET_PUNCH_MECH)
        .every((event) => event.triggeredBy !== 'Lightning Rod')
    );
    assert.equal(punch.coefficient, 1);
    assert.equal(punch.damageKind, 'explosion');
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
          event.type === 'control' && event.skillName === 'Rocket Punch (Mech)' && event.controlKind === 'defiance'
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
    assert.equal(mortarSteps[1].start - mortarSteps[0].start, 12800);
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
      selectedSkillIds: [63049, 5805, 63111, 63253, 63095],
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
    // Mech applications from every command share the concrete companion, independent of their skill ID.
    assert.ok(
      busterBurns.every((event) => event.summonOwner === 'engineer.mech' && event.independentConditionOwner === true)
    );
    const stochasticBuster = simulate('Mechanist', ['Overclock Signet', { type: 'wait', durationMs: 4000 }], {
      selectedSkillIds: [63049, 5805, 63111, 63253, 63095],
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
      selectedSkillIds: [63049, 5805, 63253, 63113, 63095],
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
    // Each companion follows its own impact rather than borrowing the other phase's timestamp.
    const skyPackets = sky.events.filter((event) => event.skillName === 'Sky Circus');
    const missile = skyPackets.find((event) => event.type === 'damage' && event.name === 'Missile Damage');
    const burning = skyPackets.find((event) => event.type === 'condition' && event.condition === 'Burning');
    const landing = skyPackets.find((event) => event.type === 'damage' && event.name === 'Landing Damage');
    const knockback = skyPackets.find((event) => event.type === 'control' && event.controlKind === 'knockback');
    assert.equal(burning.at, missile.at);
    assert.equal(knockback.at, landing.at);
    assert.ok(missile.eventOrder < burning.eventOrder);
    assert.ok(landing.eventOrder < knockback.eventOrder);

    const base = simulate('Mechanist', ['Puncturing Jab'], {
      target: { conditions: {} }
    });
    const standardSignetConfig = {
      selectedSkillIds: [63049, 5805, 63253, 63111, 63095],
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

    assertFlooredDamageMultiplier(strike(standardSigned).damage, strike(base).damage, 1.15);
    assertFlooredDamageMultiplier(strike(signed).damage, strike(base).damage, 1.18);

    const mechWithoutShift = simulate('Mechanist', ['Core Reactor Shot', { type: 'wait', durationMs: 1000 }], {
      ...standardSignetConfig,
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_BARRIER_ENGINE
      ],
      selectedSkillIds: standardSignetConfig.selectedSkillIds.filter((skill) => skill !== 63111),
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

    assertFlooredDamageMultiplier(mechStrike(mechWithShift).damage, mechStrike(mechWithoutShift).damage, 1.375);
    assert.equal(
      engineerProfession
        .resolveProfession({
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
    assert.equal(signetSteps[1].start - signetSteps[0].end, 18240);
  });
});
