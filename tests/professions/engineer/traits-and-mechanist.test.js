import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { buildChartSeries, skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { effectFirstAtMs, strikeEffectCoefficient, strikeEffectTicks } from '#gw2/platform/engine/effects/timelines.js';
import { createEngineerBuildDefaults, toApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { scrapperSchedulerHooks } from '#gw2/professions/engineer/specializations/scrapper/traits/modifiers.js';
import { createScrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';

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

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    observationPolicy
  });
}

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

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
  assert.ok(result.profession.traitProcReadyAt.thermalVisionUntil > 0);
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
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } }
  });
  const modifiers = simulate('Core', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.SHAPED_CHARGE, TRAIT.BIG_BOOMER],
    stats: { precision: 1000, ferocity: 0 },
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } }
  });
  const firstStrike = (result) => result.resolvedEvents.find((event) => event.type === 'damage');

  assert.ok(Math.abs(firstStrike(modifiers).damage / firstStrike(noModifiers).damage - 1.07 * 1.05 * 1.15) < 1e-12);
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
    ['Overcharged Shot', { type: 'wait', durationMs: 2440 }, 'Rifle Burst', { type: 'wait', durationMs: 4000 }],
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
  const heavy = [0.8, 0.7, 0.4, 0.2].map((targetHealthFraction) => {
    const result = simulate('Core', ['Puncturing Jab'], {
      selectedTraitIds: [TRAIT.HIGH_CALIBER, TRAIT.HEAVY_METAL],
      stats: { precision: 1000, ferocity: 0 },
      targetHealthFraction,
      target: { conditions: {} }
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

  assert.ok(
    Math.abs((serratedBleed.naturalExpiresAt - serratedBleed.at) / (baseBleed.naturalExpiresAt - baseBleed.at) - 1.33) <
      1e-12
  );
  assert.equal(baseBleed.damageTicks[0].damage, 82);
  assert.ok(Math.abs(powerBleed.damageTicks[0].damage - 102) < 1e-12);

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

  assert.ok(
    Math.abs((chemicalBurn.naturalExpiresAt - chemicalBurn.at) / (baseBurn.naturalExpiresAt - baseBurn.at) - 4 / 3) <
      1e-12
  );
  assert.ok(Math.abs(thermalBurn.damageTicks[0].damage / baseBurn.damageTicks[0].damage - 1.05) < 1e-12);

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

  assert.ok(
    Math.abs(
      ammunition.resolvedEvents.find((event) => event.type === 'damage').damage /
        ammunitionBase.resolvedEvents.find((event) => event.type === 'damage').damage -
        1.03
    ) < 1e-12
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

    assert.ok(Math.abs(chemical / base - 4 / 3) < 1e-12, `${skillName} — ${condition}`);
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
  assert.equal(toolbelt.endState.profession.kineticCharges, 1);

  const wrench = simulate('Core', ['Supply Crate', 'Dodge'], {
    selectedTraitIds: [TRAIT.POWER_WRENCH]
  });

  assert.equal(wrench.endState.cooldowns['Supply Crate'].readyAt, 73000);

  const adrenal = simulate('Core', ['Grenade Barrage', 'Dodge', { type: 'wait', durationMs: 1000 }], {
    selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.ADRENAL_IMPLANT],
    boons: { vigor: true }
  });

  assert.equal(adrenal.endState.cooldowns['Grenade Barrage'].readyAt, 21270);
  assert.equal(adrenal.endState.profession.endurance, 65.75);

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
  assert.equal(amalgamToolbelt.endState.cooldowns['Defensive Protocol: Thorns'].readyAt, 16000);
  assert.equal(
    amalgamToolbelt.events.filter(
      (event) => event.type === 'buff' && event.kind === 'vigor' && event.sourceId === TRAIT.OPTIMIZED_ACTIVATION
    ).length,
    2
  );
});

test('Scrapper traits apply gyro control, superspeed, boons, and charges', () => {
  const result = simulate(
    'Scrapper',
    ['Med Kit', 'Bandage Self', 'Function Gyro', 'Function Gyro', { type: 'wait', durationMs: 2100 }],
    {
      selectedSkills: ['Med Kit', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
      selectedTraitIds: [
        TRAIT.SPEED_OF_SYNERGY,
        TRAIT.GYROSCOPIC_ACCELERATION,
        TRAIT.SYSTEM_SHOCKER,
        TRAIT.MASS_MOMENTUM,
        TRAIT.OBJECT_IN_MOTION,
        TRAIT.EX_MACHINA,
        TRAIT.APPLIED_FORCE
      ],
      boons: { might: 10 }
    }
  );

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed').length,
    1
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed' && event.duration === 10
    )
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Gyroscopic Acceleration — superspeed' && event.duration === 5
    )
  );
  assert.equal(result.events.filter((event) => event.type === 'control' && event.controlKind === 'daze').length, 2);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'stability' && event.duration === 3));
  assert.ok(result.procSteps.filter((step) => step.skill === 'Mass Momentum').length >= 3);
  assert.ok(result.procSteps.some((step) => step.skill === 'Applied Force'));
  assert.equal(result.endState.ammo['Function Gyro'].maximum, 2);

  const reconstructionField = simulate('Scrapper', ['Reconstruction Field'], {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
    selectedTraitIds: [TRAIT.SPEED_OF_SYNERGY]
  });

  // Current F1 evidence retains seven seconds of Speed of Synergy superspeed after Reconstruction Field completes.
  assert.ok(
    reconstructionField.events.some((event) => event.name === 'Speed of Synergy — superspeed' && event.duration === 7)
  );

  const base = simulate('Scrapper', ['Puncturing Jab'], {
    target: { conditions: {} }
  });
  const moving = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.OBJECT_IN_MOTION],
    boons: {
      stability: true,
      swiftness: true,
      superspeed: true
    },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      moving.resolvedEvents.find((event) => event.type === 'damage').damage /
        base.resolvedEvents.find((event) => event.type === 'damage').damage -
        1.05 ** 3
    ) < 1e-12
  );

  const appliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.APPLIED_FORCE],
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });
  const withoutAppliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      appliedForce.resolvedEvents.find((event) => event.type === 'damage').damage /
        withoutAppliedForce.resolvedEvents.find((event) => event.type === 'damage').damage -
        3500 / 2750
    ) < 1e-12
  );
});

test('Kinetic Accelerators emits party quickness and might from successful combos', () => {
  const config = {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
    selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
    boons: { quickness: false },
    stats: { power: 2000, concentration: 260 }
  };
  const result = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    config
  );
  const withoutTrait = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    { ...config, selectedTraitIds: [] }
  );

  assert.equal(result.warnings.length, 0);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'combo' && event.skillName === 'Function Gyro' && event.finisherType === 'Blast'
    )
  );
  assert.equal(
    withoutTrait.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Function Gyro'),
    false
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Kinetic Accelerators').length, 1);
  const quickness = result.events.find(
    (event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — quickness'
  );
  const might = result.events.find((event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — might');

  assert.equal(quickness.audience.recipients, 'party');
  assert.equal(quickness.duration, 3.52);
  assert.equal(might.audience.recipients, 'party');
  assert.equal(might.duration, 10 * (1 + 260 / 1500));
  assert.equal(might.stacks, 3);
  const chart = buildChartSeries(result, 40);

  assert.equal(chart.effectUnits.Quickness, 's');
  assert.equal(chart.effects.Quickness[0].v, 3.52);
  assert.ok(chart.effects.Quickness.some((point) => point.v > 0));

  const acceleratedStep = result.steps.find((step) => step.skill === 'Positive Strike');
  const baseStep = withoutTrait.steps.find((step) => step.skill === 'Positive Strike');

  assert.equal(acceleratedStep.end - acceleratedStep.start, 480);
  assert.equal(baseStep.end - baseStep.start, 720);

  const acceleratedHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );
  const baseHit = withoutTrait.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );

  assert.ok(Math.abs(acceleratedHit.damage / baseHit.damage - 2090 / 2000) < 1e-12);
});

test('Kinetic Accelerators applies its strict ICD only to whirl finishers', () => {
  const boons = [];
  const context = {
    config: {
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
      stats: { concentration: 0 }
    },
    state: {
      activeWeaponSet: 1,
      profession: {
        core: {},
        specialization: { kind: 'Scrapper', state: createScrapperState() }
      }
    },
    epsilon: 1e-9,
    emitDerived(_event, boon) {
      boons.push(boon);
    }
  };
  const combo = (finisherType, at) => ({
    type: 'combo',
    at,
    source: 'engineer',
    sourceId: 1,
    actorType: 'player',
    skillName: `${finisherType} test`,
    finisherType,
    schedulerPrediction: 'combo-result'
  });

  const observe = scrapperSchedulerHooks.onEventScheduled.handler;

  observe(context, combo('Whirl', 1));
  observe(context, combo('Whirl', 2));
  observe(context, combo('Leap', 2));
  observe(context, combo('Blast', 2));
  observe(context, combo('Whirl', 4));
  observe(context, combo('Whirl', 4.001));

  const quickness = boons.filter((event) => event.kind === 'quickness');
  const might = boons.filter((event) => event.kind === 'might');

  assert.deepEqual(
    quickness.map((event) => [event.at, event.duration]),
    [
      [1, 3],
      [2, 3],
      [2, 3],
      [4.001, 3]
    ]
  );
  assert.deepEqual(
    might.map((event) => [event.at, event.duration, event.stacks]),
    [
      [1, 10, 3],
      [2, 10, 3],
      [2, 10, 3],
      [4.001, 10, 3]
    ]
  );
  assert.ok(boons.every((event) => event.audience?.recipients === 'party'));
  assert.ok(boons.every((event) => event.schedulerPrediction == null));
});

test('Scrapper 1-3-2 converts 13% of Power into Concentration', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.gear = Object.fromEntries(Object.keys(canonical.gear).map((slot) => [slot, "Berserker's"]));
  canonical.rune = '';
  canonical.food = '';
  canonical.utility = '';
  canonical.jadeBotCore = false;
  canonical.infusions = canonical.infusions.map((infusion) => ({
    ...infusion,
    count: 0
  }));
  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-1' },
    { name: 'Scrapper', traits: '1-3-2' }
  ];
  canonical.assumptions.quickness = false;
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);

  assert.ok(app.attributeData.activeTraits.some((trait) => trait.name === 'Kinetic Accelerators'));
  assert.equal(
    app.attributeData.attributes.Concentration.traits,
    Math.round(app.attributeData.attributes.Power.final * 0.13)
  );
});

test('Mine Field materializes five mines plus detonation with cripple', () => {
  const mineField = mechanic('Mine Field');
  const detonation = mechanic('Detonate Mine Field');

  assert.equal(mineField.cooldown, 17);
  assert.equal(mineField.effects[0].coefficient, 3.85);
  assert.equal(mineField.effects[0].hits, 5);
  assert.equal(detonation.effects[0].coefficient, 0.77);
  assert.equal(detonation.effects[0].hits, 1);

  const result = simulate('Core', ['Mine Field', 'Detonate Mine Field']);

  assert.equal(result.warnings.length, 0);
  const mines = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Damage per Mine');

  assert.equal(mines.length, 6);
  assert.ok(mines.every((event) => event.coefficient === 0.77));

  const cripple = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Crippled');

  assert.equal(cripple.length, 6);
  assert.ok(cripple.every((event) => event.duration === 2.5));

  // A precast field waits for combat; fields cast after the marker still trigger at cast completion.
  const precast = simulate('Core', ['Mine Field', { type: 'wait', durationMs: 1000 }, '__combat_start']);
  const active = simulate('Core', ['__combat_start', 'Mine Field']);
  const mineTimes = (simulation) =>
    simulation.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Damage per Mine')
      .map((event) => event.at);

  assert.deepEqual(mineTimes(precast), Array(5).fill(2.38));
  assert.deepEqual(mineTimes(active), Array(5).fill(1.38));

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

test('Takedown Round adds strike damage only after endurance is spent', () => {
  // The focused ratio protects the trait condition without depending on a saved benchmark rotation.
  const full = simulate('Core', ['Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });
  const spent = simulate('Core', ['Dodge', 'Positive Strike'], { selectedTraitIds: [TRAIT.TAKEDOWN_ROUND] });

  assert.ok(Math.abs(spent.strikeDamage / full.strikeDamage - 1.1) < 1e-12);
});

test('power Scrapper toolbelt skills use their per-hit and control facts', () => {
  const orbitalStrike = mechanic('Orbital Strike');

  assert.equal(orbitalStrike.cooldown, 40);
  assert.equal(orbitalStrike.quicknessCastTimeMs, 880);
  assert.equal(strikeEffectCoefficient(orbitalStrike.effects[0]), 1.33);
  assert.equal(effectFirstAtMs(orbitalStrike.effects[0]), 1700);
  assert.equal(orbitalStrike.effects[0].timingAnchor, 'castEnd');
  assert.equal(orbitalStrike.comboFinishers[0].finisherType, 'Blast');

  const orbital = simulate('Core', ['Orbital Strike', { type: 'wait', durationMs: 3000 }], {
    boons: { quickness: true },
    selectedSkills: ['A.E.D.', 'Grenade Kit', 'Throw Mine', 'Bomb Kit', 'Elite Mortar Kit']
  });
  const orbitalCast = orbital.steps.find((step) => step.skill === 'Orbital Strike');
  const orbitalHit = orbital.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Orbital Strike');

  assert.equal(orbitalCast.end - orbitalCast.start, 880);
  assert.equal(orbitalHit.at * 1000 - orbitalCast.end, 1700);

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

test('Medic Gyro and Reconstruction Field expose their water fields', () => {
  const reconstructionField = mechanic('Reconstruction Field');

  assert.equal(reconstructionField.cooldown, 25);
  assert.equal(reconstructionField.comboFields[0].fieldType, 'Water');
  assert.equal(reconstructionField.comboFields[0].duration, 2);
  assert.deepEqual(reconstructionField.effects[0], {
    type: 'boon',
    boon: 'protection',
    duration: 2,
    stacks: 1
  });

  const medicGyro = mechanic('Medic Gyro');

  assert.equal(medicGyro.cooldown, 20);
  assert.equal(medicGyro.comboFields[0].fieldType, 'Water');
  assert.equal(medicGyro.comboFields[0].duration, 5);
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

    assert.equal(missiles.length, 3);
    assert.ok(missiles.every((event) => event.actorType === 'summon' && event.coefficient === 0.6));
    assert.equal(
      sky.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Landing Damage').coefficient,
      1.2
    );
    assert.ok(
      sky.events.some(
        (event) => event.type === 'control' && event.skillName === 'Sky Circus' && event.controlKind === 'knockdown'
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

test('Energy Amplifier adds Power and Healing Power during regeneration', () => {
  const context = {
    config: {
      selectedTraitIds: [TRAIT.ENERGY_AMPLIFIER],
      boons: { regeneration: true }
    },
    time: 0
  };
  const attributes = engineerProfession
    .resolveRuntime({
      specialization: 'Core'
    })
    .modifyAttributes(context, {
      power: 2000,
      precision: 1000,
      toughness: 1000,
      vitality: 1000,
      ferocity: 0,
      conditionDamage: 0,
      expertise: 0,
      concentration: 0,
      healingPower: 500
    });

  assert.equal(attributes.power, 2250);
  assert.equal(attributes.healingPower, 750);
});

test('Engineer is a loadable native application', async () => {
  assert.equal((await loadProfession('engineer')).id, 'engineer');
  assert.equal((await loadProfessionAppAdapter('engineer')).profession.id, 'engineer');
  const html = await readFile(new URL('../../../dist/site/engineer.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="engineer"/);
  assert.match(html, /Engineer<\/span> Rotation Simulator/);
});
