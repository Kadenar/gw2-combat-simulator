import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerMechHasQuickness } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { patchTraitProfession } from '#tests/helpers/trait-patch.js';

const mechanistRechargeWork = engineerProfession.runtimeFor({ specialization: 'Mechanist' }).rechargeWork;

// Mechanist contracts cover signet passives, mech boon state, inheritance, and command effects.
const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
  selectedMorphSkillIds: [77103, 77203, 76954],
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
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
  assert.equal(damage({ strikeAdd: 0.05 }), damage({ strikeAdd: 0 }));
});

function mechanic(name) {
  return engineerCatalog.skills.find((candidate) => candidate.name === name);
}

for (const [signet, skillId, modifier, baseBonus, jDriveBonus] of [
  ['Force Signet', ID.FORCE_SIGNET, 'modifyStrikeDamage', 0.15, 0.18],
  ['Superconducting Signet', ID.SUPERCONDUCTING_SIGNET, 'modifyConditionDamage', 0.1, 0.12]
]) {
  test(`${signet} passive follows equipment, recharge, and J-Drive`, () => {
    const runtime = engineerProfession.runtimeFor({ specialization: 'Mechanist' });
    // Signet passives follow the live cooldown owner without relying on recorded actions.
    const clock = { time: 0 };
    const controller = createCooldownController({
      clock,
      skillFor: (id) => engineerCatalog.skillsById.get(id),
      rechargeDuration: () => 30
    });
    const timeline = createGw2TimelineIndex({ skillOnCooldown: (id, at) => controller.isOnCooldown(id, at) });
    for (const [selected, traits, time, expected] of [
      [false, [], 0, 1],
      [false, [TRAIT.MECH_CORE_J_DRIVE], 0, 1],
      [true, [], 0, 1 + baseBonus],
      [true, [], 2, 1],
      [true, [], 25, 1 + baseBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 0, 1 + jDriveBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 2, 1 + jDriveBonus],
      [true, [TRAIT.MECH_CORE_J_DRIVE], 25, 1 + jDriveBonus]
    ]) {
      clock.time = time;
      controller.resetAll();

      if (time > 0) controller.setReadyAt(skillId, 25);

      assert.equal(
        runtime.calculations[modifier](
          {
            catalog: engineerCatalog,
            config: {
              specialization: 'Mechanist',
              selectedSkillIds: selected
                ? [engineerCatalog.skills.find((candidate) => candidate.name === signet).id]
                : [],
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
  // J-Drive keeps the passive active while Overclock recharges.
  const context = {
    helpers: engineerCatalog,
    config: { selectedSkillIds: [63095] },
    skill: mechanic('Superconducting Signet'),
    cooldowns: new Map(),
    cooldownController: {
      readyAt: (id) => context.cooldowns.get(id),
      setReadyAt: (id, at) => context.cooldowns.set(id, at)
    },
    time: 0
  };
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 24);
  context.cooldownController.setReadyAt(ID.OVERCLOCK_SIGNET, 90);
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 30);
  context.config = { ...context.config, selectedTraitIds: [TRAIT.MECH_CORE_J_DRIVE] };
  assert.equal(mechanistRechargeWork(context, context.skill, 30), 22.8);
  context.skill = mechanic('Overclock Signet');
  assert.equal(mechanistRechargeWork(context, context.skill, 90), 90);
});

// Shift copies a player grant once at its original duration, even with direct party sharing disabled.
test('casting Shift Signet preserves earlier copies and skips new player boons until ready', () => {
  const run = createProfessionSimulator(engineerProfession);
  const quickness = [];
  const playerGrant = (at) => ({
    type: 'buff',
    kind: 'quickness',
    source: 'test',
    sourceId: 'self-boon',
    actorType: 'player',
    at,
    duration: 2,
    stacks: 1,
    fixedDuration: true,
    audience: { recipients: 'self' }
  });
  const result = run(
    [
      '__combat_start',
      { type: 'wait', durationMs: 1000 },
      'Shift Signet',
      { type: 'wait', durationMs: 2500 },
      { type: 'cooldown-reset' },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      specialization: 'Mechanist',
      selectedSkillIds: [ID.SHIFT_SIGNET],
      sharePlayerBoonsWithSummons: false,
      attributeInputs: baseAttributeInputs({ concentration: 750 }),
      boons: {}
    },
    {
      initialize(runtime) {
        for (const at of [0.25, 1.5, 4.5]) runtime.effects.emit({ kind: 'packet', event: playerGrant(at) });
      },
      probes: [1.25, 2.75, 4, 4.75].map((at) => [
        at,
        (runtime) => quickness.push(engineerMechHasQuickness(runtime.mechanics.queries, runtime.time))
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(quickness, [true, false, false, true]);
  const copies = result.events.filter((event) => event.type === 'buff' && event.sourceId === ID.SHIFT_SIGNET);
  assert.deepEqual(
    copies.map((event) => event.duration),
    [2, 2]
  );
  assert.ok(
    copies.every(
      (event) => !event.resolvedAudience.includesSelf && event.resolvedAudience.companionIds.includes('engineer.mech')
    )
  );
});

test('configured boons reach the mech on eligible console applications', () => {
  // Observe the opening grant, a missed refresh, readiness between refreshes, and the next application.
  const run = createProfessionSimulator(engineerProfession);
  const mech = { actor: 'companion', companionId: 'engineer.mech' };
  const rotation = [
    '__combat_start',
    { type: 'wait', durationMs: 1000 },
    'Shift Signet',
    { type: 'wait', durationMs: 13000 },
    { type: 'cooldown-reset' },
    { type: 'wait', durationMs: 7000 }
  ];
  for (const [selectedSkillIds, selectedTraitIds, expected] of [
    [[], [], [false, false, false, false]],
    [[ID.SHIFT_SIGNET], [], [true, false, false, true]],
    [[ID.SHIFT_SIGNET], [TRAIT.MECH_CORE_J_DRIVE], [true, true, true, true]]
  ]) {
    const observations = [];
    const result = run(
      selectedSkillIds.length ? rotation : [{ type: 'wait', durationMs: 21000 }],
      {
        specialization: 'Mechanist',
        selectedSkillIds,
        selectedTraitIds,
        boons: { might: 7, resistance: true },
        sharePlayerBoonsWithSummons: false
      },
      {
        probes: [1.5, 10.5, 14.5, 20.5].map((at) => [
          at,
          (runtime) => {
            const combat = runtime.mechanics.queries.combat;
            observations.push([
              combat.activeBoonStacks('might', runtime.time, 25, mech),
              combat.activeBoonStacks('resistance', runtime.time, 1, mech)
            ]);
          }
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      observations,
      expected.map((active) => (active ? [7, 1] : [0, 0]))
    );
  }
});

// Player party grants use the sharing flag. Mech party grants can reach their caster in a spare slot.
test('direct boons reach a mech without Shift according to source and party cap', () => {
  const run = createProfessionSimulator(engineerProfession);
  for (const [share, allies, playerGrant, mechGrant] of [
    [false, 0, false, true],
    [true, 0, true, true],
    [true, 4, false, false]
  ]) {
    const result = run(
      [{ type: 'wait', durationMs: 1000 }],
      {
        specialization: 'Mechanist',
        selectedSkillIds: [],
        allies: { count: allies },
        sharePlayerBoonsWithSummons: share
      },
      {
        initialize(runtime) {
          for (const actorType of ['player', 'summon'])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                kind: 'fury',
                stacks: 1,
                duration: 2,
                at: 0,
                source: 'test',
                sourceId: 'party-fury',
                actorType,
                ...(actorType === 'summon' ? { summonOwner: 'engineer.mech' } : {}),
                audience: { recipients: 'party', maximumRecipients: 5 }
              }
            });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const grants = result.events.filter((event) => event.sourceId === 'party-fury');
    for (const [actor, expected] of [
      ['player', playerGrant],
      ['summon', mechGrant]
    ]) {
      const grant = grants.find((event) => event.actorType === actor);
      assert.equal(grant.resolvedAudience.companionIds.includes('engineer.mech'), expected);
    }
  }
});

// The selected frame determines which of the player's attributes the mech inherits.
test('mech frames change inheritance only for their own attributes', () => {
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
  const attributes = (selectedTraitIds) =>
    engineerMechAttributes({ specialization: 'Mechanist', selectedTraitIds }, player, engineerCatalog);
  const base = attributes([]);
  for (const [frame, inherited] of [
    [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS, ['conditionDamage', 'expertise']],
    [TRAIT.MECH_FRAME_CHANNELING_CONDUITS, ['concentration', 'healingPower']],
    [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR, ['precision']]
  ]) {
    const enhanced = attributes([frame]);
    for (const key of Object.keys(base)) {
      if (inherited.includes(key)) assert.ok(enhanced[key] > base[key], key);
      else assert.equal(enhanced[key], base[key], key);
    }
  }
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
  const rollingBleeds = singleEdge.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Bleeding' &&
      ['Rolling Smash', 'Mech Arms: Single-Edge Cutters'].includes(event.skillName)
  );

  const cutterBleeds = rollingBleeds.filter((event) => event.skillName === 'Mech Arms: Single-Edge Cutters');

  assert.ok(cutterBleeds.length > 1);
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
  const highImpactProcs = highImpact.procSteps.filter((step) => step.skill === 'Mech Arms: High-Impact Drivers');

  assert.ok(highImpactProcs.length > 1);
  assert.ok(highImpactProcs.slice(1).every((step, index) => step.start - highImpactProcs[index].start > 1));

  const serratedSteel = simulate('Mechanist', ['Spark Revolver', { type: 'wait', durationMs: 2300 }], {
    selectedTraitIds: [
      TRAIT.SERRATED_STEEL,
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE
    ],
    attributeInputs: baseAttributeInputs({ precision: 4000 }),
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

  const meleeChain = simulate('Mechanist', [{ type: 'wait', durationMs: 4000 }], {
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
});

describe('Mechanist grandmaster active effects', () => {
  test('Mech Fighter adds Rocket Punch', () => {
    const fighter = simulate('Mechanist', ['Lightning Rod', 'Electric Artillery'], {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE
      ],
      target: { defiant: true, conditions: {} }
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
    const punchBreakdown = fighter.breakdown.find((entry) => entry.name === 'Rocket Punch (Mech)');

    assert.equal(punchBreakdown.skillId, ID.ROCKET_PUNCH_MECH);
    assert.equal(punchBreakdown.actorType, 'summon');
    const punchRow = skillBreakdownRows(fighter).find((row) => row.name === 'Rocket Punch (Mech)');

    assert.equal(punchRow.skillId, ID.ROCKET_PUNCH_MECH);
    assert.equal(punchRow.actorType, 'summon');
    assert.equal(punchRow.group, 'Entities');
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
    assert.equal(dynamo.events.filter((event) => event.type === 'buff' && event.kind === 'quickness').length, 2);
    const mortar = dynamo.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Jade Mortar');

    assert.equal(mortar.actorType, 'summon');

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

    assert.ok(buster.length > 0);
    assert.ok(buster.every((event) => event.actorType === 'summon'));
    assert.equal(new Set(buster.map((event) => event.activationId)).size, 1);
    assert.equal(busterBurns.length, buster.length);
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
        .calculations.modifyConditionDamage(
          {
            config: jDriveConfig,
            catalog: engineerCatalog,
            time: 0
          },
          1
        ),
      1.12
    );
    const signetRecharge = simulate('Mechanist', ['Force Signet', 'Force Signet'], jDriveConfig);
    const signetSteps = signetRecharge.steps.filter((step) => step.skillName === 'Force Signet');
    assert.equal(signetSteps[1].start - signetSteps[0].end, 18240);
  });
});

test('Mechanist registered recharge owners read preview values and preserve Overclock eligibility', () => {
  // Command and signet recharge use their selected trait profiles; Overclock cannot reduce itself.
  const family = patchTraitProfession(engineerProfession, {
    balanceProfiles: {
      [TRAIT.MECH_CORE_JADE_DYNAMO]: { fields: { rechargeMultiplier: 0.5 } },
      [TRAIT.MECH_CORE_J_DRIVE]: { fields: { rechargeMultiplier: 0.6 } }
    }
  });
  const runtime = family.runtimeFor({ specialization: 'Mechanist', patchId: 's4-preview' });
  const context = {
    helpers: runtime.catalog,
    config: {
      selectedSkillIds: [63095],
      selectedTraitIds: [TRAIT.MECH_CORE_JADE_DYNAMO, TRAIT.MECH_CORE_J_DRIVE]
    },
    cooldowns: new Map([[ID.OVERCLOCK_SIGNET, 90]]),
    cooldownController: { readyAt: (id) => context.cooldowns.get(id) },
    time: 1
  };
  const skill = (id) => runtime.catalog.skillsById.get(id);
  assert.equal(runtime.rechargeWork(context, skill(ID.JADE_MORTAR), 30), 15);
  assert.equal(runtime.rechargeWork(context, skill(ID.SUPERCONDUCTING_SIGNET), 30), 18);
  assert.equal(runtime.rechargeWork(context, skill(ID.OVERCLOCK_SIGNET), 90), 90);
  context.config.selectedTraitIds = [];
  assert.equal(runtime.rechargeWork(context, skill(ID.SUPERCONDUCTING_SIGNET), 30), 30);
});
