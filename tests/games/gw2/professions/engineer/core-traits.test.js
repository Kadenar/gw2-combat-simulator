import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Core trait contracts cover proc triggers, attribute modifiers, and Tools interactions.
const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
  selectedMorphSkillIds: [76568, 76959, 76693],
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

test('Shred projectiles trigger one Aim-Assisted Rocket', () => {
  const skillId = ID.OFFENSIVE_PROTOCOL_SHRED;
  const result = simulate('Amalgam', [{ name: 'Offensive Protocol: Shred', skillId }], {
    selectedMorphSkillIds: [skillId],
    selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET]
  });
  assert.deepEqual(result.warnings, []);
  const disks = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Offensive Protocol: Shred'
  );
  assert.equal(disks.length, 3);
  assert.ok(disks.every((event) => event.projectile === true));
  const rockets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );
  assert.equal(rockets.length, 1);
  assert.ok(rockets[0].at > disks[0].at);
});

test('generated rocket explosions can trigger Shrapnel', () => {
  // Shred itself is not an explosion; a guaranteed proc isolates the generated rocket's eligibility.
  const result = simulate(
    'Amalgam',
    [
      { name: 'Offensive Protocol: Shred', skillId: 76568 },
      { type: 'wait', durationMs: 100 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET, TRAIT.SHRAPNEL],
      attributeInputs: baseAttributeInputs({ expertise: 750, concentration: 1500 }),
      procRateOverrides: { 'engineer.shrapnel': 1 }
    }
  );
  assert.deepEqual(result.warnings, []);
  const bleed = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Shrapnel' && event.condition === 'Bleeding'
  );
  assert.equal(bleed.length, 1);
  assert.equal(bleed[0].triggeredBy, 'Aim-Assisted Rocket');
  assert.equal(bleed[0].stacks, 1);
  assert.equal(bleed[0].effectiveDuration, 9);
  // Both effects share the proc; Crippled uses condition duration and participates in target state.
  const crippled = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.SHRAPNEL && event.condition === 'Crippled'
  );
  assert.equal(crippled.length, 1);
  assert.equal(crippled[0].at, bleed[0].at);
  assert.equal(crippled[0].effectiveDuration, 1.5);
  assert.equal(crippled[0].ownerActorType, 'player');
  assert.ok(bleed[0].procActivation);
  assert.equal(crippled[0].procActivation.id, bleed[0].procActivation.id);
  const runtime = observedRuntime(result);
  assert.equal(runtime.combat.targetConditionStacks('Crippled', crippled[0].at), 1);
  assert.equal(runtime.combat.targetConditionStacks('Crippled', crippled[0].at + 1.52), 0);
  assert.ok(
    result.effectReport.tracks.some(
      (track) => track.kind === 'Crippled' && track.category === 'condition' && track.recipient === 'target'
    )
  );
});

test('Shrapnel uses reproducible seeded rolls in both modes and honors chance overrides', () => {
  // Compare each explosion's outcome, not averaged proc counts; weapon-strength rolls must not shift this stream.
  const signature = (mode, seed, chance = 0.33) => {
    const result = simulate('Core', ['Grenade Kit', 'Grenade', 'Grenade', { type: 'wait', durationMs: 100 }], {
      selectedTraitIds: [TRAIT.SHRAPNEL],
      randomness: { mode, seed },
      procRateOverrides: { 'engineer.shrapnel': chance }
    });
    assert.deepEqual(result.warnings, []);
    const explosions = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Grenade'
    );
    const bleeds = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Shrapnel' && event.condition === 'Bleeding'
    );
    const cripples = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Shrapnel' && event.condition === 'Crippled'
    );
    assert.deepEqual(
      cripples.map((event) => event.at),
      bleeds.map((event) => event.at)
    );
    const random = createSimulationRandom({ mode, seed });
    const expected = explosions.filter(() => random.roll(chance, 'engineer.shrapnel'));
    assert.deepEqual(
      bleeds.map((event) => event.at),
      expected.map((event) => event.at)
    );
    return bleeds.map((event) => event.at);
  };

  const first = signature('deterministic', 1);
  assert.ok(first.length > 0);
  for (const mode of ['deterministic', 'stochastic']) {
    assert.deepEqual(signature(mode, 1), first);
    assert.notDeepEqual(signature(mode, 42), first);
    assert.deepEqual(signature(mode, 1, 0), []);
    assert.equal(signature(mode, 1, 1).length, 6);
  }
});

test('Serrated Steel counts critical projectile and effect hits without an explosion requirement', () => {
  const config = {
    attributeInputs: baseAttributeInputs({ precision: 3100 }),
    selectedTraitIds: [TRAIT.SERRATED_STEEL]
  };
  const rotation = [{ name: 'Offensive Protocol: Shred', skillId: 76568 }];
  const withoutRocket = simulate('Amalgam', rotation, config);
  const withRocket = simulate('Amalgam', rotation, {
    ...config,
    selectedTraitIds: [...config.selectedTraitIds, TRAIT.AIM_ASSISTED_ROCKET]
  });
  // Guaranteed critical disks and the rocket share the trait's seeded secondary proc stream.
  const serrated = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === 'Serrated Steel');
  assert.equal(serrated(withoutRocket).length, 1);
  assert.equal(serrated(withRocket).length, 2);
  assert.equal(serrated(withRocket)[0].stacks, 1);
});

test('Electric Artillery and Devastator each contribute their explosion to Shrapnel', () => {
  for (const [name, attacks] of [
    ['Electric Artillery', ['Lightning Rod', { type: 'wait', durationMs: 4500 }, 'Electric Artillery']],
    ['Devastator', ['Conduit Surge', 'Devastator', { type: 'wait', durationMs: 1000 }]]
  ]) {
    // Guaranteed rolls isolate the spear explosion; focused follow-ups must not gain Shrapnel eligibility.
    const result = simulate(
      'Core',
      attacks,
      { selectedTraitIds: [TRAIT.SHRAPNEL], procRateOverrides: { 'engineer.shrapnel': 1 } },
      // Observe the explosion after the projectile has left the cast lane.
      { kind: 'tail', durationMs: 1000 }
    );
    assert.deepEqual(result.warnings, []);
    const bleeds = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Shrapnel' && event.condition === 'Bleeding'
    );
    assert.equal(bleeds.length, 1, name);
    assert.equal(bleeds[0].triggeredBy, name);
  }
});

test('Aim-Assisted Rocket calls an orbital strike after four rockets', () => {
  const result = simulate(
    'Core',
    [
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 3000 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} }
    }
  );
  const rockets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );
  const orbital = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Orbital Command Strike'
  );

  assert.equal(rockets.length, 4);
  assert.equal(result.procSteps.filter((step) => step.skill === 'Aim-Assisted Rocket').length, 4);
  assert.equal(result.procSteps.filter((step) => step.skill === 'Orbital Command Strike').length, 1);
  assert.ok(rockets.every((event) => event.sourceId === ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL));
  assert.equal(orbital.sourceId, ID.ORBITAL_COMMAND_STRIKE);
  assert.ok(orbital.at > rockets.at(-1).at);

  const rifleProjectiles = simulate(
    'Core',
    // Overcharged Shot replaces the next rifle attack with Rocket Burst.
    ['Overcharged Shot', { type: 'wait', durationMs: 2600 }, 'Rocket Burst', { type: 'wait', durationMs: 4000 }],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} }
    }
  );
  const overcharged = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Overcharged Shot'
  );
  const rifleVolley = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Rocket Burst'
  );
  const rifleRockets = rifleProjectiles.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );

  assert.deepEqual(rifleProjectiles.warnings, []);
  assert.equal(rifleRockets.length, 2);
  assert.ok(rifleRockets[0].at > overcharged.at);
  assert.ok(rifleRockets[1].at > rifleVolley.at);

  for (const command of ['Spark Revolver', 'Core Reactor Shot', 'Jade Mortar']) {
    const mechProjectile = simulate('Mechanist', [command, { type: 'wait', durationMs: 4000 }], {
      selectedTraitIds: [
        TRAIT.AIM_ASSISTED_ROCKET,
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO
      ],
      target: { conditions: {} }
    });
    const rocket = mechProjectile.resolvedEvents.find(
      (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
    );

    assert.equal(rocket, undefined, `${command} must not trigger the player-owned trait proc`);
  }

  const fielded = simulate(
    'Core',
    [
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Grenade',
      { type: 'wait', durationMs: 2500 },
      'Bomb Kit',
      'Fire Bomb',
      'Grenade Kit',
      'Grenade',
      { type: 'wait', durationMs: 4000 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      selectedSkillIds: [5857, 5812, 5805, 5933, 5868],
      relic: 'Bloodstone',
      target: { conditions: {} }
    }
  );

  assert.ok(
    fielded.procSteps.some(
      (step) => step.skill === 'Bloodstone Volatility' && step.sourceSkill === 'Orbital Command Strike'
    )
  );
});

// Lower target health increases both bonuses granted by the Firearms traits.
test('High Caliber and Heavy Metal scale criticals with target health', () => {
  const heavy = [0.8, 0.7, 0.4, 0.2].map((startingHealthFraction) => {
    const result = simulate('Core', ['Puncturing Jab'], {
      selectedTraitIds: [TRAIT.HIGH_CALIBER, TRAIT.HEAVY_METAL],
      attributeInputs: baseAttributeInputs({ precision: 1000, ferocity: 0 }),
      target: { health: 1_000_000, startingHealthFraction, conditions: {} }
    });
    const hit = result.resolvedEvents.find((event) => event.type === 'damage');

    return [hit.criticalChance, hit.criticalDamage];
  });

  for (let tier = 1; tier < heavy.length; tier++) {
    assert.ok(heavy[tier][0] > heavy[tier - 1][0]);
    assert.ok(heavy[tier][1] > heavy[tier - 1][1]);
  }
});

test('No Scope increases critical damage on subsequent grenade hits', () => {
  const noScope = simulate('Core', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.NO_SCOPE],
    attributeInputs: baseAttributeInputs({ precision: 4000, ferocity: 0 }),
    target: { conditions: {} }
  });
  const noScopeHits = noScope.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Grenade');

  assert.equal(noScope.procSteps.filter((step) => step.skill === 'No Scope').length, 1);
  assert.ok(noScopeHits[1].criticalDamage > noScopeHits[0].criticalDamage);
});

test('Chemical Rounds extends every pistol condition beyond the condition-duration cap', () => {
  // At +100% condition duration, each pistol condition must still gain the trait's separate 4/3 base multiplier.
  const conditionDuration = (skillName, condition, selectedTraitIds) => {
    const result = simulate('Core', [skillName], {
      selectedTraitIds,
      attributeInputs: baseAttributeInputs({ expertise: 1500 }),
      target: { conditions: {} }
    });
    const application = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === condition
    );

    return application.effectiveDuration;
  };

  const pistolConditions = [
    ['Fragmentation Shot', 'Bleeding'],
    ['Poison Dart Volley', 'Poisoned'],
    ['Static Shot', 'Confusion'],
    ['Glue Shot', 'Crippled'],
    ['Glue Shot', 'Immobilized'],
    ['Blowtorch', 'Burning']
  ];

  for (const [skillName, condition] of pistolConditions) {
    const base = conditionDuration(skillName, condition, []);
    const chemical = conditionDuration(skillName, condition, [TRAIT.CHEMICAL_ROUNDS]);

    assert.ok(Math.abs(chemical - Math.round(((base * 4) / 3) * 1000) / 1000) < 1e-12, `${skillName} - ${condition}`);
  }
});

// Player grenades and Jade Cannons mech attacks both trigger Incendiary Powder.
function simulateMechanistTraitConditions() {
  const result = simulate('Mechanist', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 2500 }], {
    selectedSkillIds: [63049, 5805, 6161, 5933, 63095],
    selectedTraitIds: [
      TRAIT.INCENDIARY_POWDER,
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    attributeInputs: baseAttributeInputs({ precision: 4000, expertise: 0 }),
    target: { conditions: {} }
  });
  const burning = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Burning' && event.sourceId === TRAIT.INCENDIARY_POWDER
  );
  return { result, burning };
}

test('Incendiary Powder tracks player and mech cooldowns independently', () => {
  const { burning } = simulateMechanistTraitConditions();

  // The same trait credits the player and the mech separately when both trigger it.
  assert.deepEqual(burning.map((event) => event.actorType).sort(), ['effect', 'summon']);
  assert.ok(burning.every((event) => Math.abs(event.naturalExpiresAt - event.at - 10.64) < 1e-12));
});

test('Mechanist assigns mech ownership only to mech trait conditions', () => {
  const { result, burning } = simulateMechanistTraitConditions();
  const playerBurn = burning.find((event) => event.actorType === 'effect');
  const mechBurn = burning.find((event) => event.actorType === 'summon');
  assert.equal(playerBurn?.ownerActorType, 'player');
  assert.equal(playerBurn.summonOwner, undefined);
  const vulnerability = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.MECH_ARMS_JADE_CANNONS
  );
  for (const application of [mechBurn, vulnerability]) {
    assert.equal(application?.summonOwner, 'engineer.mech');
    assert.equal(application.independentConditionOwner, true);
    assert.equal(application.summonInheritsAttributes, true);
  }
});

// Optimized Activation responds to skills that occupy a tool-belt slot.
test('Optimized Activation distinguishes tool-belt replacements from Forge entry', () => {
  const scrapperToolbelt = simulate('Scrapper', ['Function Gyro'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });
  const forgeMechanic = simulate('Holosmith', ['Engage Photon Forge'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });

  assert.equal(
    scrapperToolbelt.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    true
  );
  assert.equal(
    forgeMechanic.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    false
  );

  const amalgamToolbelt = simulate('Amalgam', [76640, 'Evolve', 'Dodge'], {
    selectedMorphSkillIds: [76640, 76705, 76568],
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.OPTIMIZED_ACTIVATION, TRAIT.ADRENAL_IMPLANT]
  });

  assert.equal(
    amalgamToolbelt.events.filter(
      (event) => event.type === 'buff' && event.kind === 'vigor' && event.sourceId === TRAIT.OPTIMIZED_ACTIVATION
    ).length,
    2
  );
});

test('Takedown Round adds strike damage only after endurance is spent', () => {
  // The focused ratio protects the trait condition without depending on a saved benchmark rotation.
  const full = simulate('Core', ['Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });
  const spent = simulate('Core', ['Dodge', 'Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });

  assertFlooredDamageMultiplier(spent.strikeDamage, full.strikeDamage, 1.1);
});

test('Energy Amplifier adds Power and Healing Power during regeneration', () => {
  const context = {
    config: {
      selectedTraitIds: [TRAIT.ENERGY_AMPLIFIER],
      boons: { regeneration: true }
    },
    time: 0
  };
  const attributes = engineerProfession
    .resolveProfession({
      specialization: 'Core'
    })
    .calculations.modifyAttributes(
      { catalog: engineerCatalog, ...context },
      {
        power: 2000,
        precision: 1000,
        toughness: 1000,
        vitality: 1000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0,
        concentration: 0,
        healingPower: 500
      }
    );

  assert.equal(attributes.power, 2250);
  assert.equal(attributes.healingPower, 750);
});

// Boiling Point reads Might after the triggering application and shares one ICD across Might sources.
test('Boiling Point grants Fury from Might gains at the threshold on its ICD', () => {
  const traitFury = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'buff' && event.sourceId === TRAIT.BOILING_POINT)
      .map((event) => [event.at, event.kind]);

  const belowThreshold = simulate('Core', ['Positive Strike'], { selectedTraitIds: [TRAIT.BOILING_POINT] });

  assert.deepEqual(traitFury(belowThreshold), []);

  const result = simulate(
    'Core',
    ['Blunderbuss', 'Positive Strike', { type: 'wait', durationMs: 1000 }, 'Negative Bash', 'Equalizing Blow'],
    { selectedTraitIds: [TRAIT.BOILING_POINT] }
  );
  const mightAt = (skillId) =>
    result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === 'might' && event.sourceId === skillId)
      .at;

  assert.equal(result.warnings.length, 0);
  // Blunderbuss reaches the threshold by itself, Positive Strike lands inside the ICD, and Equalizing Blow procs again.
  assert.deepEqual(traitFury(result), [
    [mightAt(ID.BLUNDERBUSS), 'fury'],
    [mightAt(ID.EQUALIZING_BLOW), 'fury']
  ]);
  assert.ok(mightAt(ID.POSITIVE_STRIKE) - mightAt(ID.BLUNDERBUSS) < 1);
});

// Equal and Opposite Reaction reacts only to the player's own disables and claims one ICD per multi-control skill.
test('Equal and Opposite Reaction grants Quickness and Stability from player disables on its ICD', () => {
  const result = simulate(
    'Core',
    [
      'Essence of Borrowed Time',
      { type: 'wait', durationMs: 1000 },
      'Supply Crate',
      { type: 'wait', durationMs: 1000 },
      'Overcharged Shot'
    ],
    { selectedTraitIds: [TRAIT.EQUAL_AND_OPPOSITE_REACTION] }
  );
  const grants = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.EQUAL_AND_OPPOSITE_REACTION
  );
  const castEnd = (skill) => result.steps.find((step) => step.skillName === skill).end / 1000;

  assert.equal(result.warnings.length, 0);
  // Borrowed Time's simultaneous daze and stun share one ICD claim; Supply Crate's stun belongs to the summon.
  assert.deepEqual(
    grants.map((event) => [event.at, event.kind, event.duration]),
    [
      [castEnd('Essence of Borrowed Time'), 'quickness', 5],
      [castEnd('Essence of Borrowed Time'), 'stability', 5],
      [castEnd('Overcharged Shot'), 'quickness', 5],
      [castEnd('Overcharged Shot'), 'stability', 5]
    ]
  );
});

// The profile owns offsets and repetitions; ordinary toolbelts still trigger at their completion boundary.
test('Optimized Activation materializes delayed repeated Vigor and respects effect removal', () => {
  for (const effects of [
    [],
    [
      {
        type: 'boon',
        name: 'vigor',
        boon: 'vigor',
        duration: 4,
        stacks: 1,
        atMs: 500,
        applications: 2,
        intervalMs: 200
      }
    ]
  ]) {
    const result = runEngineer(
      ['Regenerating Mist', { type: 'wait', durationMs: 1500 }],
      {
        ...baseConfig,
        selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
      },
      {
        extend: (native) => ({
          catalog: effects.length
            ? withProfile(native.catalog, TRAIT.OPTIMIZED_ACTIVATION, { effects })
            : applyBalanceProfilePatch(native.catalog, {
                balanceProfiles: { [TRAIT.OPTIMIZED_ACTIVATION]: { removeEffects: [{ type: 'boon', all: true }] } }
              })
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const boons = result.events.filter((event) => event.sourceId === TRAIT.OPTIMIZED_ACTIVATION);
    assert.deepEqual(
      boons.map((event) => event.at),
      effects.length
        ? [0.5, 0.7].map((offset) => gw2Time(result.events.find((event) => event.type === 'action').endsAt + offset))
        : []
    );
  }
});
