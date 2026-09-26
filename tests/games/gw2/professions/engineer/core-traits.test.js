import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { assertFlooredDamageMultiplier, assertRoundedDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

// Core trait contracts cover proc triggers, attribute modifiers, and Tools interactions.
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

test('Explosives and Firearms traits materialize offensive effects', () => {
  const result = simulate('Amalgam', ['Grenade Kit', 'Shrapnel Grenade'], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    stats: {
      precision: 2500,
      expertise: 0
    },
    boons: { fury: true },
    selectedTraitIds: [
      TRAIT.EXPLOSIVE_ENTRANCE,
      TRAIT.STEEL_PACKED_POWDER,
      TRAIT.AIM_ASSISTED_ROCKET,
      TRAIT.SHRAPNEL,
      TRAIT.SERRATED_STEEL,
      TRAIT.HEMATIC_FOCUS,
      TRAIT.CHEMICAL_ROUNDS,
      TRAIT.THERMAL_VISION,
      TRAIT.MODIFIED_AMMUNITION,
      TRAIT.INCENDIARY_POWDER
    ]
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Explosive Entrance').length,
    1
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket').length,
    1
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.name === 'Shrapnel — Bleeding'));
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'condition' && event.name === 'Incendiary Powder — Burning')
  );
  assert.ok(observedRuntime(result).profession.core.traitProcReadyAt.thermalVisionUntil > 0);
});

test('Explosives traits use the requested packets, gates, and health modifiers', () => {
  const grenadier = simulate('Core', ['Healing Turret'], {
    selectedTraitIds: [TRAIT.GRENADIER]
  });
  const lesserBarrage = grenadier.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Lesser Grenade Barrage'
  );

  assert.equal(lesserBarrage.length, 6);
  assert.ok(
    lesserBarrage.every((event) => event.coefficient === 0.5 && event.totalHits === 6 && event.explosion === true)
  );

  const entrance = simulate('Core', ['Grenade Kit', 'Grenade', 'Dodge', 'Grenade'], {
    selectedTraitIds: [TRAIT.EXPLOSIVE_ENTRANCE, TRAIT.GRAND_ENTRANCE]
  });

  assert.equal(
    entrance.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Explosive Entrance').length,
    2
  );
  assert.ok(entrance.procSteps.some((step) => step.skill === 'Grand Entrance'));

  const explosionTraits = simulate(
    'Core',
    ['Grenade Kit', 'Grenade', 'Shrapnel Grenade', { type: 'wait', durationMs: 100 }],
    {
      selectedTraitIds: [TRAIT.SHORT_FUSE, TRAIT.STEEL_PACKED_POWDER, TRAIT.EXPLOSIVE_TEMPER, TRAIT.SHRAPNEL],
      stats: { precision: 1000, ferocity: 0 },
      target: { conditions: {} }
    }
  );

  assert.equal(explosionTraits.procSteps.filter((step) => step.skill === 'Short Fuse').length, 1);
  assert.ok(explosionTraits.procSteps.filter((step) => step.skill === 'Explosive Temper').length >= 3);
  assert.ok(
    explosionTraits.resolvedEvents.some(
      (event) => event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Shrapnel'
    )
  );
  const grenadePackets = explosionTraits.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Grenade'
  );

  assert.equal(grenadePackets[0].criticalDamage, 1.5);
  assert.equal(grenadePackets[1].criticalDamage, 1.5 + 20 / 1500);

  const noModifiers = simulate('Core', ['Puncturing Jab'], {
    stats: { precision: 1000, ferocity: 0 },
    target: { health: 1_000_000, startingHealthFraction: 0.5, conditions: { Vulnerability: 10 } }
  });
  const modifiers = simulate('Core', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.SHAPED_CHARGE, TRAIT.BIG_BOOMER],
    stats: { precision: 1000, ferocity: 0 },
    target: { health: 1_000_000, startingHealthFraction: 0.5, conditions: { Vulnerability: 10 } }
  });
  const firstStrike = (result) => result.resolvedEvents.find((event) => event.type === 'damage');

  assertFlooredDamageMultiplier(firstStrike(modifiers).damage, firstStrike(noModifiers).damage, 1.07 * 1.05 * 1.15);
});

test('each Shred slot emits projectile hits that trigger one Aim-Assisted Rocket', () => {
  // One three-disk cast must grant one rocket opportunity regardless of the equipped morph slot.
  for (const skillId of [
    ID.OFFENSIVE_PROTOCOL_SHRED,
    ID.OFFENSIVE_PROTOCOL_SHRED_ID_76866,
    ID.OFFENSIVE_PROTOCOL_SHRED_ID_77103
  ]) {
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
    assert.ok(Math.abs(rockets[0].at - disks[0].at - 0.04) < 1e-12);
  }
});

test('generated rocket explosions can trigger Shrapnel', () => {
  // Shred itself is not an explosion; a guaranteed proc isolates the generated rocket's eligibility.
  const result = simulate(
    'Amalgam',
    [
      { name: 'Offensive Protocol: Shred', skillId: 77103 },
      { type: 'wait', durationMs: 100 }
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET, TRAIT.SHRAPNEL],
      procRateOverrides: { 'engineer.shrapnel': 1 }
    }
  );
  assert.deepEqual(result.warnings, []);
  const bleed = result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === 'Shrapnel');
  assert.equal(bleed.length, 1);
  assert.equal(bleed[0].triggeredBy, 'Aim-Assisted Rocket');
  assert.equal(bleed[0].stacks, 1);
  assert.equal(bleed[0].duration, 6);
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
      (event) => event.type === 'condition' && event.skillName === 'Shrapnel'
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
  const config = { stats: { precision: 3100 }, selectedTraitIds: [TRAIT.SERRATED_STEEL] };
  const rotation = [{ name: 'Offensive Protocol: Shred', skillId: 77103 }];
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
      (event) => event.type === 'condition' && event.skillName === 'Shrapnel'
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
  assert.ok(
    rockets.every(
      (event) =>
        event.coefficient === 1 &&
        event.explosion === true &&
        event.actorType === 'effect' &&
        event.sourceId === ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL &&
        event.weaponStrengthProfileId === 'nonweapon.unequipped' &&
        event.resolvedWeaponStrength === 690.5
    )
  );
  assert.equal(orbital.coefficient, 1.92);
  assert.equal(orbital.comboFinishers[0].ownerId, 'engineer');
  assert.equal(orbital.comboFinishers[0].finisherType, 'Blast');
  assert.equal(orbital.comboFinishers[0].chance, 1);
  assert.equal(orbital.explosion, false);
  assert.equal(orbital.actorType, 'effect');
  assert.equal(orbital.sourceId, ID.ORBITAL_COMMAND_STRIKE);
  assert.equal(orbital.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(orbital.resolvedWeaponStrength, 690.5);

  const rifleProjectiles = simulate(
    'Core',
    ['Overcharged Shot', { type: 'wait', durationMs: 2600 }, 'Rifle Burst', { type: 'wait', durationMs: 4000 }],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} }
    }
  );
  const overcharged = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Overcharged Shot'
  );
  const rifleGrenade = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Rifle Burst Grenade'
  );
  const rifleRockets = rifleProjectiles.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket'
  );

  assert.equal(rifleRockets.length, 2);
  assert.ok(Math.abs(rifleRockets[0].at - overcharged.at - 0.04) < 1e-12);
  assert.ok(Math.abs(rifleRockets[1].at - rifleGrenade.at - 0.04) < 1e-12);

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
      selectedSkills: ['Healing Turret', 'Bomb Kit', 'Grenade Kit', 'Elixir Gun', 'Supply Crate'],
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

test('Firearms traits apply critical tiers, durations, procs, and Power bleeding', () => {
  const heavy = [0.8, 0.7, 0.4, 0.2].map((startingHealthFraction) => {
    const result = simulate('Core', ['Puncturing Jab'], {
      selectedTraitIds: [TRAIT.HIGH_CALIBER, TRAIT.HEAVY_METAL],
      stats: { precision: 1000, ferocity: 0 },
      target: { health: 1_000_000, startingHealthFraction, conditions: {} }
    });
    const hit = result.resolvedEvents.find((event) => event.type === 'damage');

    return [hit.criticalChance, hit.criticalDamage];
  });

  assert.deepEqual(heavy, [
    [0.2, 1.5],
    [0.25, 1.5750000000000002],
    [0.30000000000000004, 1.6500000000000001],
    [0.35, 1.7249999999999999]
  ]);

  const bleed = (selectedTraitIds) =>
    simulate('Core', ['Puncturing Jab', { type: 'wait', durationMs: 2000 }], {
      selectedTraitIds,
      stats: {
        power: 2000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      },
      target: { conditions: {} }
    }).resolvedEvents.find(
      (event) => event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Puncturing Jab'
    );
  const baseBleed = bleed([]);
  const serratedBleed = bleed([TRAIT.SERRATED_STEEL]);
  const powerBleed = bleed([TRAIT.SHARPSHOOTER]);

  // Duration bonuses apply before rounding the natural lifetime to whole milliseconds.
  assert.equal(serratedBleed.effectiveDuration, 7.98);
  // Check a complete buffer interval so partial-packet rounding cannot distort the trait formula.
  assert.equal(baseBleed.damageTicks.find((tick) => tick.fraction === 1).damage, 82);
  assert.equal(powerBleed.damageTicks.find((tick) => tick.fraction === 1).damage, 102);

  const noScope = simulate('Core', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.NO_SCOPE],
    stats: { precision: 4000, ferocity: 0 },
    target: { conditions: {} }
  });
  const noScopeHits = noScope.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Grenade');

  assert.equal(noScope.procSteps.filter((step) => step.skill === 'No Scope').length, 1);
  assert.equal(noScopeHits[0].criticalDamage, 1.5);
  assert.equal(noScopeHits[1].criticalDamage, 1.6);

  const bloodTraits = simulate('Core', ['Grenade Kit', 'Shrapnel Grenade', { type: 'wait', durationMs: 100 }], {
    selectedTraitIds: [TRAIT.SANGUINE_ARRAY, TRAIT.HEMATIC_FOCUS]
  });

  assert.ok(bloodTraits.procSteps.some((step) => step.skill === 'Sanguine Array'));
  assert.equal(bloodTraits.procSteps.filter((step) => step.skill === 'Hematic Focus').length, 1);

  const pistolBurn = (selectedTraitIds) =>
    simulate('Core', ['Blowtorch', { type: 'wait', durationMs: 1500 }], {
      selectedTraitIds,
      stats: {
        precision: 1000,
        conditionDamage: 1000,
        expertise: 0
      },
      target: { conditions: {} }
    }).resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Burning');
  const baseBurn = pistolBurn([]);
  const chemicalBurn = pistolBurn([TRAIT.CHEMICAL_ROUNDS]);
  const thermalBurn = pistolBurn([TRAIT.THERMAL_VISION]);

  assert.equal(chemicalBurn.effectiveDuration, Math.round(((baseBurn.duration * 4) / 3) * 1000) / 1000);
  assertRoundedDamageMultiplier(thermalBurn.damageTicks[0].damage, baseBurn.damageTicks[0].damage, 1.05);

  const ammunitionBase = simulate('Core', ['Puncturing Jab'], {
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 }
    }
  });
  const ammunition = simulate('Core', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.MODIFIED_AMMUNITION],
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 }
    }
  });

  assertFlooredDamageMultiplier(
    ammunition.resolvedEvents.find((event) => event.type === 'damage').damage,
    ammunitionBase.resolvedEvents.find((event) => event.type === 'damage').damage,
    1.03
  );
});

test('Chemical Rounds extends every pistol condition beyond the condition-duration cap', () => {
  // At +100% condition duration, each pistol condition must still gain the trait's separate 4/3 base multiplier.
  const conditionDuration = (skillName, condition, selectedTraitIds) => {
    const result = simulate('Core', [skillName], {
      selectedTraitIds,
      stats: { expertise: 1500 },
      target: { conditions: {} }
    });
    const application = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === condition
    );

    return application.naturalExpiresAt - application.at;
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

    assert.ok(Math.abs(chemical - Math.round(((base * 4) / 3) * 1000) / 1000) < 1e-12, `${skillName} — ${condition}`);
  }
});

test('Incendiary Powder tracks player and mech cooldowns independently', () => {
  const result = simulate('Mechanist', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 2500 }], {
    selectedSkills: ['Rectifier Signet', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Overclock Signet'],
    selectedTraitIds: [
      TRAIT.INCENDIARY_POWDER,
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      TRAIT.MECH_CORE_JADE_DYNAMO
    ],
    stats: { precision: 4000, expertise: 0 },
    target: { conditions: {} }
  });
  const burning = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Burning' && event.skillName === 'Incendiary Powder'
  );

  assert.deepEqual(
    burning.map((event) => event.actorType),
    ['effect', 'summon']
  );
  assert.ok(burning.every((event) => Math.abs(event.naturalExpiresAt - event.at - 10.64) < 1e-12));
});

test('Tools traits materialize tool-belt, dodge, kit, and battery behavior', () => {
  const amalgamReplacementToolbeltSkills = Object.values(AMALGAM_SKILL_MECHANICS).filter(
    (mechanics) => Number(mechanics.mechanicSlot) >= 2 && Number(mechanics.mechanicSlot) <= 5
  );

  assert.ok(amalgamReplacementToolbeltSkills.length > 0);
  assert.ok(amalgamReplacementToolbeltSkills.every((mechanics) => mechanics.countsAsToolbeltSkill === true));

  const quickDodge = simulate('Core', ['Dodge'], { boons: { quickness: true } });

  assert.equal(quickDodge.steps[0].end - quickDodge.steps[0].start, 800);

  const toolbelt = simulate(
    'Core',
    ['Regenerating Mist', 'Grenade Barrage', 'Mine Field', 'Healing Mist', 'Med Pack Drop'],
    {
      selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION, TRAIT.STATIC_DISCHARGE, TRAIT.KINETIC_BATTERY],
      stats: { precision: 4000, ferocity: 0 },
      target: { conditions: {} }
    }
  );

  assert.equal(toolbelt.events.filter((event) => event.type === 'buff' && event.kind === 'vigor').length, 6);
  assert.equal(
    toolbelt.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Static Discharge').length,
    6
  );
  const dischargeProcs = toolbelt.procSteps.filter((step) => step.skill === 'Static Discharge');

  assert.equal(dischargeProcs.length, 6);
  assert.equal(dischargeProcs[0].sourceSkill, 'Regenerating Mist');
  const discharge = toolbelt.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Static Discharge'
  );
  const dischargeSkill = engineerCatalog.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL);
  const dischargeRow = skillBreakdownRows(toolbelt).find((row) => row.name === 'Static Discharge');

  assert.equal(discharge.coefficient, 0.33);
  assert.equal(discharge.skillId, ID.STATIC_DISCHARGE_TRAIT_SKILL);
  assert.equal(discharge.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(discharge.resolvedWeaponStrength, 690.5);
  assert.equal(discharge.weaponStrengthSampled, false);
  assert.equal(discharge.criticalDamage, 3);
  assert.equal(
    dischargeSkill.icon,
    'https://render.guildwars2.com/file/01D310FE65DBA378CBAFD13B2BFEDE59939C5153/102964.png'
  );
  assert.equal(dischargeRow.icon, dischargeSkill.icon);
  assert.ok(dischargeProcs.every((proc) => proc.icon === dischargeSkill.icon));
  assert.ok(
    toolbelt.events.some((event) => event.type === 'buff' && event.kind === 'kinetic-battery' && event.duration === 5)
  );
  assert.ok(
    toolbelt.events.some((event) => event.type === 'buff' && event.kind === 'quickness' && event.duration === 5)
  );
  assert.equal(toolbelt.planningState.profession.kineticCharges, 1);

  const wrench = simulate('Core', ['Supply Crate', 'Dodge'], {
    selectedTraitIds: [TRAIT.POWER_WRENCH]
  });

  assert.equal(wrench.planningState.cooldowns['Supply Crate'].readyAt, wrench.steps[0].end + 72000);

  const adrenal = simulate('Core', ['Grenade Barrage', 'Dodge', { type: 'wait', durationMs: 1000 }], {
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.ADRENAL_IMPLANT],
    boons: { vigor: true }
  });

  assert.equal(
    adrenal.planningState.cooldowns['Grenade Barrage'].readyAt,
    Math.ceil((adrenal.steps[0].end + 20250) / 40) * 40
  );
  assert.equal(adrenal.planningState.profession.endurance, 65.75);

  const streamlined = simulate('Core', ['Grenade Kit'], {
    selectedTraitIds: [TRAIT.STREAMLINED_KITS]
  });
  const mine = streamlined.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Drop Mine');

  assert.equal(mine.coefficient, 1.75);
  assert.equal(mine.explosion, true);
  assert.ok(
    streamlined.events.some((event) => event.type === 'buff' && event.kind === 'swiftness' && event.duration === 20)
  );

  const scrapperToolbelt = simulate('Scrapper', ['Function Gyro'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });
  const forgeMechanic = simulate('Holosmith', ['Engage Photon Forge'], {
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION]
  });

  assert.equal(engineerCatalog.skillsById.get(ID.FUNCTION_GYRO).countsAsToolbeltSkill, true);
  assert.equal(engineerCatalog.skillsById.get(ID.ENGAGE_PHOTON_FORGE).countsAsToolbeltSkill, false);
  assert.equal(
    scrapperToolbelt.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    true
  );
  assert.equal(
    forgeMechanic.events.some((event) => event.type === 'buff' && event.kind === 'vigor'),
    false
  );

  const amalgamToolbelt = simulate('Amalgam', [77163, 'Evolve', 'Dodge'], {
    selectedMorphSkillIds: [77163, 76901, 76568],
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.OPTIMIZED_ACTIVATION, TRAIT.ADRENAL_IMPLANT]
  });

  // Amalgam F2-F5 mechanics replace tool-belt slots and retain every Tools interaction attached to those slots.
  assert.equal(amalgamToolbelt.planningState.cooldowns['Defensive Protocol: Thorns'].readyAt, 16000);
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
    .modifyAttributes(
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
