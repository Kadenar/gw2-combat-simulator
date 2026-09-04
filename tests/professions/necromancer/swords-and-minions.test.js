import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

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

test('Necromancer wells use their EVTC packet schedules after the final rotation action', () => {
  const schedules = new Map([
    ['Well of Corruption', [320, 1280, 2280, 3280, 4280, 5280]],
    ['Well of Darkness', [280, 1280, 2280, 3280, 4280, 5280]],
    ['Well of Suffering', [280, 1280, 2280, 3280, 4280, 5280]]
  ]);

  for (const [skill, expectedOffsets] of schedules) {
    const result = simulate(
      'Harbinger',
      [skill],
      {
        target: {
          ...baseConfig.target,
          health: 1_000_000_000,
          conditions: {}
        }
      },
      observationTail(6000)
    );
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skill);
    const damage = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === skill);

    assert.deepEqual(
      damage.map((event) => Math.round((event.at - action.at) * 1000)),
      expectedOffsets,
      skill
    );

    if (skill !== 'Well of Suffering') continue;
    const vulnerability = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === skill && event.condition === 'Vulnerability'
    );
    assert.deepEqual(
      vulnerability.map((event) => [Math.round((event.at - action.at) * 1000), event.stacks, event.duration]),
      expectedOffsets.map((atMs) => [atMs, 2, 5])
    );
  }
});

test('Dark Pact gains life force only after ripping a boon and inflicts its target and self conditions', () => {
  const withBoon = simulate('Core', ['Dark Pact'], {
    initialResource: 0,
    primaryWeapon: 'Dagger'
  });
  const boonless = simulate('Core', ['Dark Pact'], {
    initialResource: 0,
    primaryWeapon: 'Dagger',
    target: {
      ...baseConfig.target,
      boonless: true
    }
  });
  const targetCondition = (condition) =>
    boonless.events.find(
      (event) => event.type === 'condition' && event.skillId === ID.DARK_PACT && event.condition === condition
    );
  const selfBleeding = boonless.events.find(
    (event) => event.type === 'self_condition' && event.skillId === ID.DARK_PACT && event.condition === 'Bleeding'
  );

  assert.equal(
    boonless.events.find((event) => event.type === 'damage' && event.skillId === ID.DARK_PACT)?.coefficient,
    2.4
  );
  assert.equal(withBoon.endState.profession.lifeForce, 5);
  assert.equal(boonless.endState.profession.lifeForce, 0);
  assert.deepEqual([targetCondition('Bleeding')?.stacks, targetCondition('Bleeding')?.duration], [2, 10]);
  assert.deepEqual([selfBleeding?.stacks, selfBleeding?.duration], [2, 10]);
  assert.equal(targetCondition('Immobilized')?.duration, 6);
});

test('Life Siphon uses its current PvE strike and bleeding mechanics', () => {
  const lifeSiphon = (targetBleeding) =>
    simulate(
      'Core',
      ['Life Siphon'],
      {
        primaryWeapon: 'Dagger',
        target: {
          ...baseConfig.target,
          conditions: {
            ...baseConfig.target.conditions,
            Bleeding: targetBleeding
          }
        }
      },
      observationTail(5000)
    );
  const plain = lifeSiphon(false);
  const bleeding = lifeSiphon(true);
  const siphonDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === ID.LIFE_SIPHON)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.deepEqual(
    plain.events
      .filter((event) => event.type === 'self_condition' && event.skillId === ID.LIFE_SIPHON)
      .map((event) => [event.condition, event.stacks, event.duration]),
    [['Bleeding', 1, 8]]
  );
  assert.equal(plain.events.filter((event) => event.type === 'damage' && event.skillId === ID.LIFE_SIPHON).length, 9);
  assert.ok(Math.abs(siphonDamage(bleeding) / siphonDamage(plain) - 1.5) < 1e-12);
});

test('Overflowing Thirst grants the documented Taste for Blood stacks to five party members', () => {
  const cases = [
    ['Life Siphon', ID.LIFE_SIPHON, 3],
    ['Dark Pact', ID.DARK_PACT, 3],
    ['Deathly Swarm', ID.DEATHLY_SWARM, 3],
    ['Enfeebling Blood', ID.ENFEEBLING_BLOOD, 3]
  ];

  for (const [name, skillId, stacks] of cases) {
    const result = simulate(
      'Core',
      [name],
      {
        primaryWeapon: 'Dagger',
        secondaryWeapon: 'Dagger',
        selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
        allies: { count: 4 }
      },
      observationTail(2000)
    );
    const application = result.events.find(
      (event) => event.type === 'buff' && event.kind === 'taste-for-blood' && event.skillId === skillId
    );

    assert.equal(application?.stacks, stacks, name);
    assert.equal(application?.resolvedAudience.alliedPlayerCount, 4, name);
    assert.equal(application?.resolvedAudience.recipientCount, 5, name);
  }

  const chain = simulate('Core', ['Necrotic Slash', 'Necrotic Stab', 'Necrotic Bite'], {
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
  });
  const applications = chain.events.filter((event) => event.type === 'buff' && event.kind === 'taste-for-blood');

  assert.deepEqual(
    applications.map((event) => [event.skillId, event.stacks]),
    [[ID.NECROTIC_BITE, 1]]
  );
});

test('Taste for Blood consumes one stack per direct hit and uses its power-only life-siphon formula', () => {
  const lifeSiphon = simulate(
    'Core',
    ['Life Siphon'],
    {
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
    },
    observationTail(3000)
  );
  const chain = simulate('Core', ['Necrotic Slash', 'Necrotic Stab', 'Necrotic Bite', 'Necrotic Slash'], {
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
  });
  const lifeSiphonPackets = lifeSiphon.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const chainPackets = chain.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const breakdown = skillBreakdownRows(lifeSiphon).find((row) => row.name === 'Taste for Blood');
  const traitIcon = necromancerCatalog.traits.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon;

  assert.equal(lifeSiphonPackets.length, 3);
  assert.equal(chainPackets.length, 1);
  assert.equal(breakdown?.icon, traitIcon);
  assert.equal(
    lifeSiphonPackets.every(
      (event) =>
        event.coefficient === 0 &&
        event.flatStrikeBase === 375 &&
        event.flatStrikePowerCoeff === 0.05 &&
        event.damage === 475 &&
        event.damageKind === 'life-steal' &&
        event.noCrit === true
    ),
    true
  );
});

test('Taste for Blood procs use Overflowing Thirst artwork and log their triggering skill', () => {
  const result = simulate(
    'Ritualist',
    ['Dark Pact', "Ritualist's Shroud", 'Wanderlust'],
    {
      initialResource: 100,
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.OVERFLOWING_THIRST]
    },
    observationTail(5000)
  );
  const traitIcon = necromancerCatalog.traits.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon;
  const wanderlustProc = result.procSteps.find(
    (proc) => proc.skill === 'Taste for Blood' && proc.sourceSkill === 'Wanderlust'
  );
  const eventRows = simulationEventLogRows(result, null, necromancerProfession);

  assert.equal(wanderlustProc?.icon, traitIcon);
  assert.equal(
    eventRows.some((row) => row.description === 'BUFF Taste for Blood x3 (10s)'),
    true
  );
  assert.equal(
    eventRows.some((row) => row.description.startsWith('HIT Taste for Blood [Triggered by Wanderlust]')),
    true
  );
});

test('allied players consume independent Taste for Blood stack pools', () => {
  const result = simulate(
    'Core',
    ['Life Siphon'],
    {
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
      allies: { count: 2, strikesPerSecond: 10 }
    },
    observationTail(3000)
  );
  const packets = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.OVERFLOWING_THIRST
  );
  const triggerCounts = packets.reduce((counts, event) => {
    counts[event.triggeredBy] = (counts[event.triggeredBy] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(triggerCounts, {
    'Allied Player 1 Attack': 3,
    'Allied Player 2 Attack': 3,
    'Life Siphon': 3
  });
});

test('Taste for Blood buff state gives minions independent pools regardless of boon sharing', () => {
  const run = (allies) =>
    simulate(
      'Core',
      ['Summon Bone Minions', 'Life Siphon', { type: 'wait', durationMs: 5000 }],
      {
        primaryWeapon: 'Dagger',
        selectedSkills: ['Summon Bone Minions'],
        selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
        allies: { count: allies, strikesPerSecond: 0 },
        sharePlayerBoonsWithSummons: false
      },
      observationTail(3000)
    );
  const minionPacketOwners = (result) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'damage' &&
          event.sourceId === TRAIT.OVERFLOWING_THIRST &&
          String(event.summonOwner).startsWith('minion:bone-minion:')
      )
      .map((event) => event.summonOwner);
  const uncapped = run(0);
  const partiallyCapped = run(3);
  const capped = run(4);
  const uncappedOwners = minionPacketOwners(uncapped);

  assert.equal(
    uncapped.events.some((event) => event.type === 'buff' && event.kind === 'taste-for-blood'),
    true
  );
  assert.equal(uncappedOwners.includes('minion:bone-minion:0'), true);
  assert.equal(uncappedOwners.includes('minion:bone-minion:1'), true);
  assert.deepEqual([...new Set(minionPacketOwners(partiallyCapped))], ['minion:bone-minion:0']);
  assert.deepEqual(minionPacketOwners(capped), []);
});

test('Taste for Blood excludes active Ritualist spirits from its shared stack pools', () => {
  const result = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', "Exit Ritualist's Shroud", 'Life Siphon', { type: 'wait', durationMs: 5000 }],
    {
      initialResource: 100,
      primaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.LINGERING_SPIRITS, TRAIT.OVERFLOWING_THIRST],
      sharePlayerBoonsWithSummons: true
    },
    observationTail(3000)
  );
  const application = result.events.find(
    (event) => event.type === 'buff' && event.kind === 'taste-for-blood' && event.skillId === ID.LIFE_SIPHON
  );
  const spiritPackets = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.sourceId === TRAIT.OVERFLOWING_THIRST &&
      String(event.triggeredBy).endsWith('Autoattack')
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(application.resolvedAudience.companionIds, []);
  assert.equal(spiritPackets.length, 0);
});

test('off-hand sword follow-ups use their complete PvE effects', () => {
  const result = simulate(
    'Core',
    ['Hungering Maelstrom', 'Devouring Visage', 'Gormandize', 'Consume'],
    {
      boons: { quickness: true },
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword',
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(3000)
  );
  const damage = (skillId) => result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    damage(ID.HUNGERING_MAELSTROM).map((event) => event.coefficient),
    [2.75]
  );
  assert.deepEqual(
    damage(ID.DEVOURING_VISAGE).map((event) => event.coefficient),
    [1.5]
  );
  assert.deepEqual(
    damage(ID.GORMANDIZE).map((event) => event.coefficient),
    [2.5]
  );
  assert.deepEqual(
    damage(ID.CONSUME).map((event) => event.coefficient),
    Array(5).fill(0.5)
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' &&
        event.skillId === ID.DEVOURING_VISAGE &&
        event.controlKind === 'fear' &&
        event.duration === 1.5
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillId === ID.CONSUME &&
        event.condition === 'Weakness' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillId === ID.CONSUME &&
        event.kind === 'might' &&
        event.stacks === 5 &&
        event.duration === 8
    ),
    true
  );
});

test('main-hand sword skills use their complete PvE effects', () => {
  const result = simulate(
    'Core',
    ['Ravenous Wave', 'Satiate', 'Path of Gluttony', 'Gorge'],
    {
      boons: { quickness: true },
      initialResource: 0,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(1000)
  );
  const damage = (skillId) => result.events.find((event) => event.type === 'damage' && event.skillId === skillId);

  assert.deepEqual(result.warnings, []);
  assert.equal(damage(ID.RAVENOUS_WAVE)?.coefficient, 2);
  assert.equal(damage(ID.SATIATE)?.coefficient, 2);
  assert.deepEqual(damage(ID.SATIATE)?.coefficientModifiers, [
    {
      kind: 'target-health-below',
      threshold: 0.5,
      multiplier: 1.5
    }
  ]);
  assert.equal(damage(ID.PATH_OF_GLUTTONY)?.coefficient, 2);
  assert.equal(necromancerCatalog.skillsById.get(ID.PATH_OF_GLUTTONY).comboFinishers[0].finisherType, 'Leap');
  assert.equal(damage(ID.GORGE)?.coefficient, 2);
  assert.equal(necromancerCatalog.skillsById.get(ID.GORGE).comboFinishers[0].finisherType, 'Leap');
  assert.equal(result.endState.profession.lifeForce, 12);
});

test('Satiate expires after three seconds and base sword cooldowns continue during follow-ups', () => {
  const config = {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  };
  const withinWindow = simulate('Core', ['Ravenous Wave', { type: 'wait', durationMs: 2900 }, 'Satiate'], config);
  const expired = simulate('Core', ['Ravenous Wave', { type: 'wait', durationMs: 3100 }, 'Satiate'], config);
  const immediatePairs = [
    ['Ravenous Wave', 'Satiate', 6],
    ['Path of Gluttony', 'Gorge', 10],
    ['Hungering Maelstrom', 'Gormandize', 16],
    ['Devouring Visage', 'Consume', 20]
  ];

  assert.deepEqual(withinWindow.warnings, []);
  assert.match(expired.warnings.join(' '), /Satiate is unavailable/);
  for (const [parent, followUp, cooldown] of immediatePairs) {
    const result = simulate('Core', [parent, followUp], config);
    const parentAction = result.events.find((event) => event.type === 'action' && event.skillName === parent);
    const followUpAction = result.events.find((event) => event.type === 'action' && event.skillName === followUp);

    assert.deepEqual(result.warnings, [], `${parent} -> ${followUp}`);
    assert.equal(parentAction.rechargeReadyAt - parentAction.endsAt, cooldown, parent);
    assert.ok(parentAction.rechargeReadyAt > followUpAction.at, parent);
  }
});

test('off-hand sword follow-ups expire after three seconds and rearm after their parent is recast', () => {
  for (const [parent, followUp] of [
    ['Hungering Maelstrom', 'Gormandize'],
    ['Devouring Visage', 'Consume']
  ]) {
    const config = {
      boons: { quickness: true },
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword'
    };
    const withinWindow = simulate('Core', [parent, { type: 'wait', durationMs: 2900 }, followUp], config);
    const expired = simulate('Core', [parent, { type: 'wait', durationMs: 3100 }, followUp], config);
    const rearmed = simulate('Core', [parent, { type: 'wait', durationMs: 3100 }, followUp, parent, followUp], config);
    const followUpActions = (result) =>
      result.events.filter((event) => event.type === 'action' && event.skillName === followUp);

    assert.deepEqual(withinWindow.warnings, [], followUp);
    assert.equal(followUpActions(withinWindow).length, 1, followUp);
    assert.match(expired.warnings.join(' '), new RegExp(`${followUp} is unavailable`), followUp);
    assert.equal(followUpActions(expired).length, 0, followUp);
    assert.match(rearmed.warnings.join(' '), new RegExp(`${followUp} is unavailable`), followUp);
    assert.equal(followUpActions(rearmed).length, 1, followUp);
  }
});

test('Plaguelands, chill fields, and cooldown reset retain live behavior', () => {
  const plague = simulate(
    'Reaper',
    ['Plaguelands', '__cooldown_reset', 'Plaguelands'],
    {
      stats: { expertise: 1500 },
      selectedSkills: ['Plaguelands'],
      selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION],
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(20_000)
  );
  const field = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", 'Soul Spiral'],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.DEATHLY_CHILL],
      target: {
        ...baseConfig.target,
        health: 1_000_000_000
      }
    },
    observationTail(1000)
  );
  const plagueEvents = (type, condition) =>
    plague.events.filter(
      (event) =>
        event.type === type && event.skillId === ID.PLAGUELANDS && (condition == null || event.condition === condition)
    );

  assert.deepEqual(plague.warnings, []);
  assert.equal(plague.steps.filter((step) => step.skill === 'Plaguelands').length, 2);
  assert.equal(plagueEvents('damage').length, 18);
  assert.equal(plagueEvents('condition', 'Bleeding').length, 18);
  assert.equal(plagueEvents('condition', 'Poisoned').length, 16);
  assert.equal(plagueEvents('condition', 'Torment').length, 14);
  assert.deepEqual(
    plague.events
      .filter((event) => event.type === 'self_condition')
      .slice(0, 2)
      .map((event) => [event.condition, event.duration]),
    [
      ['Bleeding', 10],
      ['Poisoned', 4]
    ]
  );
  assert.equal(
    plague.events.some((event) => event.type === 'marker' && event.action === 'cooldown-reset'),
    true
  );
  assert.equal(
    field.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.DEATHLY_CHILL).length,
    9
  );
});

test('Death Spiral includes its life-siphon damage packet', () => {
  const result = simulate('Reaper', ['Death Spiral'], {
    primaryWeapon: 'Greatsword'
  });
  const packets = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.DEATH_SPIRAL);
  const siphon = packets.find((event) => event.damageKind === 'life-steal');
  const resolvedSiphon = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.DEATH_SPIRAL && event.damageKind === 'life-steal'
  );

  assert.deepEqual(
    packets.map((event) => event.name),
    ['Death Spiral', 'Death Spiral — Life Siphon']
  );
  assert.equal(siphon?.flatStrikeBase, 3517);
  assert.equal(siphon?.flatStrikePowerCoeff, 0.01);
  assert.equal(siphon?.noCrit, true);
  assert.equal(resolvedSiphon?.criticalChance, 0);
  assert.equal(resolvedSiphon?.damage, 3537);

  const rows = new Map(skillBreakdownRows(result).map((row) => [row.name, row]));

  assert.equal(rows.get('Death Spiral').hits, 1);
  assert.equal(rows.get('Death Spiral — Life Siphon').hits, 1);
  assert.equal(rows.get('Death Spiral — Life Siphon').parentSkill, 'Death Spiral');
});

test('Necromancer dark-field life steals inherit finisher attribution', () => {
  const scenarios = [
    {
      rotation: ['Nightfall', 'Death Spiral'],
      config: { primaryWeapon: 'Greatsword' },
      parentSkill: 'Death Spiral',
      hits: 2
    },
    {
      rotation: ['Nightfall', 'Gravedigger'],
      config: { primaryWeapon: 'Greatsword' },
      parentSkill: 'Gravedigger',
      hits: 3
    },
    {
      rotation: ['Well of Darkness', 'Extirpate'],
      config: {
        primaryWeapon: 'Spear',
        selectedSkills: ['Well of Darkness']
      },
      parentSkill: 'Extirpate',
      hits: 3
    }
  ];

  for (const scenario of scenarios) {
    const result = simulate('Ritualist', scenario.rotation, scenario.config);
    const combo = result.resolvedEvents.find(
      (event) =>
        event.type === 'combo' &&
        event.fieldType === 'Dark' &&
        event.finisherType === 'Whirl' &&
        event.skillName === scenario.parentSkill
    );
    const bolts = result.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' &&
        event.name === 'Leeching Bolts' &&
        event.skillName === 'Leeching Bolts' &&
        event.parentSkillName === scenario.parentSkill
    );

    assert.equal(combo.applicationCount, scenario.hits);
    assert.equal(bolts.length, scenario.hits);
    assert.ok(
      bolts.every(
        (event) => event.flatStrikeBase === 170 && event.flatStrikePowerCoeff === 0.03 && event.noCrit === true
      )
    );
    const rows = skillBreakdownRows(result);

    assert.equal(rows.find((row) => row.name === scenario.parentSkill)?.hits, 1);
    const boltRow = rows.find((row) => row.name === 'Leeching Bolts');

    assert.equal(boltRow?.hits, scenario.hits);
    assert.equal(boltRow?.casts, 0);
  }

  const withoutField = simulate('Ritualist', ['Death Spiral'], {
    primaryWeapon: 'Greatsword'
  });

  assert.equal(
    withoutField.resolvedEvents.some((event) => event.type === 'combo' && event.fieldType === 'Dark'),
    false
  );
});

test('Reaper prioritizes assumed Ice and otherwise uses standard field resolution', () => {
  const rotation = ['Nightfall', "Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", 'Gravedigger'];
  const standard = simulate('Reaper', rotation, {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  });
  const assumed = simulate('Reaper', rotation, {
    initialResource: 100,
    primaryWeapon: 'Greatsword',
    boons: { quickness: true },
    professionAssumptions: { permanentIceField: true }
  });
  const standardExtirpate = simulate(
    'Reaper',
    ["Reaper's Shroud", "Executioner's Scythe", "Exit Reaper's Shroud", 'Well of Darkness', 'Extirpate'],
    {
      initialResource: 100,
      primaryWeapon: 'Spear',
      selectedSkills: ['Well of Darkness'],
      boons: { quickness: true }
    }
  );
  const extirpate = simulate('Reaper', ['Well of Darkness', 'Extirpate'], {
    primaryWeapon: 'Spear',
    selectedSkills: ['Well of Darkness'],
    professionAssumptions: { permanentIceField: true }
  });
  const gravediggerCombo = (result) =>
    result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Gravedigger');
  const extirpateCombo = extirpate.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Extirpate'
  );
  const standardExtirpateCombo = standardExtirpate.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Extirpate'
  );

  assert.equal(gravediggerCombo(standard).fieldType, 'Dark');
  assert.equal(gravediggerCombo(assumed).fieldId, 'necromancer:assumption:permanent-ice-field');
  assert.equal(extirpateCombo.fieldId, 'necromancer:assumption:permanent-ice-field');
  assert.equal(standardExtirpateCombo.fieldType, 'Ice');
  assert.deepEqual(standard.warnings, []);
  assert.deepEqual(assumed.warnings, []);
  assert.deepEqual(standardExtirpate.warnings, []);
  assert.deepEqual(extirpate.warnings, []);
});

test('Greatsword control and Nightfall pulses use their live mechanics', () => {
  const nightfallSkill = necromancerCatalog.skillsById.get(ID.NIGHTFALL);
  const executionersScythe = necromancerCatalog.skillsById.get(ID.EXECUTIONERS_SCYTHE);
  const grasp = simulate('Harbinger', ['Grasping Darkness', { type: 'wait', durationMs: 2000 }], {
    initialResource: 0,
    primaryWeapon: 'Greatsword',
    relic: 'Claw'
  });
  const nightfall = simulate('Harbinger', ['Nightfall', { type: 'wait', durationMs: 4000 }], {
    initialResource: 0,
    primaryWeapon: 'Greatsword'
  });
  const nightfallHits = nightfall.events.filter((event) => event.type === 'damage' && event.skillId === ID.NIGHTFALL);

  assert.deepEqual(
    nightfallSkill.effects.map((effect) => effect.type),
    ['strike', 'blind', 'condition']
  );
  assert.deepEqual(
    nightfallSkill.effects.map((effect) => effect.ticks?.length ?? effect.applications ?? effect.hits),
    [4, 4, 4]
  );
  assert.deepEqual(
    executionersScythe.effects.find((effect) => effect.type === 'condition').ticks.map((tick) => tick.atMs),
    [840, 1840, 2840, 3840, 4840]
  );
  assert.deepEqual(
    executionersScythe.effects.find((effect) => effect.type === 'strike').ticks.map((tick) => tick.atMs),
    [840]
  );
  assert.deepEqual(
    grasp.events
      .filter((event) => event.type === 'damage' && event.skillId === ID.GRASPING_DARKNESS)
      .map((event) => event.coefficient),
    [1.3]
  );
  assert.equal(grasp.endState.profession.lifeForce, 10);
  assert.equal(
    grasp.events.some((event) => event.type === 'necromancer.chill' && event.skillId === ID.GRASPING_DARKNESS),
    true
  );
  assert.equal(
    grasp.events.some((event) => event.type === 'control' && event.controlKind === 'pull'),
    true
  );
  assert.equal(
    grasp.procSteps.some((step) => step.skill === 'Relic of the Claw'),
    true
  );

  assert.equal(nightfallHits.length, 4);
  const nightfallAction = nightfall.events.find((event) => event.type === 'action' && event.skillName === 'Nightfall');
  assert.deepEqual(
    nightfallHits.map((event) => Math.round((event.at - nightfallAction.at) * 1000)),
    [560, 1560, 2560, 3560]
  );
  assert.deepEqual(
    nightfallHits.map((event) => event.coefficient),
    [1.15, 1.15, 1.15, 1.15]
  );
  assert.deepEqual(
    nightfallHits.map((event, index) => Math.round((event.at - nightfallHits[0].at) * 1000) - index * 1000),
    [0, 0, 0, 0]
  );
  assert.equal(nightfall.events.filter((event) => event.type === 'blind' && event.skillId === ID.NIGHTFALL).length, 4);
  assert.equal(
    nightfall.events.filter(
      (event) => event.type === 'condition' && event.skillId === ID.NIGHTFALL && event.condition === 'Crippled'
    ).length,
    4
  );
  assert.equal(nightfall.endState.profession.lifeForce, 28);
});

test('Nightfall commits its declarative field at the first pulse', () => {
  const beforeCommit = simulate(
    'Harbinger',
    [
      {
        name: 'Nightfall',
        interruptAfterMs: 400
      },
      {
        type: 'wait',
        durationMs: 4000
      }
    ],
    {
      initialResource: 0,
      primaryWeapon: 'Greatsword'
    }
  );
  const afterCommit = simulate('Harbinger', ['Nightfall', { type: 'wait', durationMs: 4000 }], {
    initialResource: 0,
    primaryWeapon: 'Greatsword'
  });
  const quickness = simulate('Harbinger', ['Nightfall', { type: 'wait', durationMs: 4000 }], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: 'Greatsword'
  });
  const nightfallHits = (result) =>
    result.events.filter((event) => event.type === 'damage' && event.skillId === ID.NIGHTFALL);

  assert.equal(nightfallHits(beforeCommit).length, 0);
  assert.equal(beforeCommit.endState.profession.lifeForce, 0);
  assert.equal(nightfallHits(afterCommit).length, 4);
  assert.equal(afterCommit.endState.profession.lifeForce, 28);
  assert.equal(quickness.steps[0].fullCastMs, 480);
  assert.deepEqual(
    nightfallHits(quickness).map(
      (event, index) => Math.round(event.at * 1000 - quickness.steps[0].start) - index * 1000
    ),
    [560, 560, 560, 560]
  );
});

test('Lich Form swaps its bar and grants life force on exit', () => {
  const result = simulate('Core', ['Lich Form', 'Deathly Claws', 'Exit Lich Form'], { initialResource: 0 });
  const invalid = simulate('Core', ['Lich Form', 'Rending Claws'], {
    initialResource: 0,
    primaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, '');
  assert.ok(result.endState.profession.lifeForce >= 15);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Deathly Claws'));
  assert.match(invalid.warnings.join(' '), /Rending Claws is unavailable/);
});

test('minion summons persist, attack, and unlock their command', () => {
  const result = simulate('Core', [
    'Summon Bone Fiend',
    { type: 'wait', durationMs: 4000 },
    'Rigor Mortis',
    { type: 'wait', durationMs: 1000 }
  ]);
  const invalid = simulate('Core', ['Rigor Mortis']);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeMinions['bone-fiend'], 1);
  assert.ok(result.breakdown.some((entry) => entry.name === 'Bone Shard'));
  assert.ok(result.breakdown.some((entry) => entry.name === 'Rigor Mortis - Bone Shard'));
  assert.match(invalid.warnings.join(' '), /Rigor Mortis is unavailable/);
});

test('Bone Fiend uses paired Bone Shards and its fourth crippling volley', () => {
  const result = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 14_000 }], {
    selectedSkills: ['Summon Bone Fiend']
  });
  const attacks = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Minion' && [3633, 3644].includes(event.skillId)
  );
  const ordinary = attacks.filter((event) => event.skillId === 3633);
  const crippling = attacks.filter((event) => event.skillId === 3644);
  const cripples = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === 3644 && event.condition === 'Crippled'
  );

  assert.deepEqual(
    attacks.map((event) => event.skillId),
    [3633, 3633, 3633, 3633, 3633, 3633, 3644, 3644]
  );
  assert.equal(
    ordinary.every((event) => event.coefficient === 0.1),
    true
  );
  assert.equal(
    crippling.every((event) => event.coefficient === 0.2),
    true
  );
  assert.equal(
    attacks.every(
      (event) =>
        event.comboFinishers[0].ownerId === 'necromancer' &&
        event.comboFinishers[0].finisherType === 'Projectile' &&
        event.comboFinishers[0].chance === 1
    ),
    true
  );
  assert.ok(Math.abs(ordinary[1].at - ordinary[0].at - 0.04) < 1e-12);
  assert.ok(Math.abs(ordinary[2].at - ordinary[0].at - 3.08) < 1e-12);
  assert.equal(attacks[0].summonBasePower, 1500);
  assert.equal(attacks[0].summonDamagePerCoefficient, 1430);
  assert.equal(attacks[0].weaponStrength, undefined);
  assert.deepEqual(
    cripples.map((event) => [event.stacks, event.duration]),
    [
      [1, 2],
      [1, 2]
    ]
  );
});

test('Vampiric siphons on every direct player and minion hit with separate power scaling', () => {
  const player = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const condition = simulate('Core', ['Blood Curse', { type: 'wait', durationMs: 2000 }], {
    primaryWeapon: 'Scepter',
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const minion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC],
    stats: { power: 1000 }
  });
  const playerSiphons = player.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC
  );
  const conditionSiphons = condition.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC
  );
  const minionHits = minion.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Minion' && event.skillId === 3633
  );
  const minionSiphons = minion.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Vampiric — Minion Life Steal'
  );
  const vampiricIcon = necromancerCatalog.traits.find((trait) => trait.id === TRAIT.VAMPIRIC)?.icon;
  const playerRow = skillBreakdownRows(player).find((row) => row.name === 'Vampiric');
  const minionRow = skillBreakdownRows(minion).find((row) => row.name === 'Vampiric — Minion Life Steal');

  // Ghastly Claws proves there is no internal cooldown: all eight packets siphon.
  assert.equal(playerSiphons.length, 8);
  assert.equal(
    playerSiphons.every(
      (event) =>
        event.flatStrikeBase === 38 &&
        event.flatStrikePowerCoeff === 0.003 &&
        event.damage === 41 &&
        event.damageKind === 'life-steal' &&
        event.criticalChance === 0
    ),
    true
  );
  assert.equal(conditionSiphons.length, 1);
  assert.equal(minionHits.length > 0, true);
  assert.equal(minionSiphons.length, minionHits.length);
  assert.equal(playerRow?.icon, vampiricIcon);
  assert.equal(minionRow?.icon, vampiricIcon);
  assert.equal(
    minionSiphons.every(
      (event) =>
        event.flatStrikeBase === 50 &&
        event.flatStrikePowerCoeff === 0.0213 &&
        event.damage === 71.3 &&
        event.triggeredBy === 'Bone Shard'
    ),
    true
  );
});

test('Blood Magic siphons preserve independent pools and intervals across four ordinary minions', () => {
  const result = simulate(
    'Core',
    [
      'Summon Blood Fiend',
      'Summon Bone Minions',
      'Summon Flesh Golem',
      'Life Siphon',
      { type: 'wait', durationMs: 5000 }
    ],
    {
      primaryWeapon: 'Dagger',
      selectedSkills: ['Summon Blood Fiend', 'Summon Bone Minions', 'Summon Flesh Golem'],
      selectedTraitIds: [TRAIT.VAMPIRIC, TRAIT.VAMPIRIC_PRESENCE, TRAIT.OVERFLOWING_THIRST],
      stats: { power: 1000 }
    },
    observationTail(3000)
  );
  const owners = ['minion:blood-fiend:0', 'minion:bone-minion:0', 'minion:bone-minion:1', 'minion:flesh-golem:0'];
  const application = result.events.find(
    (event) => event.type === 'buff' && event.kind === 'taste-for-blood' && event.skillId === ID.LIFE_SIPHON
  );
  const minionHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && owners.includes(event.summonOwner)
  );
  const vampiric = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Vampiric — Minion Life Steal'
  );
  const presence = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Vampiric Presence' && owners.includes(event.summonOwner)
  );
  const taste = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Taste for Blood' && owners.includes(event.summonOwner)
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(new Set(application.resolvedAudience.companionIds), new Set(owners));
  assert.equal(application.resolvedAudience.recipientCount, 5);
  assert.equal(minionHits.length > 0, true);
  assert.equal(vampiric.length, minionHits.length);
  assert.equal(presence.length, minionHits.length);
  assert.deepEqual(new Set(taste.map((event) => event.summonOwner)), new Set(owners));
  assert.equal(
    owners.every((owner) => taste.filter((event) => event.summonOwner === owner).length <= 3),
    true
  );
});

test("Ritualist spirit attacks proc Vampiric and share the owner's Vampiric Presence interval", () => {
  const result = simulate(
    'Ritualist',
    ["Ritualist's Shroud", 'Anguish', 'Wanderlust', 'Preservation', { type: 'wait', durationMs: 8000 }],
    {
      initialResource: 100,
      selectedTraitIds: [TRAIT.VAMPIRIC, TRAIT.VAMPIRIC_PRESENCE],
      stats: { power: 1000 }
    }
  );
  const spiritAutos = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' && event.summonKind === 'spirit' && event.metadata?.spiritAttackType === 'autoattack'
  );
  const spiritAutoTimes = new Set(spiritAutos.map((event) => event.at));
  const spiritVampiric = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC && String(event.triggeredBy).endsWith('Autoattack')
  );
  const spiritPresence = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.sourceId === TRAIT.VAMPIRIC_PRESENCE &&
      String(event.triggeredBy).endsWith('Autoattack')
  );

  assert.equal(spiritAutos.length > 0, true);
  assert.equal(spiritVampiric.length, spiritAutos.length);
  assert.equal(
    spiritVampiric.every((event) => event.flatStrikeBase === 38 && event.flatStrikePowerCoeff === 0.003),
    true
  );
  assert.equal(spiritPresence.length, spiritAutoTimes.size);
  assert.deepEqual(new Set(spiritPresence.map((event) => event.at)), spiritAutoTimes);
});

test('Vampiric Presence uses its half-second interval and stronger Shroud siphon', () => {
  const base = simulate('Core', ['Ghastly Claws'], {
    primaryWeapon: 'Axe',
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const shroud = simulate('Core', ['Death Shroud', 'Life Blast', 'End Death Shroud'], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const baseSiphons = base.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC_PRESENCE
  );
  const shroudSiphon = shroud.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.VAMPIRIC_PRESENCE
  );

  assert.deepEqual(
    baseSiphons.map((event) => Number(event.at.toFixed(2))),
    [0.27, 0.81, 1.35, 1.89]
  );
  assert.equal(
    baseSiphons.every(
      (event) =>
        event.flatStrikeBase === 65 &&
        event.flatStrikePowerCoeff === 0.0333 &&
        Math.abs(event.damage - 98.3) < 1e-12 &&
        event.damageKind === 'life-steal' &&
        event.criticalChance === 0
    ),
    true
  );
  assert.equal(shroudSiphon.flatStrikeBase, 129);
  assert.equal(shroudSiphon.flatStrikePowerCoeff, 0.0666);
  assert.ok(Math.abs(shroudSiphon.damage - 195.6) < 1e-12);
});

test('Vampiric Presence supports four allied players and respects its five-target cap', () => {
  const allies = simulate('Core', [{ type: 'wait', durationMs: 1100 }], {
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 },
    allies: { count: 10, strikesPerSecond: 10 }
  });
  const minion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 }
  });
  const cappedMinion = simulate('Core', ['Summon Bone Fiend', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
    stats: { power: 1000 },
    allies: { count: 4, strikesPerSecond: 0 }
  });
  const boneMinions = (allies = 0) =>
    simulate('Core', ['Summon Bone Minions', { type: 'wait', durationMs: 4500 }], {
      selectedSkills: ['Summon Bone Minions'],
      selectedTraitIds: [TRAIT.VAMPIRIC_PRESENCE],
      stats: { power: 1000 },
      allies: { count: allies, strikesPerSecond: 0 }
    });
  const alliedSiphons = allies.resolvedEvents.filter(
    (event) => event.type === 'damage' && String(event.triggeredBy).startsWith('Allied Player')
  );
  const alliedRows = simulationEventLogRows(allies, null, necromancerProfession).filter((row) =>
    row.description.startsWith('HIT Vampiric Presence')
  );
  const minionSiphons = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.name === 'Vampiric Presence' && event.triggeredBy === 'Bone Shard'
    );
  const boneMinionSiphons = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'damage' &&
        event.name === 'Vampiric Presence' &&
        String(event.summonOwner).startsWith('minion:bone-minion:')
    );
  const uncappedBoneMinions = boneMinions();
  const partiallyCappedBoneMinions = boneMinions(3);

  assert.equal(alliedSiphons.length, 8);
  assert.deepEqual(
    [...new Set(alliedSiphons.map((event) => event.triggeredBy))],
    ['Allied Player 1 Attack', 'Allied Player 2 Attack', 'Allied Player 3 Attack', 'Allied Player 4 Attack']
  );
  assert.equal(alliedRows.length, 8);
  for (let allyIndex = 1; allyIndex <= 4; allyIndex += 1) {
    assert.equal(
      alliedRows.some((row) => row.description.includes(`[Allied Player ${allyIndex} Attack]`)),
      true
    );
  }

  assert.equal(
    alliedSiphons.every((event) => Math.abs(event.damage - 98.3) < 1e-12),
    true
  );
  assert.equal(minionSiphons(minion).length > 0, true);
  assert.equal(minionSiphons(cappedMinion).length, 0);
  assert.deepEqual(
    [...new Set(boneMinionSiphons(uncappedBoneMinions).map((event) => event.summonOwner))],
    ['minion:bone-minion:0', 'minion:bone-minion:1']
  );
  assert.deepEqual(
    [...new Set(boneMinionSiphons(partiallyCappedBoneMinions).map((event) => event.summonOwner))],
    ['minion:bone-minion:0']
  );
  assert.equal(
    simulationEventLogRows(uncappedBoneMinions, null, necromancerProfession).some((row) =>
      row.description.startsWith('HIT Vampiric Presence [Bone Minion #1]')
    ),
    true
  );
});

test('Rigor Mortis is instant and fires two immobilizing projectile finishers', () => {
  const result = simulate('Core', ['Summon Bone Fiend', 'Rigor Mortis', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Fiend'],
    selectedTraitIds: [TRAIT.INSIDIOUS_DISRUPTION]
  });
  const preservedChain = simulate(
    'Core',
    ['Summon Bone Fiend', { type: 'wait', durationMs: 9500 }, 'Rigor Mortis', { type: 'wait', durationMs: 3000 }],
    { selectedSkills: ['Summon Bone Fiend'] }
  );
  const rigorStep = result.steps.find((step) => step.skill === 'Rigor Mortis');
  const attacks = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === 3634);
  const controls = result.events.filter(
    (event) =>
      event.type === 'necromancer.summon-attack' && event.skillId === 3634 && event.controlKind === 'immobilize'
  );
  const controlledFollowup = result.events.filter(
    (event) =>
      event.type === 'necromancer.summon-attack' && event.skillId === 3633 && event.controlKind === 'immobilize'
  );
  const disruptionTorment = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.INSIDIOUS_DISRUPTION
  );
  const preservedRigorStep = preservedChain.steps.find((step) => step.skill === 'Rigor Mortis');
  const firstFollowup = preservedChain.resolvedEvents.find(
    (event) =>
      event.type === 'damage' && [3633, 3644].includes(event.skillId) && event.at * 1000 > preservedRigorStep.start
  );

  assert.equal(necromancerCatalog.skillsByName.get('Rigor Mortis').recharge, 50);
  assert.equal(rigorStep.fullCastMs, 0);
  assert.deepEqual(
    attacks.map((event) => [event.coefficient, event.comboFinishers[0].chance]),
    [
      [0.25, 1],
      [0.25, 1]
    ]
  );
  assert.equal(
    attacks.every(
      (event) =>
        event.comboFinishers[0].finisherType === 'Projectile' && event.comboFinishers[0].ownerId === 'necromancer'
    ),
    true
  );
  assert.deepEqual(
    controls.map((event) => [event.controlKind, event.controlDuration]),
    [
      ['immobilize', 2],
      ['immobilize', 2]
    ]
  );
  assert.equal(controlledFollowup.length, 2);
  assert.equal(disruptionTorment.length, 4);
  assert.equal(firstFollowup.skillId, 3644);
});

test('Bone Fiend projectile finishers create Chilling Bolts, not Frost Aura', () => {
  const executionerField = simulate(
    'Reaper',
    [
      'Summon Bone Fiend',
      "Reaper's Shroud",
      "Executioner's Scythe",
      "Exit Reaper's Shroud",
      { type: 'wait', durationMs: 4000 }
    ],
    {
      initialResource: 100,
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds: [TRAIT.DEATHLY_CHILL]
    }
  );
  const result = simulate(
    'Reaper',
    ['Summon Bone Fiend', 'Nightfall', 'Rigor Mortis', { type: 'wait', durationMs: 14_000 }],
    {
      primaryWeapon: 'Greatsword',
      selectedSkills: ['Summon Bone Fiend'],
      selectedTraitIds: [TRAIT.DEATHLY_CHILL],
      professionAssumptions: { permanentIceField: true }
    }
  );
  const boneShards = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && [3633, 3634, 3644].includes(event.skillId)
  );
  const chillingCombos = result.resolvedEvents.filter(
    (event) => event.type === 'combo' && event.fieldType === 'Ice' && event.finisherType === 'Projectile'
  );
  const deathlyChill = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.DEATHLY_CHILL
  );
  const executionerCombos = executionerField.resolvedEvents.filter(
    (event) =>
      event.type === 'combo' &&
      event.fieldType === 'Ice' &&
      event.finisherType === 'Projectile' &&
      event.actorType === 'summon'
  );

  assert.equal(executionerCombos.length, 2);
  assert.equal(chillingCombos.length, boneShards.length);
  assert.equal(
    result.procSteps.filter(
      (step) => step.skill === 'Deathly Chill' && String(step.sourceSkill).startsWith('Rigor Mortis')
    ).length,
    2
  );
  assert.equal(deathlyChill.length, boneShards.length);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        String(event.kind).toLowerCase().includes('frost') || String(event.name).toLowerCase().includes('frost aura')
    ),
    false
  );
});

test('player boon sharing can be disabled for Necromancer minions', () => {
  const rotation = ['Summon Bone Fiend', 'Blood Is Power', { type: 'wait', durationMs: 4000 }];
  const config = {
    selectedSkills: ['Summon Bone Fiend', 'Blood Is Power'],
    boons: { might: 0, fury: false }
  };
  const shared = simulate('Core', rotation, {
    ...config,
    sharePlayerBoonsWithSummons: true
  });
  const isolated = simulate('Core', rotation, {
    ...config,
    sharePlayerBoonsWithSummons: false
  });
  const capped = simulate('Core', rotation, {
    ...config,
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const minionDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.source === 'Minion' && event.parentSkillName === 'Summon Bone Fiend'
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(minionDamage(shared) > minionDamage(isolated));
  assert.equal(minionDamage(capped), minionDamage(isolated));
  assert.ok(minionDamage(isolated) > 0);

  const sharedMight = shared.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.BLOOD_IS_POWER && event.kind === 'might'
  );
  const cappedMight = capped.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.BLOOD_IS_POWER && event.kind === 'might'
  );

  assert.equal(sharedMight.audience.recipients, 'party');
  assert.deepEqual(sharedMight.resolvedAudience.companionIds, ['minion:bone-fiend:0']);
  assert.equal(sharedMight.resolvedAudience.includesSummons, true);
  assert.equal(cappedMight.resolvedAudience.includesSummons, false);

  const partiallyCapped = simulate(
    'Core',
    ['Summon Bone Minions', 'Blood Is Power', { type: 'wait', durationMs: 4000 }],
    {
      selectedSkills: ['Summon Bone Minions', 'Blood Is Power'],
      boons: { might: 0, fury: false },
      allies: { count: 3, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    }
  );
  const damageByOwner = new Map();

  for (const event of partiallyCapped.resolvedEvents) {
    if (
      event.type === 'damage' &&
      event.source === 'Minion' &&
      String(event.summonOwner).startsWith('minion:bone-minion:')
    ) {
      damageByOwner.set(event.summonOwner, (damageByOwner.get(event.summonOwner) || 0) + event.damage);
    }
  }

  assert.ok(damageByOwner.get('minion:bone-minion:0') > damageByOwner.get('minion:bone-minion:1'));
});

test('unequipped Necromancer slot skills cannot execute', () => {
  const denied = simulate('Core', ['Summon Bone Minions'], {
    selectedSkills: ['Signet of Spite']
  });
  const equipped = simulate('Core', ['Summon Bone Minions'], {
    selectedSkills: ['Summon Bone Minions']
  });

  assert.match(denied.warnings.join(' '), /skill is not equipped/);
  assert.equal(
    denied.resolvedEvents.some((event) => event.skillName === 'Summon Bone Minions - Minion Attack'),
    false
  );
  assert.equal(equipped.warnings.length, 0);
  assert.equal(equipped.endState.profession.activeMinions['bone-minion'], 2);
});

test('persistent minion summons cannot recharge until their minions die', () => {
  for (const summon of ['Summon Bone Fiend', 'Summon Shadow Fiend', 'Summon Flesh Golem']) {
    const result = simulate('Core', [summon, { type: 'wait', durationMs: 60_000 }, summon], {
      selectedSkills: [summon]
    });

    assert.equal(result.steps.filter((step) => step.skill === summon && !step.invalid).length, 1, summon);
    assert.match(result.warnings.join(' '), /summoned minion is still alive/, summon);
    assert.equal(result.endState.cooldowns[summon], undefined, summon);
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(
        { professionState: result.endState.profession },
        necromancerCatalog.skillsByName.get(summon)
      ),
      false,
      summon
    );
  }
});

test('bone minion recharge starts after both minions are destroyed', () => {
  const result = simulate(
    'Core',
    ['Summon Bone Minions', 'Putrid Explosion', 'Putrid Explosion', 'Summon Bone Minions'],
    {
      selectedSkills: ['Summon Bone Minions']
    }
  );
  const summons = result.steps.filter((step) => step.skill === 'Summon Bone Minions' && !step.invalid);
  const explosions = result.steps.filter((step) => step.skill === 'Putrid Explosion' && !step.invalid);

  assert.deepEqual(result.warnings, []);
  assert.equal(explosions.length, 2);
  assert.equal(summons.length, 2);
  assert.equal(explosions[1].start, 2000);
  assert.equal(summons[1].start, 18_500);
  assert.equal(result.endState.profession.activeMinions['bone-minion'], 2);
});

test('minion attacks use their canonical cadence, coefficients, and icons', () => {
  const bloodFiend = simulate('Core', ['Summon Blood Fiend', { type: 'wait', durationMs: 6500 }], {
    selectedSkills: ['Summon Blood Fiend']
  });
  const boneMinions = simulate('Core', ['Summon Bone Minions', { type: 'wait', durationMs: 4000 }], {
    selectedSkills: ['Summon Bone Minions']
  });
  const fleshGolem = simulate('Core', ['Summon Flesh Golem', { type: 'wait', durationMs: 6500 }], {
    selectedSkills: ['Summon Flesh Golem']
  });
  const bloodAttacks = bloodFiend.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Summon Blood Fiend - Minion Attack'
  );
  const boneAttacks = boneMinions.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Summon Bone Minions - Minion Attack'
  );
  const golemAttacks = fleshGolem.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.parentSkillName === 'Summon Flesh Golem'
  );
  const golemIcon = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png';

  assert.ok(bloodAttacks.length >= 2);
  assert.equal(
    bloodAttacks.every((event) => event.coefficient === 0.065),
    true
  );
  assert.ok(Math.abs(bloodAttacks[1].at - bloodAttacks[0].at - 3.1) < 1e-12);
  assert.equal(bloodAttacks[0].summonBasePower, 2400);
  assert.equal(bloodAttacks[0].summonDamagePerCoefficient, 4338);
  assert.equal(bloodAttacks[0].weaponStrength, undefined);
  assert.equal(boneAttacks.length, 2);
  assert.equal(boneAttacks[0].summonBasePower, 2250);
  assert.equal(boneAttacks[0].summonDamagePerCoefficient, 4750);
  assert.equal(boneAttacks[0].weaponStrength, undefined);
  assert.deepEqual(
    golemAttacks
      .slice(0, 3)
      .map((event) => [
        event.skillId,
        event.skillName,
        event.coefficient,
        event.summonBasePower,
        event.summonDamagePerCoefficient,
        event.weaponStrength,
        event.icon
      ]),
    [
      [3653, 'Slash', 0.18, 2500, 3744, undefined, golemIcon],
      [3654, 'Slash', 0.18, 2500, 3744, undefined, golemIcon],
      [3655, 'Fist', 0.29, 2500, 3952, undefined, golemIcon]
    ]
  );
});

test('calibrated minion strikes ignore player Power and Signet of Spite', () => {
  for (const summon of ['Summon Blood Fiend', 'Summon Bone Fiend', 'Summon Bone Minions', 'Summon Flesh Golem']) {
    const rotation = [summon, { type: 'wait', durationMs: 6500 }];
    const minionDamage = (result) =>
      result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.source === 'Minion')
        .map((event) => event.damage);
    const lowPower = simulate('Core', rotation, {
      selectedSkills: [summon],
      stats: { power: 1000 }
    });
    const highPower = simulate('Core', rotation, {
      selectedSkills: [summon],
      stats: { power: 3000 }
    });
    const signet = simulate('Core', rotation, {
      selectedSkills: [summon, 'Signet of Spite'],
      stats: { power: 1000 }
    });

    assert.deepEqual(minionDamage(highPower), minionDamage(lowPower), summon);
    assert.deepEqual(minionDamage(signet), minionDamage(lowPower), summon);
  }

  const rotation = ['Summon Blood Fiend', { type: 'wait', durationMs: 6500 }];
  const totalMinionDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.source === 'Minion')
      .reduce((sum, event) => sum + event.damage, 0);
  const base = simulate('Core', rotation, {
    selectedSkills: ['Summon Blood Fiend']
  });
  const corruption = simulate('Core', rotation, {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.NECROMANTIC_CORRUPTION]
  });
  const strength = simulate('Ritualist', rotation, {
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.SPIRITS_STRENGTH]
  });

  assert.ok(Math.abs(totalMinionDamage(corruption) / totalMinionDamage(base) - 1.25) < 1e-12);
  assert.ok(Math.abs(totalMinionDamage(strength) / totalMinionDamage(base) - 1.5) < 1e-12);
});

test('independent minions inherit dynamically shared Fury', () => {
  const rotation = [
    'Summon Blood Fiend',
    "Ritualist's Shroud",
    'Wanderlust',
    "Exit Ritualist's Shroud",
    { type: 'wait', durationMs: 6500 }
  ];
  const firstBloodFiendAttack = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.source === 'Minion' && event.skillId === ID.SUMMON_BLOOD_FIEND
    );
  const base = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend']
  });
  const empowered = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS]
  });
  const capped = simulate('Ritualist', rotation, {
    initialResource: 100,
    selectedSkills: ['Summon Blood Fiend'],
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS],
    allies: { count: 4, strikesPerSecond: 1 },
    sharePlayerBoonsWithSummons: true
  });
  const spiritRotation = ["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 6500 }];
  const spiritBase = simulate('Ritualist', spiritRotation, {
    initialResource: 100
  });
  const spiritEmpowered = simulate('Ritualist', spiritRotation, {
    initialResource: 100,
    selectedTraitIds: [TRAIT.EMPOWERING_SPIRITS],
    sharePlayerBoonsWithSummons: true
  });

  assert.equal(firstBloodFiendAttack(base).criticalChance, 0.05);
  assert.equal(firstBloodFiendAttack(empowered).criticalChance, 0.3);
  assert.equal(firstBloodFiendAttack(capped).criticalChance, 0.05);
  assert.ok(spiritBase.resolvedEvents.length > 0);
  const spiritBoons = spiritEmpowered.events.filter(
    (event) => event.type === 'buff' && event.skillId === ID.WANDERLUST && ['quickness', 'fury'].includes(event.kind)
  );

  assert.equal(spiritBoons.length, 2);
  assert.ok(
    spiritBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.includesSummons === true &&
        event.resolvedAudience.companionIds.length === 1 &&
        event.resolvedAudience.companionIds[0] === 'spirit:wanderlust'
    )
  );
});

test("Shadow Fiend reports Slash and Haunt's full command effects", () => {
  const summonOnly = simulate('Core', ['Summon Shadow Fiend'], {
    initialResource: 0,
    selectedSkills: ['Summon Shadow Fiend']
  });
  const result = simulate('Core', ['Summon Shadow Fiend', 'Haunt', { type: 'wait', durationMs: 4500 }], {
    initialResource: 0,
    selectedSkills: ['Summon Shadow Fiend']
  });
  const haunt = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.HAUNT);
  const slash = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === 3642);
  const blind = result.events.find((event) => event.type === 'blind' && event.skillId === ID.HAUNT);
  const conditionDuration = (condition) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.HAUNT && event.condition === condition
    )?.duration;

  assert.deepEqual(result.warnings, []);
  assert.equal(haunt.coefficient, 0.4);
  assert.equal(haunt.summonDamagePerCoefficient, 1750);
  assert.equal(haunt.summonBasePower, 1700);
  assert.equal(haunt.summonCriticalChance, 0.05);
  assert.equal(haunt.summonCriticalDamage, 1.5);
  assert.equal(slash.skillName, 'Slash');
  assert.equal(slash.parentSkillName, 'Summon Shadow Fiend');
  assert.equal(slash.coefficient, 0.3);
  assert.equal(slash.summonDamagePerCoefficient, 1750);
  assert.equal(slash.summonBasePower, 1700);
  assert.equal(slash.weaponStrength, undefined);
  assert.equal(haunt.at - result.events.find((event) => event.type === 'action' && event.skillId === ID.HAUNT)?.at, 2);
  assert.equal(blind.duration, 5);
  assert.equal(conditionDuration('Chilled'), 3);
  assert.equal(conditionDuration('Weakness'), 5);
  assert.equal(result.endState.profession.lifeForce - summonOnly.endState.profession.lifeForce, 10);
});

test('Sinister Shroud reduces shroud-skill recharge by fifteen percent', () => {
  const rotation = ["Ritualist's Shroud", 'Anguish', 'Anguish'];
  const base = simulate('Ritualist', rotation);
  const sinister = simulate('Ritualist', rotation, {
    selectedTraitIds: [TRAIT.SINISTER_SHROUD]
  });
  const anguishActions = (result) =>
    result.events.filter((event) => event.type === 'action' && event.skillName === 'Anguish');

  assert.deepEqual(
    anguishActions(base).map((event) => event.rechargeReadyAt),
    [7.84, 15.68]
  );
  assert.deepEqual(
    anguishActions(sinister).map((event) => event.rechargeReadyAt),
    [6.79, 13.58]
  );
  assert.equal(
    base.steps.filter((step) => step.skill === 'Anguish')[1].start -
      sinister.steps.filter((step) => step.skill === 'Anguish')[1].start,
    1050
  );
});

test('Reaper traits reduce shroud cooldowns and ignore minion critical hits', () => {
  const rotation = ["Reaper's Shroud", "Death's Charge", 'Life Rend', 'Life Slash', 'Life Reap', "Death's Charge"];
  const base = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true }
  });
  const onslaught = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [TRAIT.REAPERS_ONSLAUGHT]
  });
  const shroudDamageTraits = simulate('Reaper', rotation, {
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [TRAIT.REAPERS_ONSLAUGHT, TRAIT.DEATH_PERCEPTION]
  });
  const secondChargeStart = (result) => result.steps.filter((step) => step.skill === "Death's Charge")[1].start;
  const firstLifeRendDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Life Rend')?.damage || 0;

  assert.equal(secondChargeStart(base) - secondChargeStart(onslaught), 1000);
  assert.ok(firstLifeRendDamage(onslaught) > firstLifeRendDamage(base));
  assert.ok(firstLifeRendDamage(shroudDamageTraits) > firstLifeRendDamage(base) * 1.15);

  const nova = simulate(
    'Reaper',
    ['Summon Flesh Golem', "Reaper's Shroud", 'Soul Spiral', { type: 'wait', durationMs: 20_000 }],
    {
      boons: { quickness: true },
      selectedSkills: ['Summon Flesh Golem'],
      selectedTraitIds: [TRAIT.CHILLING_NOVA]
    }
  );
  const novaProcs = nova.procSteps.filter((step) => step.skill === 'Chilling Nova');

  assert.ok(novaProcs.length > 0);
  assert.equal(
    novaProcs.some((step) => step.sourceSkill === 'Summon Flesh Golem - Minion Attack'),
    false
  );
});

test('Reaper shouts apply their PvE melee damage bonus', () => {
  const melee = simulate('Reaper', ['"You Are All Weaklings!"'], {
    selectedSkills: ['"You Are All Weaklings!"']
  });
  const ranged = simulate('Reaper', ['"You Are All Weaklings!"'], {
    selectedSkills: ['"You Are All Weaklings!"'],
    target: {
      ...baseConfig.target,
      nearby: false
    }
  });

  assert.ok(Math.abs(melee.strikeDamage - ranged.strikeDamage * 2) < 1e-9);
});
