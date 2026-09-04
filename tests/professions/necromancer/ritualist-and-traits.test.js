import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { createNecromancerBuildDefaults } from '#gw2/professions/necromancer/build/build.js';
import { necromancerCatalog, NECROMANCER_NON_DPS_SKILL_NAMES } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { RITUALIST_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { necromancerAppAdapter } from '#gw2/professions/necromancer/app/app-definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

const simulate = createProfessionSimulator(necromancerProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Ritualist spirits attack, empower Essence Blast, and innervate', () => {
  const result = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', 'Essence Blast', 'Innervate Anguish', "Exit Ritualist's Shroud"],
    { initialResource: 50 }
  );
  const lingering = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.endState.profession.activeSpirits, {});
  assert.ok(result.endState.profession.lifeForce > 50);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Essence Blast'));
  assert.equal(lingering.endState.profession.activeSpirits.anguish, true);
  assert.ok(lingering.endState.profession.lifeForce < 90);
  assert.ok(lingering.breakdown.some((entry) => entry.name === 'Anguish Autoattack'));
});

test('Soul Twisting refunds only the first spirit summon after entering Ritualist Shroud', () => {
  const baseline = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish'], { initialResource: 100 });
  const twisting = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', 'Wanderlust'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_TWISTING]
  });

  assert.ok(baseline.endState.cooldowns.Anguish);
  assert.equal(twisting.endState.cooldowns.Anguish, undefined);
  assert.ok(twisting.endState.cooldowns.Wanderlust);
  assert.equal(twisting.endState.profession.soulTwistingAvailable, false);
});

test('Ritualist autoattacks and Painful Bond carry their source icons', () => {
  const anguish = simulate('Ritualist', ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 8000 }], {
    initialResource: 100
  });
  const wanderlust = simulate('Ritualist', ["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 8000 }], {
    initialResource: 100
  });
  const anguishIcon = necromancerCatalog.skillsById.get(ID.ANGUISH).icon;
  const wanderlustIcon = necromancerCatalog.skillsById.get(ID.WANDERLUST).icon;
  const anguishRows = skillBreakdownRows(anguish);
  const wanderlustRows = skillBreakdownRows(wanderlust);

  assert.equal(anguishRows.find((row) => row.name === 'Anguish Autoattack')?.icon, anguishIcon);
  assert.equal(anguishRows.find((row) => row.name === 'Painful Bond')?.icon, anguishIcon);
  assert.equal(wanderlustRows.find((row) => row.name === 'Wanderlust Autoattack')?.icon, wanderlustIcon);
});

test('Ritualist live spirit packets retain independent ownership and cadence', () => {
  const packets = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Anguish',
      'Wanderlust',
      'Preservation',
      'Essence Blast',
      { type: 'wait', durationMs: 6000 }
    ],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.EXPLOSIVE_GROWTH, TRAIT.SPIRITS_STRENGTH]
    }
  );
  const detachedBond = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100
    }
  );
  const damageEvents = packets.resolvedEvents.filter((event) => event.type === 'damage');
  const anguish = damageEvents.filter((event) => event.skillName === 'Anguish');
  const wanderlust = damageEvents.filter((event) => event.skillName === 'Wanderlust');
  const preservationAutos = damageEvents.filter((event) => event.skillName === 'Preservation Autoattack');
  const wanderlustAutos = damageEvents.filter((event) => event.skillName === 'Wanderlust Autoattack');
  const anguishAutos = damageEvents.filter((event) => event.skillName === 'Anguish Autoattack');
  const lingering = wanderlust.filter((event) => event.actorType === 'player' && event.source === 'Spirit');
  const essence = damageEvents.find((event) => event.skillName === 'Essence Blast');
  const growth = damageEvents.filter((event) => event.skillName === 'Explosive Growth');
  const growthRow = skillBreakdownRows(packets).find((row) => row.name === 'Explosive Growth');
  const bond = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Painful Bond'
  );
  const detachedAutos = detachedBond.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack'
  );

  assert.equal(anguish.length, 7);
  assert.equal(
    anguish.every((event) => event.actorType === 'player' && event.coefficient === 0.36),
    true
  );
  assert.equal(lingering.length, 4);
  assert.equal(
    lingering.every((event) => event.coefficient === 0.42),
    true
  );
  assert.ok(preservationAutos.length > 0);
  assert.equal(
    preservationAutos.every(
      (event) =>
        event.actorType === 'summon' &&
        event.coefficient === 0.3 &&
        event.weaponStrength === 1565 &&
        event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    wanderlustAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1565 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(
    anguishAutos.every(
      (event) =>
        event.coefficient === 0.4 && event.weaponStrength === 1685 && event.summonInheritsCriticalAttributes === true
    ),
    true
  );
  assert.equal(essence.coefficient, 0.75);
  assert.equal(essence.metadata.activeSpirits, 3);
  assert.equal(essence.metadata.essenceBlastDamagePerSpirit, 0.15);
  assert.equal(growth.length, 3);
  assert.equal(growthRow.hits, 3);
  assert.equal(growthRow.parentSkill, 'Anguish');
  assert.equal(detachedAutos.length, 0);
  assert.ok(bond.length >= 8);
  assert.equal(
    bond.slice(1).every((event, index) => Math.abs(event.at - bond[index].at - 1) < 1e-9),
    true
  );
});

test('Ritualist spirit autos inherit owner Fury without inheriting owner Might', () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', { type: 'wait', durationMs: 8000 }];
  const run = (boons) =>
    simulate('Ritualist', rotation, {
      initialResource: 100,
      boons,
      sharePlayerBoonsWithSummons: false
    });
  const spiritAuto = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Anguish Autoattack');
  const baseline = spiritAuto(run({ might: 0, fury: false }));
  const might = spiritAuto(run({ might: 25, fury: false }));
  const fury = spiritAuto(run({ might: 0, fury: true }));

  assert.ok(baseline);
  assert.ok(might);
  assert.ok(fury);
  assert.equal(might.damage, baseline.damage);
  assert.equal(might.criticalChance, baseline.criticalChance);
  assert.equal(fury.criticalChance, Math.min(1, baseline.criticalChance + 0.25));
  assert.ok(fury.damage > baseline.damage);
});

test("Innervate Anguish uses profession-mechanic strength without Spirit's Strength", () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', 'Innervate Anguish'];
  const baseline = simulate('Ritualist', rotation, {
    initialResource: 100
  });
  const strengthened = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SPIRITS_STRENGTH]
  });
  const innervate = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Innervate Anguish');
  const baselineHit = innervate(baseline);
  const strengthenedHit = innervate(strengthened);

  assert.ok(baselineHit);
  assert.ok(strengthenedHit);
  assert.equal(baselineHit.coefficient, 1.3);
  assert.equal(baselineHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(baselineHit.resolvedWeaponStrength, 1100);
  assert.equal(strengthenedHit.damage, baselineHit.damage);
});

test("Spirit's Strength scales Ritualist minion strikes at the specialization boundary", () => {
  const run = (selectedTraitIds) =>
    simulate('Ritualist', ['Summon Bone Fiend', { type: 'wait', durationMs: 5000 }], {
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds
    });
  const strike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.source === 'Minion' && event.parentSkillName === 'Summon Bone Fiend'
    );
  const baseline = strike(run([]));
  const strengthened = strike(run([TRAIT.SPIRITS_STRENGTH]));

  assert.ok(baseline);
  assert.ok(strengthened);
  assert.equal(strengthened.damage, baseline.damage * 1.5);
});

test('Ritualist weapon spells consume stacks and Resilient Weapon is usable', () => {
  const weaponSpells = simulate(
    'Ritualist',
    [
      'Nightmare Weapon',
      'Splinter Weapon',
      "Ritualist's Shroud",
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast',
      'Essence Blast'
    ],
    {
      initialResource: 100,
      selectedSkills: ['Nightmare Weapon', 'Splinter Weapon']
    }
  );
  const resilient = simulate('Ritualist', ['Resilient Weapon'], {
    selectedSkills: ['Resilient Weapon']
  });
  const nightmare = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Nightmare Weapon'
  );
  const splinter = weaponSpells.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Splinter Weapon'
  );
  const nightmareIcon = necromancerCatalog.skillsById.get(ID.NIGHTMARE_WEAPON).icon;
  const splinterIcon = necromancerCatalog.skillsById.get(ID.SPLINTER_WEAPON).icon;
  const nightmareProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Nightmare Weapon');
  const splinterProcs = weaponSpells.procSteps.filter((step) => step.skill === 'Splinter Weapon');

  assert.deepEqual(weaponSpells.warnings, []);
  assert.equal(nightmare.length, 5);
  assert.equal(splinter.length, 5);
  assert.equal(
    splinter.every((event) => event.coefficient === 0.4),
    true
  );
  assert.equal(
    nightmareProcs.every((step) => step.icon === nightmareIcon),
    true
  );
  assert.equal(
    splinterProcs.every((step) => step.icon === splinterIcon),
    true
  );
  const nightmareProc = necromancerCatalog.balanceProfilesById.get(RITUALIST_BALANCE_PROFILE_IDS.nightmareWeaponProc);

  assert.equal(nightmareProc.effects[1].stacks, 2);
  assert.equal(nightmareProc.effects[1].duration, 8);
  assert.deepEqual(resilient.warnings, []);
  assert.equal(
    resilient.events.some(
      (event) => event.type === 'necromancer.weapon-spell' && event.spell === 'resilient' && event.playerStacks === 5
    ),
    true
  );
  assert.equal(NECROMANCER_NON_DPS_SKILL_NAMES.has('Resilient Weapon'), false);
});

test('Ritualist weapon spells scale with allied players', () => {
  const rotation = ['Nightmare Weapon', 'Splinter Weapon'];
  const solo = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkills: rotation,
      allies: { count: 0, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const party = simulate(
    'Ritualist',
    rotation,
    {
      selectedSkills: rotation,
      allies: { count: 4, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const allyProcs = party.resolvedEvents.filter((event) => event.type === 'damage' && event.triggeredByAlly);
  const applicationEvents = party.events.filter((event) => event.type === 'necromancer.weapon-spell');

  assert.equal(solo.totalDamage, 0);
  assert.ok(party.totalDamage > solo.totalDamage);
  assert.equal(allyProcs.filter((event) => event.name === 'Nightmare Weapon').length, 12);
  assert.equal(allyProcs.filter((event) => event.name === 'Splinter Weapon').length, 12);
  assert.deepEqual([...new Set(allyProcs.map((event) => event.triggeredByAlly))], [1, 2, 3, 4]);
  assert.equal(
    applicationEvents.every(
      (event) =>
        event.resolvedAudience.alliedPlayerCount === 4 &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.companionIds.length === 0
    ),
    true
  );

  const wieldersBoon = simulate(
    'Ritualist',
    ['Nightmare Weapon'],
    {
      selectedSkills: ['Nightmare Weapon'],
      selectedTraitIds: [TRAIT.WIELDERS_BOON],
      allies: { count: 1, strikesPerSecond: 10 }
    },
    observationTail(2000)
  );

  assert.equal(
    wieldersBoon.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Nightmare Weapon' && event.triggeredByAlly === 1
    ).length,
    5
  );
});

test('Ritualist weapon spells prioritize players, include minions, and exclude spirits', () => {
  const result = simulate(
    'Ritualist',
    [
      'Summon Bone Minions',
      "Ritualist's Shroud",
      'Anguish',
      "Exit Ritualist's Shroud",
      'Nightmare Weapon',
      'Splinter Weapon'
    ],
    {
      initialResource: 100,
      selectedSkills: ['Summon Bone Minions', 'Nightmare Weapon', 'Splinter Weapon'],
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS],
      allies: { count: 2, strikesPerSecond: 1 }
    },
    observationTail(5000)
  );
  const applications = result.events.filter((event) => event.type === 'necromancer.weapon-spell');

  assert.deepEqual(result.warnings, []);
  assert.equal(result.profession.activeSpirits.anguish, true);
  assert.deepEqual(
    applications.map((event) => event.spell),
    ['nightmare', 'splinter']
  );
  assert.equal(
    applications.every(
      (event) =>
        event.resolvedAudience.alliedPlayerCount === 2 &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.companionIds.join(',') === 'minion:bone-minion:0,minion:bone-minion:1' &&
        event.resolvedAudience.companionIds.every((recipient) => !recipient.startsWith('spirit:'))
    ),
    true
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Nightmare Weapon' && event.triggeredByAlly
    ).length,
    6
  );
});

test("Wanderlust's player-scaled attacks cannot spend the player's Splinter Weapon stacks", () => {
  const result = simulate(
    'Ritualist',
    [
      "Ritualist's Shroud",
      'Wanderlust',
      "Exit Ritualist's Shroud",
      'Splinter Weapon',
      'Necrotic Slash',
      { type: 'wait', durationMs: 4000 }
    ],
    {
      initialResource: 100,
      selectedSkills: ['Splinter Weapon'],
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS]
    }
  );
  const splinterProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Splinter Weapon'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    splinterProcs.some((event) => event.triggeredBy === 'Necrotic Slash'),
    true
  );
  assert.equal(
    splinterProcs.some(
      (event) =>
        String(event.triggeredBy).includes('Wanderlust') || String(event.summonOwner).startsWith('spirit:wanderlust')
    ),
    false
  );
});

test('Necromancer trait procs resolve from real event state', () => {
  const dhuumfire = simulate(
    'Core',
    ['Death Shroud', 'Life Blast', 'End Death Shroud', { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DHUUMFIRE] }
  );
  const demonicLore = simulate('Scourge', ['Manifest Sand Shade', { type: 'wait', durationMs: 3100 }], {
    selectedTraitIds: [TRAIT.DEMONIC_LORE]
  });
  const deathlyChill = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", { type: 'wait', durationMs: 3100 }],
    { selectedTraitIds: [TRAIT.DEATHLY_CHILL] }
  );

  assert.ok(dhuumfire.resolvedEvents.some((event) => event.name === 'Dhuumfire - Burning'));
  assert.ok(demonicLore.resolvedEvents.some((event) => event.name === 'Demonic Lore - Burning'));
  assert.ok(deathlyChill.resolvedEvents.some((event) => event.name === 'Deathly Chill - Bleeding'));
});

test('migrated Core trait lines retain previously uncovered threshold, blind, heal, and fear behavior', () => {
  const threshold = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.SIPHONED_POWER, TRAIT.CHILL_OF_DEATH],
    target: { ...baseConfig.target, health: 1 }
  });
  const blind = simulate('Core', ['Deathly Swarm'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.CHILLING_DARKNESS]
  });
  const heal = simulate('Core', ['Summon Blood Fiend'], {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.DARK_DEFENSE]
  });
  const fear = (selectedTraitIds = []) =>
    simulate('Core', ['Wail of Doom'], {
      initialResource: 0,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Warhorn',
      selectedTraitIds
    });
  const plainFear = fear();
  const fearOfDeath = fear([TRAIT.FEAR_OF_DEATH]);

  assert.equal(
    threshold.procSteps.some((step) => step.skill === 'Siphoned Power'),
    true
  );
  assert.equal(
    threshold.procSteps.some((step) => step.skill === 'Lesser Spinal Shivers'),
    true
  );
  assert.equal(
    blind.resolvedEvents.some((event) => event.condition === 'Chilled' && event.sourceId === TRAIT.CHILLING_DARKNESS),
    true
  );
  assert.equal(
    heal.events.some((event) => event.type === 'buff' && event.kind === 'protection' && event.duration === 3),
    true
  );
  assert.equal(heal.endState.profession.carapaceExpiries.length, 10);
  assert.equal(fearOfDeath.endState.profession.lifeForce - plainFear.endState.profession.lifeForce, 15);
});

test('Blood Is Power and Plague Signet preserve transferred conditions', () => {
  const result = simulate('Harbinger', ['Blood Is Power', 'Plague Signet', { type: 'wait', durationMs: 10_100 }], {
    selectedSkills: ['Blood Is Power', 'Plague Signet'],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION]
  });
  const transferred = result.resolvedEvents.filter((event) => event.transferredCondition);

  assert.deepEqual(result.warnings, []);
  assert.equal(
    transferred.some((event) => event.condition === 'Bleeding' && event.stacks === 2),
    true
  );
  assert.equal(
    transferred.some((event) => event.condition === 'Torment' && event.stacks === 2),
    true
  );
  assert.deepEqual(result.endState.profession.selfConditions, []);
  assert.equal(
    transferred.every((event) => Math.abs(event.effectiveDuration - 10) < 0.0001),
    true
  );
});

test('Plague Sending treats Scourge F5 as entering shroud', () => {
  const result = simulate('Scourge', ['Desert Shroud', 'Blood Is Power', { type: 'wait', durationMs: 10_100 }], {
    initialResource: 100,
    selectedSkills: ['Blood Is Power'],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION, TRAIT.PLAGUE_SENDING]
  });
  const transferred = result.resolvedEvents.filter((event) => event.transferredCondition);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    transferred.map((event) => [event.condition, event.stacks]),
    [
      ['Bleeding', 2],
      ['Torment', 2]
    ]
  );
  assert.deepEqual(result.endState.profession.selfConditions, []);
});

test('Dhuumfire uses the specialization duration split and Scourge ICD', () => {
  const core = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const harbinger = simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const scourge = simulate(
    'Scourge',
    ['Manifest Sand Shade', 'Garish Pillar', { type: 'wait', durationMs: 1100 }, 'Sand Cascade'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.DHUUMFIRE]
    }
  );
  const applications = (result) =>
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning');

  assert.deepEqual(
    applications(core).map((event) => event.duration),
    [3]
  );
  assert.deepEqual(
    applications(harbinger).map((event) => event.duration),
    [1, 1]
  );
  assert.deepEqual(
    applications(scourge).map((event) => event.duration),
    [2, 2]
  );
  assert.ok(applications(scourge)[1].at - applications(scourge)[0].at >= 1);
});

test('Desert Shroud pulses do not retrigger shroud skill-one traits', () => {
  const result = simulate('Scourge', ['Desert Shroud', { type: 'wait', durationMs: 6100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DHUUMFIRE]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning'
  );

  assert.equal(applications.length, 1);
});

test('requested Harbinger damage traits apply at their per-hit triggers', () => {
  const result = simulate(
    'Harbinger',
    [
      'Harbinger Shroud',
      'Tainted Bolts',
      'Dark Barrage',
      'Vital Draw',
      'Exit Harbinger Shroud',
      { type: 'wait', durationMs: 3100 }
    ],
    {
      initialResource: 100,
      initialBlight: 10,
      selectedTraitIds: [TRAIT.DHUUMFIRE, TRAIT.UNYIELDING_BLAST, TRAIT.SEPTIC_CORRUPTION, TRAIT.INSIDIOUS_DISRUPTION]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.sourceId === TRAIT.DHUUMFIRE && event.condition === 'Burning').length,
    2
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillId === ID.TAINTED_BOLTS && event.condition === 'Torment').length,
    2
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Unyielding Blast').length, 1);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.SEPTIC_CORRUPTION && event.condition === 'Poisoned'
    ).length,
    6
  );
  const insidiousDisruption = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.INSIDIOUS_DISRUPTION && event.condition === 'Torment'
  );

  assert.equal(insidiousDisruption.length, 3);
  assert.ok(insidiousDisruption.every((event) => event.duration === 5));
});

test('Barbed Precision uses centered deterministic expected procs', () => {
  const result = simulate('Harbinger', ['Weeping Shots', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Pistol',
    stats: { precision: 4000 },
    selectedTraitIds: [TRAIT.BARBED_PRECISION]
  });
  const applications = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.BARBED_PRECISION && event.condition === 'Bleeding'
  );

  // Six guaranteed critical hits have 1.98 expected procs. Centered cumulative
  // rounding materializes two whole applications instead of flooring to one.
  assert.equal(applications.length, 2);
  assert.ok(applications.every((application) => application.duration === 3));
  assert.ok(applications.every((application) => Math.abs(application.effectiveDuration - 3.6) < 1e-12));
});

test('Devouring Darkness scales torment with distinct target conditions', () => {
  const result = simulate('Core', ['Devouring Darkness', { type: 'wait', durationMs: 4100 }], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
    target: {
      conditions: {
        Bleeding: true,
        Burning: true,
        Chilled: true,
        Poisoned: true,
        Torment: true,
        Vulnerability: 25
      }
    }
  });
  const application = result.resolvedEvents.find(
    (event) => event.skillId === ID.DEVOURING_DARKNESS && event.condition === 'Torment'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(application?.stacks, 5);
  assert.equal(application?.effectiveDuration, 4);
});

test('current Harbinger grandmaster traits use their live PvE mechanics', () => {
  const cascadingFromStartingStacks = simulate('Harbinger', ['Elixir of Promise'], {
    initialBlight: 5,
    initialCascadingCorruptionStacks: 15,
    selectedSkills: ['Elixir of Promise'],
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  });
  const cascading = simulate(
    'Harbinger',
    ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition', { type: 'wait', durationMs: 6100 }],
    {
      initialBlight: 25,
      selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'],
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    }
  );
  const precombat = simulate(
    'Harbinger',
    [
      'Elixir of Promise',
      { name: '__combat_start' },
      'Elixir of Risk',
      'Elixir of Ambition',
      { type: 'wait', durationMs: 6100 }
    ],
    {
      initialBlight: 25,
      selectedSkills: ['Elixir of Promise', 'Elixir of Risk', 'Elixir of Ambition'],
      selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
    }
  );
  const deathlyHaste = simulate('Harbinger', ['Harbinger Shroud', 'Dark Barrage', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.DEATHLY_HASTE],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const twistedMedicine = simulate('Harbinger', ['Elixir of Risk'], {
    selectedSkills: ['Elixir of Risk'],
    selectedTraitIds: [TRAIT.TWISTED_MEDICINE],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const doom = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Tainted Bolts', 'Dark Barrage', 'Exit Harbinger Shroud', { type: 'wait', durationMs: 3100 }],
    {
      selectedTraitIds: [TRAIT.DOOM_APPROACHES]
    }
  );

  assert.deepEqual(cascading.warnings, []);
  assert.equal(
    cascadingFromStartingStacks.breakdown.some((entry) => entry.name === 'Cascading Corruption'),
    true
  );
  assert.equal(cascadingFromStartingStacks.endState.profession.cascadingCorruptionStacks, 0);
  const riskWeakness = cascading.resolvedEvents.find(
    (event) => event.skillId === ID.ELIXIR_OF_RISK && event.condition === 'Weakness'
  );

  assert.deepEqual(
    {
      stacks: riskWeakness?.stacks,
      duration: riskWeakness?.duration,
      effectiveDuration: riskWeakness?.effectiveDuration
    },
    {
      stacks: 1,
      duration: 10,
      effectiveDuration: 10
    }
  );
  const cascadingStrike = cascading.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.CASCADING_CORRUPTION
  );
  const cascadingTorment = cascading.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.CASCADING_CORRUPTION
  );

  assert.deepEqual(
    {
      skillId: cascadingStrike?.skillId,
      skillName: cascadingStrike?.skillName,
      parentSkillName: cascadingStrike?.parentSkillName
    },
    {
      skillId: ID.CASCADING_CORRUPTION,
      skillName: 'Cascading Corruption',
      parentSkillName: 'Elixir of Ambition'
    }
  );
  assert.deepEqual(
    {
      name: cascadingTorment?.name,
      skillId: cascadingTorment?.skillId,
      skillName: cascadingTorment?.skillName,
      parentSkillName: cascadingTorment?.parentSkillName,
      condition: cascadingTorment?.condition,
      stacks: cascadingTorment?.stacks,
      effectiveDuration: cascadingTorment?.effectiveDuration
    },
    {
      name: 'Cascading Corruption — Torment',
      skillId: ID.CASCADING_CORRUPTION,
      skillName: 'Cascading Corruption',
      parentSkillName: 'Elixir of Ambition',
      condition: 'Torment',
      stacks: 6,
      effectiveDuration: 6
    }
  );
  const cascadingRow = skillBreakdownRows(cascading).find((row) => row.name === 'Cascading Corruption');

  assert.ok(cascadingRow?.strike > 0);
  assert.ok(cascadingRow?.condition > 0);
  assert.equal(cascadingRow?.hits, 1);
  assert.equal(cascadingRow?.casts, 0);
  assert.equal(cascadingRow?.parentSkill, 'Elixir of Ambition');
  const meltdown = cascading.procSteps.find((step) => step.skill === 'Meltdown');

  assert.equal(meltdown?.icon, 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png');
  assert.equal(
    precombat.breakdown.some((entry) => entry.name === 'Cascading Corruption'),
    false
  );
  assert.equal(
    deathlyHaste.events.filter((event) => event.kind === 'quickness' && event.sourceId !== TRAIT.SOUL_BARBS).length,
    2
  );
  assert.ok(
    deathlyHaste.events
      .filter(
        (event) =>
          event.type === 'buff' && ['quickness', 'fury'].includes(event.kind) && event.sourceId !== TRAIT.SOUL_BARBS
      )
      .every((event) => event.audience?.recipients === 'party' && event.resolvedAudience.includesSummons === false)
  );
  const twistedMedicineBoons = twistedMedicine.events.filter(
    (event) => event.type === 'buff' && ['might', 'fury'].includes(event.kind)
  );

  assert.equal(twistedMedicineBoons.length, 2);
  assert.ok(
    twistedMedicineBoons.every(
      (event) => event.audience?.recipients === 'party' && event.resolvedAudience.includesSummons === false
    )
  );
  assert.equal(doom.events.filter((event) => event.type === 'damage' && event.skillId === ID.DARK_BARRAGE).length, 8);
  assert.equal(
    doom.procSteps.some((step) => step.skill === 'Doom Approaches'),
    true
  );
});

test('Soul Barbs and Dark Gunslinger change their documented outputs', () => {
  const soulBarbs = simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts', 'Exit Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.SOUL_BARBS]
  });
  const basePistol = simulate('Harbinger', ['Vile Blast', 'Vile Blast'], {
    primaryWeapon: 'Pistol'
  });
  const gunslinger = simulate('Harbinger', ['Vile Blast', 'Vile Blast'], {
    primaryWeapon: 'Pistol',
    selectedTraitIds: [TRAIT.DARK_GUNSLINGER]
  });

  assert.equal(soulBarbs.events.filter((event) => event.kind === 'necromancer-soul-barbs').length, 2);
  assert.deepEqual(
    soulBarbs.events.filter((event) => event.kind === 'necromancer-soul-barbs').map((event) => event.duration),
    [15, 15]
  );
  const effectPresentations = necromancerProfession.ui.effectPresentations({
    specialization: 'Harbinger',
    catalog: necromancerProfession.catalog
  });
  const soulBarbsSeries = buildChartSeries(soulBarbs, 100, effectPresentations).effects['Soul Barbs'];

  assert.ok(soulBarbsSeries.some((point) => point.v === 1));
  assert.ok(soulBarbsSeries.every((point) => point.v === 0 || point.v === 1));
  assert.ok(gunslinger.steps[1].start < basePistol.steps[1].start);
  const gunslingerPoison = gunslinger.resolvedEvents.find(
    (event) => event.skillId === ID.VILE_BLAST && event.condition === 'Poisoned'
  );

  assert.ok(Math.abs(gunslingerPoison.effectiveDuration - 6.496) < 1e-12);
});

test('Lesser Chilblains owns its strike and poison damage attribution', () => {
  const baseline = simulate('Reaper', ["Reaper's Shroud", 'Soul Spiral'], {}, observationTail(4100));
  const result = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Soul Spiral'],
    { selectedTraitIds: [TRAIT.TRANSFUSION] },
    observationTail(4100)
  );
  const rows = skillBreakdownRows(result);
  const lesserChilblains = rows.find((row) => row.name === 'Lesser Chilblains');
  const soulSpiral = rows.find((row) => row.name === 'Soul Spiral');
  const baselineSoulSpiral = skillBreakdownRows(baseline).find((row) => row.name === 'Soul Spiral');
  const attributedEvents = result.resolvedEvents.filter(
    (event) =>
      event.sourceId === TRAIT.TRANSFUSION &&
      (event.type === 'damage' || (event.type === 'condition' && event.condition === 'Poisoned'))
  );
  const chilblainsIcon = necromancerCatalog.skillsById.get(ID.CHILLBLAINS)?.icon;

  assert.ok(lesserChilblains?.strike > 0);
  assert.ok(lesserChilblains?.condition > 0);
  assert.equal(lesserChilblains?.skillId, ID.LESSER_CHILBLAINS);
  assert.equal(lesserChilblains?.icon, chilblainsIcon);
  assert.equal(lesserChilblains?.parentSkill, 'Soul Spiral');
  assert.equal(lesserChilblains?.casts, 0);
  assert.equal(soulSpiral?.condition, baselineSoulSpiral?.condition);
  assert.equal(attributedEvents.length, 2);
  assert.equal(
    attributedEvents.every(
      (event) => event.skillName === 'Lesser Chilblains' && event.parentSkillName === 'Soul Spiral'
    ),
    true
  );
});

test('Voracious Arc gives Lesser Chilblains its own damage row and artwork', () => {
  const result = simulate(
    'Harbinger',
    ['Harbinger Shroud', 'Voracious Arc'],
    { selectedTraitIds: [TRAIT.TRANSFUSION] },
    observationTail(4100)
  );
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Lesser Chilblains');

  assert.ok(row?.strike > 0);
  assert.ok(row?.condition > 0);
  assert.equal(row?.skillId, ID.LESSER_CHILBLAINS);
  assert.equal(row?.parentSkill, 'Voracious Arc');
  assert.equal(row?.icon, necromancerCatalog.skillsById.get(ID.CHILLBLAINS)?.icon);
});

test('cross-specialization Necromancer trait triggers remain executable', () => {
  const spite = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    selectedTraitIds: [TRAIT.REAPERS_MIGHT, TRAIT.WEAKENING_SHROUD]
  });
  const reaper = simulate(
    'Reaper',
    ["Reaper's Shroud", 'Soul Spiral', "Exit Reaper's Shroud", { type: 'wait', durationMs: 8100 }],
    {
      selectedTraitIds: [TRAIT.TRANSFUSION]
    }
  );
  const fear = simulate('Reaper', ["Reaper's Mark", { type: 'wait', durationMs: 2100 }], {
    primaryWeapon: 'Staff',
    selectedTraitIds: [TRAIT.SHIVERS_OF_DREAD, TRAIT.BITTER_CHILL, TRAIT.TERROR]
  });
  const malicious = simulate('Core', ['Summon Blood Fiend'], {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.MALICIOUS_SWARM]
  });
  const ashes = simulate('Scourge', ['Harrowing Wave'], {
    initialResource: 0,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Torch',
    selectedTraitIds: [TRAIT.NOURISHING_ASHES]
  });

  assert.equal(
    spite.procSteps.some((step) => step.skill === "Reaper's Might"),
    true
  );
  assert.equal(
    spite.breakdown.some((entry) => entry.name === 'Weakening Shroud'),
    true
  );
  assert.equal(
    reaper.breakdown.some((entry) => entry.name === 'Lesser Chilblains'),
    true
  );
  assert.equal(
    fear.procSteps.some((step) => step.skill === 'Bitter Chill'),
    true
  );
  assert.equal(
    fear.resolvedEvents.some((event) => event.sourceId === TRAIT.TERROR && event.condition === 'Fear'),
    true
  );
  assert.ok(fear.conditionDamage > 0);
  assert.equal(
    malicious.breakdown.some((entry) => entry.name === 'Lesser Signet of the Locust'),
    true
  );
  assert.equal(ashes.endState.profession.lifeForce, 10);
});

test('remaining outgoing Necromancer trait families affect combat state', () => {
  const carapaceBase = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter'
  });
  const carapace = simulate('Core', ['Blood Curse', 'Rending Curse'], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.CORRUPTERS_FERVOR, TRAIT.DEADLY_STRENGTH]
  });
  const armored = simulate('Core', ['Death Shroud', 'Life Blast'], {
    selectedTraitIds: [TRAIT.ARMORED_SHROUD, TRAIT.DEADLY_STRENGTH]
  });
  const augury = simulate('Reaper', ['"Suffer!"'], {
    selectedSkills: ['"Suffer!"'],
    selectedTraitIds: [TRAIT.AUGURY_OF_DEATH]
  });
  const signet = simulate('Core', ['Signet of Spite'], {
    selectedSkills: ['Signet of Spite'],
    selectedTraitIds: [TRAIT.SIGNETS_OF_SUFFERING]
  });
  const brew = simulate('Harbinger', ['Elixir of Risk'], {
    selectedSkills: ['Elixir of Risk'],
    selectedTraitIds: [TRAIT.BOLSTERING_BREW]
  });
  const empowerment = simulate('Scourge', ['Manifest Sand Shade'], {
    selectedTraitIds: [TRAIT.DESERT_EMPOWERMENT]
  });

  assert.ok(carapace.strikeDamage > carapaceBase.strikeDamage);
  assert.ok(armored.endState.profession.carapaceExpiries.length >= 5);
  assert.equal(
    augury.breakdown.some((entry) => entry.name === 'Augury of Death'),
    true
  );
  assert.equal(
    signet.breakdown.some((entry) => entry.name === 'Signets of Suffering'),
    true
  );
  assert.equal(
    brew.events.some((event) => event.kind === 'protection' && event.skillId === ID.ELIXIR_OF_RISK),
    true
  );
  assert.equal(
    empowerment.events.some((event) => event.kind === 'alacrity' && event.skillId === ID.MANIFEST_SAND_SHADE),
    true
  );
});

test('trait skill replacements expose only their active variant', () => {
  const scepterBase = simulate('Core', ['Feast of Corruption'], {
    primaryWeapon: 'Scepter'
  });
  const scepterTrait = simulate('Core', ['Feast of Corruption', 'Devouring Darkness'], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.LINGERING_CURSE]
  });
  const scourgeTrait = simulate('Scourge', ['Desert Shroud', 'Sandstorm Shroud', { type: 'wait', durationMs: 4100 }], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW]
  });

  assert.deepEqual(scepterBase.warnings, []);
  assert.match(scepterTrait.warnings.join(' '), /Feast of Corruption is unavailable/);
  assert.ok(scepterTrait.breakdown.some((entry) => entry.name === 'Devouring Darkness'));
  assert.match(scourgeTrait.warnings.join(' '), /Desert Shroud is unavailable/);
  assert.ok(scourgeTrait.resolvedEvents.some((event) => event.name === 'Sandstorm Shroud'));
});

test('Corrupted Talent owns the Harbinger shroud-entry life-force gain', () => {
  const withoutTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0
  });
  const withTrait = simulate('Harbinger', ['Harbinger Shroud'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.CORRUPTED_TALENT]
  });

  assert.equal(withoutTrait.endState.profession.lifeForce, 0);
  assert.equal(withTrait.endState.profession.lifeForce, 15);
});

test('modifier candidates include every active Necromancer trait', () => {
  const build = createNecromancerBuildDefaults();
  const app = {
    build,
    skillByName: necromancerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  necromancerAppAdapter.recalculate(app);

  const activeTraitNames = new Set(app.attributeData.activeTraits.map((trait) => trait.name));
  const candidateNames = new Set(
    necromancerAppAdapter
      .modifierContributionRequest(app)
      .comparisons.map(({ modifier }) => modifier)
      .filter((candidate) => candidate.type === 'Trait')
      .map((candidate) => candidate.name)
  );

  assert.deepEqual(candidateNames, activeTraitNames);
});

test('signet passives and Soul Battery are profession-owned resources', () => {
  const signets = simulate('Core', [{ type: 'wait', durationMs: 3100 }], {
    initialResource: 0,
    selectedSkills: ['Signet of Undeath', 'Signet of Vampirism']
  });
  const battery = simulate('Core', [], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_BATTERY]
  });
  const eternal = simulate('Core', [{ type: 'wait', durationMs: 4100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const eternalCap = simulate('Core', [{ type: 'wait', durationMs: 70_100 }], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE]
  });
  const perception = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud', 'Blood Curse'], {
    initialResource: 100,
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.DEATH_PERCEPTION]
  });

  assert.equal(signets.endState.profession.lifeForce, 4);
  assert.ok(signets.breakdown.some((entry) => entry.name === 'Signet of Vampirism - Passive Life Siphon'));
  assert.equal(battery.endState.profession.maximumLifeForce, 120);
  assert.equal(battery.endState.profession.lifeForce, 120);
  assert.equal(eternal.endState.profession.lifeForce, 12);
  assert.equal(eternalCap.endState.profession.lifeForce, 66);
  const lifeBlast = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIFE_BLAST
  );
  const bloodCurse = perception.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.BLOOD_CURSE
  );

  assert.ok(Math.abs(lifeBlast.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(lifeBlast.criticalDamage - 1.8333333333333333) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalDamage - 1.8333333333333333) < 1e-12);
});

test('the Power Harbinger trait set uses current critical and resource rules', () => {
  const runShroudStrike = (selectedTraitIds) =>
    simulate('Harbinger', ['Harbinger Shroud', 'Tainted Bolts'], {
      stats: { precision: 4000 },
      selectedTraitIds,
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
        conditions: {
          ...baseConfig.target.conditions,
          Torment: true
        }
      }
    });
  const base = runShroudStrike([]);
  const deathPerception = runShroudStrike([TRAIT.DEATH_PERCEPTION]);
  const wickedCorruption = runShroudStrike([TRAIT.WICKED_CORRUPTION]);
  const both = runShroudStrike([TRAIT.DEATH_PERCEPTION, TRAIT.WICKED_CORRUPTION]);
  const strikeDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.TAINTED_BOLTS)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(Math.abs(strikeDamage(deathPerception) / strikeDamage(base) - 1.1) < 1e-12);
  assert.ok(Math.abs(strikeDamage(wickedCorruption) / strikeDamage(base) - 1.1) < 1e-12);
  assert.ok(Math.abs(strikeDamage(both) / strikeDamage(base) - 1.21) < 1e-12);

  const implacable = simulate('Harbinger', ['Harbinger Shroud'], {
    selectedTraitIds: [TRAIT.IMPLACABLE_FOE]
  });

  assert.equal(
    implacable.events.some(
      (event) => event.type === 'buff' && event.kind === 'stability' && event.stacks === 3 && event.duration === 5
    ),
    true
  );

  const fortitude = simulate('Harbinger', ['Perforate'], {
    initialResource: 0,
    primaryWeapon: 'Spear',
    selectedTraitIds: [TRAIT.SPITEFUL_FORTITUDE, TRAIT.GLUTTONY],
    target: {
      ...baseConfig.target,
      health: 8000
    }
  });

  assert.equal(fortitude.endState.profession.lifeForce, 2.2);
});

test('critical sigils follow the active weapon set', () => {
  const result = simulate(
    'Harbinger',
    ['Vile Blast', 'Swap Weapons', 'Grasping Dead', { type: 'wait', durationMs: 2100 }],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Torch',
      weaponSet2Primary: 'Scepter',
      weaponSet2Secondary: 'Dagger',
      stats: { precision: 4000 },
      sigilSets: [
        { names: ['Torment'], strike: 1, condition: 1 },
        { names: ['Earth'], strike: 1, condition: 1 }
      ]
    }
  );

  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Torment'),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Earth'),
    true
  );
});
