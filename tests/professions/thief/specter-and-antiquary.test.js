import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';
import { thiefCatalog, thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/catalog.js';
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT
} from '#gw2/professions/thief/data/ids.js';
import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Hide in Shadows', "Assassin's Signet", 'Shadow Flare', 'Shadow Gust', 'Thieves Guild'],
  initialInitiative: 12,
  initialShadowForce: 0,
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  weaponSet2Primary: 'Pistol',
  weaponSet2Secondary: 'Pistol',
  deterministicChoices: {},
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
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createProfessionSimulator(thiefProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('Specter Siphon, initiative spending, and Shadow Shroud share force', () => {
  const inactiveGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Specter',
    professionState: {
      shadowForce: 0,
      shadowShroudActive: false
    }
  });

  assert.equal(
    inactiveGroups.find((group) => group.id === 'thief-profession').className,
    'compact-resource-palette specter-f-skills'
  );
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-profession').stackId, 'specter-profession');
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-shadow-shroud').className, 'specter-shroud-skills');
  assert.equal(inactiveGroups.find((group) => group.id === 'thief-shadow-shroud').stackId, 'specter-profession');
  assert.deepEqual(
    inactiveGroups
      .find((group) => group.id === 'thief-shadow-shroud')
      .skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    ['Haunt Shot', 'Grasping Shadows', "Dawn's Repose", 'Eternal Night', 'Mind Shock']
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      {
        specialization: 'Specter',
        professionState: {
          shadowForce: 0,
          shadowShroudActive: false
        }
      },
      thiefCatalog.skillsByName.get('Enter Shadow Shroud')
    ),
    false
  );

  const result = simulate('Specter', ['Siphon', 'Enter Shadow Shroud', 'Haunt Shot', 'Exit Shadow Shroud'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol'
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.storedStolenSkillId, null);
  assert.ok(result.endState.profession.shadowForce > 0);
  assert.equal(result.events.filter((event) => event.type === 'sigil_swap').length, 0);
  assert.equal(result.events.filter((event) => event.type === 'weapon_set' && event.shroudSwap).length, 2);
});

test('Specter can use its shroud autoattack while stealth is active', () => {
  const hauntShot = thiefCatalog.skillsByName.get('Haunt Shot');
  const paletteContext = {
    specialization: 'Specter',
    time: 1,
    activeWeaponSet: 1,
    build: { weapons: ['Dagger', 'Dagger'], alternateWeapons: ['', ''] },
    professionState: {
      stealthUntil: 4,
      revealedUntil: 0,
      shadowForce: 100,
      shadowShroudActive: true
    }
  };

  assert.equal(thiefProfession.ui.isPaletteSkillAvailable(paletteContext, hauntShot), true);
  const result = simulate('Specter', ['Hide in Shadows', 'Enter Shadow Shroud', 'Haunt Shot'], {
    initialShadowForce: 100
  });

  assert.deepEqual(result.warnings, []);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.skillName === 'Haunt Shot'));
  assert.ok(result.endState.profession.revealedUntil > 0);
});

test('Specter automatically leaves Shadow Shroud when shadow force depletes', () => {
  const result = simulate('Specter', ['Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }], {
    initialShadowForce: 1
  });

  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.shadowForce, 0);
  assert.equal(result.events.filter((event) => event.type === 'weapon_set' && event.shroudSwap).length, 2);
});

test('Specter shadow force is 69% of health and drains 2% per second', () => {
  const capacity = simulate('Specter', [], {
    stats: { vitality: 1000 }
  }).endState.profession;
  const drained = simulate(
    'Specter',
    ['Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }, 'Exit Shadow Shroud'],
    {
      initialShadowForce: 100,
      stats: { vitality: 1000 }
    }
  ).endState.profession;

  assert.equal(capacity.maximumHealth, 11645);
  assert.equal(capacity.shadowForcePoolCapacity, 11645 * 0.69);
  assert.equal(drained.shadowForce, 98);
});

test('Dagger uses the supplied Quickness timings and total multi-hit coefficients', () => {
  const expectedQuicknessTimes = new Map([
    [ID.DOUBLE_STRIKE, 360],
    [ID.WILD_STRIKE, 400],
    [ID.LOTUS_STRIKE, 440],
    [ID.HEARTSEEKER, 600],
    [ID.DEATH_BLOSSOM, 1040],
    [ID.DANCING_DAGGER, 500],
    [ID.CLOAK_AND_DAGGER, 600],
    [ID.MALICIOUS_BACKSTAB, 440]
  ]);

  for (const [skillId, quicknessTime] of expectedQuicknessTimes) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, quicknessTime, skill.name);
    assert.equal(skill.castTimeMs, quicknessTime * 1.5, skill.name);
  }

  const expectedPackets = [
    ['Double Strike', 2, 0.8],
    ['Twisting Fangs', 2, 0.63],
    ['Death Blossom', 3, 0.63]
  ];

  for (const [name, hits, totalCoefficient] of expectedPackets) {
    const strike = thiefCatalog.skillsByName.get(name).effects.find((effect) => effect.type === 'strike');

    assert.equal(strike.ticks.length, hits, name);
    assert.equal(
      strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0),
      totalCoefficient,
      name
    );
  }

  const heartseeker = thiefCatalog.skillsByName.get('Heartseeker');
  const heartseekerStrike = heartseeker.effects.find((effect) => effect.type === 'strike');

  assert.equal(heartseekerStrike.ticks[0].coefficient, 1);
  assert.deepEqual(heartseekerStrike.coefficientModifiers, [
    { kind: 'target-health-below', threshold: 0.25, multiplier: 2.22 },
    { kind: 'target-health-below', threshold: 0.5, multiplier: 1.6 }
  ]);

  const deathBlossom = thiefCatalog.skillsByName.get('Death Blossom');

  assert.equal(deathBlossom.comboFinishers[0].ownerId, 'thief');
  assert.equal(deathBlossom.comboFinishers[0].finisherType, 'Whirl');
  const backstab = thiefCatalog.skillsByName.get('Backstab');
  const malicious = thiefCatalog.skillsByName.get('Malicious Backstab');

  assert.equal(backstab.effects[0].ticks[0].coefficient, 1.5);
  assert.equal(malicious.effects[0].ticks[0].coefficient, 1.5);
  assert.equal(backstab.cooldown, 1);
  assert.equal(malicious.cooldown, 1);
});

test('Dagger runtime applies endurance, shadowstep, and per-packet mechanics', () => {
  const chain = simulate('Core', ['Dodge', 'Double Strike', 'Wild Strike', 'Lotus Strike'], {
    boons: { quickness: true }
  });

  assert.deepEqual(
    chain.steps.slice(1).map((step) => step.fullCastMs),
    [360, 400, 440]
  );
  const thiefStates = chain.events.filter((event) => event.type === 'thief.state');
  const wildStrikeStateIndex = thiefStates.findIndex((event) => event.reason === 'Wild Strike');
  const beforeWildStrike = thiefStates
    .slice(0, wildStrikeStateIndex)
    .filter((event) => event.at <= chain.steps[2].start / 1000 + 1e-9)
    .at(-1);

  assert.ok(Math.abs(thiefStates[wildStrikeStateIndex].state.endurance - beforeWildStrike.state.endurance - 10) < 1e-9);
  // Wild Strike's completion grant must not discard regeneration accrued during its cast.
  assert.equal(chain.endState.profession.endurance, 70);
  const doubleStrikeHits = chain.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Double Strike'
  );

  assert.deepEqual(
    doubleStrikeHits.map((event) => event.coefficient),
    [0.4, 0.4]
  );

  const shadowShot = simulate('Core', ['Shadow Shot'], {
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Pistol',
    relic: 'Peitha'
  });

  assert.ok(shadowShot.events.some((event) => event.type === 'peitha' && event.skillName === 'Shadow Shot'));
  assert.equal(
    shadowShot.events.find((event) => event.type === 'blind' && event.skillName === 'Shadow Shot').duration,
    5
  );
});

test('Wild Strike commits its strike and bleeding before its remaining animation is interrupted', () => {
  const wildEffects = (interruptMs) =>
    simulate('Core', ['Double Strike', { name: 'Wild Strike', interruptMs }], {
      boons: { quickness: true }
    }).events.filter(
      (event) => event.skillName === 'Wild Strike' && (event.type === 'damage' || event.type === 'condition')
    );

  assert.deepEqual(wildEffects(159), []);
  assert.deepEqual(
    wildEffects(160).map((event) => [event.type, Math.round(event.at * 1000)]),
    [
      ['damage', 520],
      ['condition', 520]
    ]
  );
  assert.equal(wildEffects(240).length, 2);
});

test('Lotus Strike commits its strike and poison before a later animation interrupt', () => {
  const lotusEffects = (interruptMs) =>
    simulate('Core', ['Double Strike', 'Wild Strike', { name: 'Lotus Strike', interruptMs }], {
      boons: { quickness: true }
    }).events.filter(
      (event) => event.skillName === 'Lotus Strike' && (event.type === 'damage' || event.type === 'condition')
    );

  assert.deepEqual(lotusEffects(279), []);
  assert.deepEqual(
    lotusEffects(280).map((event) => [event.type, Math.round(event.at * 1000)]),
    [
      ['damage', 1040],
      ['condition', 1040]
    ]
  );
  assert.equal(lotusEffects(319).length, 2);
  assert.equal(lotusEffects(361).length, 2);
});

test('Malicious stealth attacks use their supplied coefficients and malice scaling', () => {
  const front = simulate('Core', ['Cloak and Dagger', 'Backstab'], {
    target: { defiant: false }
  });
  const behind = simulate('Core', ['Cloak and Dagger', 'Backstab'], {
    target: { defiant: true }
  });
  const skillDamage = (result, name) => result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;

  assert.ok(Math.abs(skillDamage(behind, 'Backstab') / skillDamage(front, 'Backstab') - 2) < 1e-9);

  const unmarked = simulate('Deadeye', ['Cloak and Dagger', 'Malicious Backstab'], { stats: { precision: 5000 } });
  const marked = simulate('Deadeye', ["Deadeye's Mark", 'Death Blossom', 'Cloak and Dagger', 'Malicious Backstab'], {
    selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    stats: { precision: 5000 }
  });
  const maliciousRatio = skillDamage(marked, 'Malicious Backstab') / skillDamage(unmarked, 'Malicious Backstab');

  assert.ok(Math.abs(maliciousRatio - 1.5) < 1e-9, maliciousRatio);
  assert.equal(marked.endState.profession.malice, 0);

  const deathsJudgment = thiefCatalog.skillsByName.get("Malicious Death's Judgment");

  assert.deepEqual(
    deathsJudgment.effects
      .filter((effect) => effect.type === 'strike')
      .map((effect) => [effect.ticks.reduce((total, tick) => total + tick.coefficient, 0), effect.ticks.length]),
    [[2.67, 1]]
  );

  const rifleConfig = {
    primaryWeapon: 'Rifle',
    secondaryWeapon: '',
    stats: { precision: 5000 }
  };
  const unmarkedRifle = simulate(
    'Deadeye',
    ['Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"],
    rifleConfig
  );
  const markedRifle = simulate(
    'Deadeye',
    ["Deadeye's Mark", 'Kneel', 'Three Round Burst', 'Shadow Meld', "Malicious Death's Judgment"],
    {
      ...rifleConfig,
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT]
    }
  );
  const deathsJudgmentRatio =
    skillDamage(markedRifle, "Malicious Death's Judgment") / skillDamage(unmarkedRifle, "Malicious Death's Judgment");

  assert.ok(Math.abs(deathsJudgmentRatio - 1.5) < 1e-9, deathsJudgmentRatio);
  assert.equal(markedRifle.endState.profession.malice, 0);
});

test('Revealed Training does not empower the stealth attack that reveals the thief', () => {
  const rotation = ['Cloak and Dagger', 'Backstab', 'Double Strike'];
  const config = {
    selectedSkills: [],
    stats: { power: 2000, precision: 5000 }
  };
  const baseline = simulate('Core', rotation, config);
  const trained = simulate('Core', rotation, {
    ...config,
    selectedTraitIds: [TRAIT.REVEALED_TRAINING]
  });
  const damage = (result, name) => result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;

  assert.ok(Math.abs(damage(trained, 'Backstab') / damage(baseline, 'Backstab') - 1.04) < 1e-9);
  assert.ok(Math.abs(damage(trained, 'Double Strike') / damage(baseline, 'Double Strike') - 1.1) < 1e-9);
});

test('Specter uses the supplied measured Quickness cast times', () => {
  const expected = new Map([
    [ID.SIPHON, 520],
    [ID.HAUNT_SHOT, 640],
    [ID.GRASPING_SHADOWS, 240],
    [ID.DAWNS_REPOSE, 520],
    [ID.ETERNAL_NIGHT, 740],
    [ID.MIND_SHOCK, 360],
    [ID.SHADOW_BOLT, 520],
    [ID.DOUBLE_BOLT, 640],
    [ID.TRIPLE_BOLT, 1080],
    [ID.SHADOWSQUALL, 1960],
    [ID.SHADOW_SAP, 600],
    [ID.TWILIGHT_COMBO, 760],
    [ID.MEASURED_SHOT, 560],
    [ID.ENDLESS_NIGHT, 1920],
    [ID.WELL_OF_BOUNTY, 400],
    [ID.WELL_OF_SORROW, 600],
    [ID.WELL_OF_TEARS, 600]
  ]);

  for (const [skillId, duration] of expected) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, duration, skill.name);
    assert.equal(skill.castTimeMs, duration * 1.5, skill.name);
  }

  const quickSiphon = simulate('Specter', ['Siphon'], {
    boons: { quickness: true }
  });

  assert.equal(quickSiphon.steps[0].fullCastMs, 520);
});

test('Specter scepter and shroud packets apply their conditions per hit', () => {
  const expectedPackets = [
    ['Double Bolt', 2, 0.375, 'Torment'],
    ['Triple Bolt', 3, 0.45, 'Torment'],
    ['Triple Threat', 3, 0.45, 'Torment'],
    ['Shadowsquall', 8, 0.2, 'Poisoned'],
    ['Endless Night', 7, 0.33, 'Torment']
  ];

  for (const [name, count, coefficient, condition] of expectedPackets) {
    const skill = thiefCatalog.skillsByName.get(name);
    const strikes = skill.effects.filter((effect) => effect.type === 'strike');
    const applications = skill.effects.find(
      (effect) => effect.type === 'condition' && effect.ticks?.some((tick) => tick.condition === condition)
    );
    const hits = strikes.reduce((sum, strike) => sum + strike.ticks.length, 0);
    const totalCoefficient = strikes.reduce(
      (sum, strike) => sum + strike.ticks.reduce((tickSum, tick) => tickSum + tick.coefficient, 0),
      0
    );

    assert.equal(hits, count, name);
    assert.ok(Math.abs(totalCoefficient / count - coefficient) < 1e-12, name);
    assert.equal(applications.ticks.length, count, name);
    assert.ok(
      applications.ticks.every((tick) => tick.condition === condition),
      name
    );
  }

  const twilight = simulate(
    'Specter',
    ['Twilight Combo'],
    {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      boons: { quickness: true }
    },
    observationTail(1000)
  );

  assert.equal(twilight.steps[0].fullCastMs, 760);
  assert.deepEqual(
    twilight.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Twilight Combo')
      .map((event) => [event.at, event.name]),
    [
      [0.64, 'Initial Attack'],
      [0.8, 'Secondary Attack']
    ]
  );
  assert.deepEqual(
    twilight.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Twilight Combo')
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.64, 'Chilled', 1],
      [0.64, 'Poisoned', 1],
      [0.8, 'Torment', 3]
    ]
  );

  const deadlyAmbition = simulate('Specter', ['Twilight Combo'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.DEADLY_AMBITION],
    boons: { quickness: true }
  });
  const deadlyAmbitionPoisons = deadlyAmbition.events.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === TRAIT.DEADLY_AMBITION && event.skillName === 'Twilight Combo'
  );

  assert.ok(thiefCatalog.skillsByName.get('Twilight Combo').categories.includes('DualWield'));
  assert.equal(deadlyAmbitionPoisons.length, 1);
  assert.equal(deadlyAmbitionPoisons[0].condition, 'Poisoned');
  assert.equal(deadlyAmbitionPoisons[0].stacks, 1);

  const eternal = simulate('Specter', ['Enter Shadow Shroud', 'Eternal Night'], {
    initialShadowForce: 100,
    boons: { quickness: true }
  });
  const eternalHits = eternal.events.filter((event) => event.type === 'damage' && event.skillName === 'Eternal Night');

  assert.deepEqual(
    eternalHits.map((event) => Number(event.at.toFixed(2))),
    [0.36, 0.68]
  );
  assert.ok(eternalHits.every((event) => event.coefficient === 1.75));
  const eternalConditions = eternal.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Eternal Night'
  );

  assert.deepEqual(
    eternalConditions.map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.36, 'Chilled', 1],
      [0.36, 'Poisoned', 2],
      [0.68, 'Weakness', 1],
      [0.68, 'Poisoned', 2]
    ]
  );

  const mindShock = simulate(
    'Specter',
    ['Enter Shadow Shroud', 'Mind Shock'],
    {
      initialShadowForce: 100,
      boons: { quickness: true }
    },
    observationTail(4000)
  );

  assert.equal(mindShock.steps[1].fullCastMs, 360);
  assert.equal(mindShock.events.find((event) => event.type === 'buff' && event.kind === 'stability').at, 0.36);
  assert.equal(mindShock.events.find((event) => event.type === 'damage' && event.skillName === 'Mind Shock').at, 3.36);
  const stun = mindShock.events.find((event) => event.type === 'control' && event.skillName === 'Mind Shock');

  assert.equal(stun.at, 3.36);
  assert.equal(stun.controlKind, 'stun');
});

test('Specter packet offsets align scepter and shroud impacts', () => {
  const packetOffsets = (result, skillName) => {
    const step = result.steps.find((entry) => entry.skill === skillName);

    return result.events
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => Number((event.at - step.start / 1000).toFixed(3)));
  };

  const bolts = simulate('Specter', ['Shadow Bolt', 'Double Bolt', 'Triple Bolt'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    boons: { quickness: true }
  });

  assert.deepEqual(packetOffsets(bolts, 'Shadow Bolt'), [0.52]);
  assert.deepEqual(packetOffsets(bolts, 'Double Bolt'), [0.32, 0.6]);
  assert.deepEqual(packetOffsets(bolts, 'Triple Bolt'), [0.32, 0.64, 1.04]);

  const shroud = simulate('Specter', ['Enter Shadow Shroud', 'Grasping Shadows', 'Eternal Night', 'Haunt Shot'], {
    initialShadowForce: 100,
    boons: { quickness: true }
  });

  assert.deepEqual(packetOffsets(shroud, 'Grasping Shadows'), [1.24]);
  assert.deepEqual(packetOffsets(shroud, 'Eternal Night'), [0.36, 0.68]);
  assert.deepEqual(packetOffsets(shroud, 'Haunt Shot'), [0.56]);
});

test('Thief utility skills materialize their declarative pulse timelines', () => {
  const pulseOffsets = (result, skillName, type, condition, anchor) => {
    const step = result.steps.find((entry) => entry.skill === skillName);

    return result.events
      .filter(
        (event) =>
          event.type === type && event.skillName === skillName && (condition == null || event.condition === condition)
      )
      .map((event) => Number((event.at - step[anchor] / 1000).toFixed(3)));
  };

  const caltrops = simulate('Core', ['Caltrops', { name: '__wait', waitMs: 9000 }], {
    selectedSkills: ['Caltrops']
  });

  assert.deepEqual(pulseOffsets(caltrops, 'Caltrops', 'condition', 'Bleeding', 'end'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(pulseOffsets(caltrops, 'Caltrops', 'condition', 'Crippled', 'end'), [0, 1, 2, 3, 4]);

  const needles = simulate(
    'Specter',
    [
      'Prepare Thousand Needles',
      { name: '__wait', waitMs: 3000 },
      'Thousand Needles',
      { name: '__wait', waitMs: 4500 }
    ],
    {
      selectedSkills: ['Prepare Thousand Needles'],
      boons: { quickness: true }
    }
  );

  assert.deepEqual(pulseOffsets(needles, 'Thousand Needles', 'damage', null, 'start'), [0.28, 1.28, 2.28, 3.28, 4.28]);

  const pitfall = simulate('Core', ['Prepare Pitfall', 'Pitfall', { name: '__wait', waitMs: 3000 }], {
    selectedSkills: ['Prepare Pitfall']
  });
  const pitfallDamage = pitfall.events.filter((event) => event.type === 'damage' && event.skillName === 'Pitfall');
  const pitfallControl = pitfall.events.find((event) => event.type === 'control' && event.skillName === 'Pitfall');

  assert.equal(pitfall.steps.find((step) => step.skill === 'Pitfall').start, 3500);
  assert.deepEqual(
    pitfallDamage.map((event) => [Number((event.at - 3.5).toFixed(3)), event.coefficient]),
    [
      [0, 1.25],
      [1, 0.5],
      [2, 0.5],
      [3, 0.5]
    ]
  );
  assert.deepEqual(pulseOffsets(pitfall, 'Pitfall', 'condition', 'Vulnerability', 'start'), [1, 2, 3]);
  assert.ok(
    pitfall.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Pitfall')
      .every((event) => event.stacks === 2 && event.duration === 6)
  );
  assert.equal(pitfallControl.controlKind, 'knockdown');
  assert.equal(pitfallControl.duration, 3);
});

test('Pitfall placement recharge remains independent from its three-second trigger rearm', () => {
  const prepareTimes = (result) =>
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Prepare Pitfall')
      .map((event) => event.at);
  const early = simulate('Core', ['Prepare Pitfall', 'Pitfall', 'Prepare Pitfall'], {
    selectedSkills: ['Prepare Pitfall']
  });
  const held = simulate('Core', ['Prepare Pitfall', { name: '__wait', waitMs: 24500 }, 'Pitfall', 'Prepare Pitfall'], {
    selectedSkills: ['Prepare Pitfall']
  });

  assert.deepEqual(early.warnings, []);
  assert.deepEqual(held.warnings, []);
  assert.deepEqual(prepareTimes(early), [0, 25]);
  assert.deepEqual(prepareTimes(held), [0, 28]);
});

test('Specter wells preserve one-second pulse intervals and ordered effects', () => {
  const sorrow = simulate('Specter', ['Well of Sorrow', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Sorrow'],
    boons: { quickness: true }
  });

  assert.equal(sorrow.steps[0].fullCastMs, 600);
  assert.deepEqual(
    sorrow.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Well of Sorrow')
      .map((event) => [event.at, Number(event.coefficient.toFixed(3))]),
    [
      [1, 0.222],
      [2, 0.222],
      [3, 0.222],
      [4, 0.222],
      [5, 0.222]
    ]
  );
  assert.deepEqual(
    sorrow.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Well of Sorrow')
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [1, 'Torment', 2],
      [2, 'Bleeding', 3],
      [3, 'Torment', 2],
      [4, 'Poisoned', 3],
      [5, 'Torment', 2]
    ]
  );

  const tears = simulate('Specter', ['Well of Tears', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Tears'],
    boons: { quickness: true }
  });

  assert.deepEqual(
    tears.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Well of Tears')
      .map((event) => [event.at, event.coefficient]),
    [
      [0.6, 1],
      [1.6, 1],
      [2.6, 1],
      [3.6, 1],
      [4.6, 1]
    ]
  );

  const bounty = simulate('Specter', ['Well of Bounty', { type: 'wait', durationMs: 5000 }], {
    selectedSkills: ['Well of Bounty'],
    boons: { quickness: true }
  });

  assert.deepEqual(
    bounty.events
      .filter((event) => event.type === 'buff' && event.skillName === 'Well of Bounty')
      .map((event) => [event.at, event.kind, event.stacks, event.duration]),
    [
      [0.4, 'stability', 2, 5],
      [1.4, 'might', 8, 15],
      [2.4, 'fury', 1, 5],
      [3.4, 'vigor', 1, 8],
      [4.4, 'regeneration', 1, 12]
    ]
  );
});

test('Specter shadow-force and recharge traits use supplied values', () => {
  const baseline = simulate('Specter', ['Siphon']);
  const amplified = simulate('Specter', ['Siphon'], {
    selectedTraitIds: [TRAIT.AMPLIFIED_SIPHONING]
  });

  assert.equal(baseline.endState.profession.shadowForce, 25);
  assert.equal(amplified.endState.profession.shadowForce, 27.5);

  const initiative = simulate('Specter', ['Shadow Sap'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(initiative.endState.profession.shadowForce, 4);

  const reduced = simulate('Specter', ['Siphon'], {
    selectedTraitIds: [TRAIT.LEAD_ATTACKS, TRAIT.SLEIGHT_OF_HAND]
  });

  assert.equal(reduced.endState.cooldowns.Siphon.remaining, 11700);

  const larcenous = simulate(
    'Specter',
    ['Twilight Combo'],
    {
      initialShadowForce: 0,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      selectedTraitIds: [TRAIT.LARCENOUS_TORMENT],
      boons: { quickness: true }
    },
    observationTail(1000)
  );

  assert.equal(larcenous.profession.shadowForce, 5.5);
  assert.equal(
    larcenous.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Larcenous Torment')
      .length,
    3
  );
});

test('Specter attribute, ally, and shadowstep traits resolve explicitly', () => {
  const attributeConfig = {
    specialization: 'Specter',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.SECOND_OPINION, TRAIT.STRENGTH_OF_SHADOWS],
    stats: {
      conditionDamage: 1000,
      healingPower: 100,
      vitality: 1000,
      expertise: 0
    }
  };
  const query = createGw2CombatQuery({
    profession: resolveProfessionRuntime(thiefProfession, attributeConfig),
    config: attributeConfig
  });
  const stats = query.statsAt(0);

  assert.equal(stats.conditionDamage, 1180);
  assert.equal(stats.healingPower, 170);
  assert.equal(stats.expertise, 130);

  const allies = simulate('Specter', ['Enter Shadow Shroud', "Dawn's Repose", { name: '__wait', waitMs: 1000 }], {
    initialShadowForce: 100,
    selectedTraitIds: [TRAIT.SHADESTEP],
    allies: { count: 2, strikesPerSecond: 1 },
    boons: { quickness: true }
  });
  const protection = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === "Dawn's Repose" && event.kind === 'protection'
  );

  assert.equal(protection.duration, 5);
  assert.equal(protection.resolvedAudience.recipientCount, 3);
  const barrier = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Enter Shadow Shroud' && event.kind === 'barrier'
  );

  assert.equal(barrier.resolvedAudience.includesSelf, false);
  assert.equal(barrier.resolvedAudience.recipientCount, 1);
  const dawnBarrier = allies.events.find(
    (event) => event.type === 'buff' && event.skillName === "Dawn's Repose" && event.kind === 'barrier'
  );

  assert.equal(dawnBarrier.resolvedAudience.includesSelf, false);
  assert.equal(dawnBarrier.resolvedAudience.recipientCount, 2);
  assert.deepEqual(
    allies.events
      .filter((event) => event.type === 'buff' && event.kind === 'rot-wallow-venom')
      .map((event) => [event.at, event.duration, event.resolvedAudience.recipientCount]),
    [
      [0, 10, 1],
      [0.52, 10, 1]
    ]
  );
  assert.equal(
    allies.events.filter(
      (event) => event.type === 'condition' && event.skillName === 'Rot Wallow Venom' && event.condition === 'Torment'
    ).length,
    2
  );

  const peitha = simulate('Specter', ['Well of Tears'], {
    selectedSkills: ['Well of Tears'],
    relic: 'Peitha',
    boons: { quickness: true }
  });

  assert.ok(peitha.events.some((event) => event.type === 'peitha' && event.skillName === 'Well of Tears'));
});

test('Condi spear Antiquary skills use EVTC-measured Quickness cast times', () => {
  const expected = new Map([
    [ID.ENTANGLING_ASP, 520],
    [ID.SHATTERING_ASSAULT, 640],
    [ID.DISTRACTING_THROW, 360],
    [ID.ASHEN_ASSAULT, 1200],
    [ID.MANTIS_STING, 400],
    [ID.FALLING_SPIDER, 600],
    [ID.PREPARE_THOUSAND_NEEDLES, 600],
    [ID.CALTROPS, 920],
    [ID.MISTBURN_MORTAR, 600],
    [ID.SKRITT_SWIPE, 200]
  ]);

  for (const [skillId, duration] of expected) {
    const skill = thiefCatalog.skillsById.get(skillId);

    assert.equal(skill.quicknessCastTimeMs, duration, skill.name);
    assert.equal(skill.castTimeMs, duration * 1.5, skill.name);
  }
});

test('Spear slots 2 and 3 expose and enforce their linked chain', () => {
  const chainSkills = [
    'Mantis Sting',
    'Entangling Asp',
    'Falling Spider',
    'Unsuspecting Strike',
    'Vampiric Slash',
    'Shattering Assault'
  ].map((name) => thiefCatalog.skillsByName.get(name));
  const visibleAtStage = (stage) =>
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ['Spear', ''], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: stage }
        })
      )
      .map((skill) => skill.name);
  const paletteAtStage = (stage) =>
    weaponPaletteRows(
      {
        build: {
          ...createThiefBuildDefaults(),
          weapons: ['Spear', ''],
          alternateWeapons: ['Spear', '']
        },
        adapter: thiefAppAdapter,
        profession: thiefProfession,
        skills: thiefCatalog.skills,
        skillById: thiefCatalog.skillsById,
        skillByName: thiefCatalog.skillsByName,
        weaponData: thiefAppAdapter.weaponData,
        results: {
          endState: {
            activeWeaponSet: 1,
            profession: { spearChainStage: stage }
          }
        }
      },
      1
    )[0]
      .skills.filter((skill) => [2, 3].includes(Number(String(skill.slot).split('_').at(-1))))
      .map((skill) => skill.name);

  assert.deepEqual(visibleAtStage(0), ['Mantis Sting', 'Unsuspecting Strike']);
  assert.deepEqual(visibleAtStage(1), ['Entangling Asp', 'Vampiric Slash']);
  assert.deepEqual(visibleAtStage(2), ['Falling Spider', 'Shattering Assault']);
  assert.deepEqual(
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ['Spear', ''], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: 0 },
          weaponBarPreview: true
        })
      )
      .map((skill) => [skill.name, skill.weaponBarChainStep]),
    [
      ['Mantis Sting', 1],
      ['Entangling Asp', 2],
      ['Falling Spider', 3],
      ['Unsuspecting Strike', 1],
      ['Vampiric Slash', 2],
      ['Shattering Assault', 3]
    ]
  );
  assert.deepEqual(paletteAtStage(0), ['Mantis Sting', 'Unsuspecting Strike']);
  assert.deepEqual(paletteAtStage(1), ['Entangling Asp', 'Vampiric Slash']);
  assert.deepEqual(paletteAtStage(2), ['Falling Spider', 'Shattering Assault']);
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 0 } },
      thiefCatalog.skillsByName.get('Entangling Asp')
    ).available,
    false
  );
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 1 } },
      thiefCatalog.skillsByName.get('Entangling Asp')
    ).available,
    true
  );

  const spearConfig = {
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  };
  const afterAutoattack = simulate('Core', ['Barbed Spear'], spearConfig);

  assert.equal(afterAutoattack.endState.profession.spearChainStage, 0);
  assert.equal(afterAutoattack.endState.profession.spearPreviousSkillId, null);

  const afterLeadAndAutoattack = simulate('Core', ['Mantis Sting', 'Barbed Spear'], spearConfig);

  assert.equal(afterLeadAndAutoattack.endState.profession.spearChainStage, 1);
  assert.equal(afterLeadAndAutoattack.endState.profession.spearPreviousSkillId, ID.MANTIS_STING);
  const stealthFinisher = simulate(
    'Core',
    ['Unsuspecting Strike', 'Vampiric Slash', 'Shattering Assault', 'Ashen Assault'],
    spearConfig
  );

  assert.deepEqual(stealthFinisher.warnings, []);
  assert.ok(stealthFinisher.steps.some((step) => step.skill === 'Ashen Assault'));
});

test('Spider Venom grants six independent charges to the player and allies', () => {
  const result = simulate(
    'Core',
    ['Spider Venom', 'Heartseeker'],
    {
      selectedSkills: ['Hide in Shadows', 'Spider Venom'],
      allies: { count: 4, strikesPerSecond: 1 }
    },
    observationTail(6000)
  );
  const partyBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'spider-venom');

  assert.equal(partyBuff.stacks, 6);
  assert.equal(partyBuff.duration, 24);
  assert.equal(partyBuff.resolvedAudience.recipientCount, 5);
  assert.equal(partyBuff.resolvedAudience.alliedPlayerCount, 4);
  assert.deepEqual(partyBuff.resolvedAudience.companionIds, []);
  assert.equal(partyBuff.resolvedAudience.includesSummons, false);

  const allyPoisons = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.SPIDER_VENOM && event.triggeredByAlly
  );

  assert.equal(allyPoisons.length, 24);
  assert.deepEqual([...new Set(allyPoisons.map((event) => event.triggeredByAlly))], [1, 2, 3, 4]);
  assert.ok(allyPoisons.every((event) => event.stacks === 1 && Math.abs(event.naturalExpiresAt - event.at - 3) < 1e-9));

  const personalPoisons = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.SPIDER_VENOM && !event.triggeredByAlly
  );

  assert.equal(personalPoisons.length, 1);
});

test('Skale and Devourer Venom grant party charges that proc together on attacks', () => {
  const result = simulate(
    'Core',
    ['Skale Venom', 'Devourer Venom', 'Heartseeker'],
    {
      selectedSkills: ['Skale Venom', 'Devourer Venom'],
      allies: { count: 4, strikesPerSecond: 10 },
      target: { conditions: {} }
    },
    observationTail(500)
  );
  const buff = (kind) => result.events.find((event) => event.type === 'buff' && event.kind === kind);
  const venomConditions = (skillId, allied) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && Boolean(event.triggeredByAlly) === allied
    );
  const personalSkale = venomConditions(ID.SKALE_VENOM, false);
  const personalDevourer = venomConditions(ID.DEVOURER_VENOM, false);

  assert.deepEqual(
    [buff('skale-venom'), buff('devourer-venom')].map((event) => [
      event.stacks,
      event.duration,
      event.resolvedAudience.recipientCount
    ]),
    [
      [4, 24, 5],
      [2, 24, 5]
    ]
  );
  assert.deepEqual(
    personalSkale.map((event) => [event.condition, event.stacks, event.naturalExpiresAt - event.at]),
    [
      ['Vulnerability', 1, 10],
      ['Torment', 1, 3]
    ]
  );
  assert.deepEqual(
    personalDevourer.map((event) => [
      event.condition,
      event.stacks,
      Number((event.naturalExpiresAt - event.at).toFixed(3))
    ]),
    [['Immobilized', 1, 1]]
  );
  assert.equal(venomConditions(ID.SKALE_VENOM, true).length, 32);
  assert.equal(venomConditions(ID.DEVOURER_VENOM, true).length, 8);

  const limited = simulate(
    'Core',
    ['Skale Venom', 'Devourer Venom', 'Double Strike', 'Wild Strike', 'Lotus Strike', 'Double Strike'],
    {
      selectedSkills: ['Skale Venom', 'Devourer Venom'],
      target: { conditions: {} }
    }
  );
  const personalProcs = (skillId) =>
    limited.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === skillId && !event.triggeredByAlly
    );

  assert.deepEqual(limited.warnings, []);
  assert.equal(personalProcs(ID.SKALE_VENOM).length, 8);
  assert.equal(personalProcs(ID.DEVOURER_VENOM).length, 2);
});

test('Antiquary artifacts, per-cast Double Edge, and summons are deterministic', () => {
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.handlerId === 'thief.double-edge')
      .every((skill) => skill.usableWhileRecharging === true)
  );
  const artifact = simulate('Antiquary', ['Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 1200 }], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.equal(artifact.warnings.length, 0);
  assert.equal(artifact.endState.profession.artifactUsesRemaining, 0);
  assert.ok(artifact.totalDamage > 0);

  const reshuffled = simulate('Antiquary', ['Skritt Swipe', 'Reshuffle'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.deepEqual(
    reshuffled.endState.profession.artifactSlots.map((slot) => slot.skillId),
    [...THIEF_ARTIFACT_IDS.OFFENSIVE, ...THIEF_ARTIFACT_IDS.DEFENSIVE]
  );

  const doubleEdge = simulate(
    'Antiquary',
    [
      'Stone Summit Cannon',
      {
        name: 'Stone Summit Cannon',
        doubleEdgeOutcome: 'backfire'
      }
    ],
    {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger'
    }
  );

  assert.equal(doubleEdge.warnings.length, 0);
  assert.ok(doubleEdge.endState.profession.backfireState[76725]);

  const doubleEdgeSuccess = simulate(
    'Antiquary',
    [
      'Stone Summit Cannon',
      {
        name: 'Stone Summit Cannon',
        doubleEdgeOutcome: 'success'
      }
    ],
    {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger'
    }
  );

  assert.equal(doubleEdgeSuccess.warnings.length, 0);
  assert.equal(doubleEdgeSuccess.endState.profession.backfireState[76725], undefined);

  const guild = simulate('Antiquary', ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 2100 }], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  });

  assert.ok(
    guild.resolvedEvents.some(
      (event) => event.actorType === 'summon' && event.skillName === 'Thieves Guild — Sword/Dagger Skritt'
    )
  );
});

test('Thieves Guild waits for the player to enter combat before attacking', () => {
  const idle = simulate('Core', ['Thieves Guild', { type: 'wait', durationMs: 4000 }]);

  assert.equal(idle.combatStartTime, null);
  assert.equal(
    idle.events.some(
      (event) => event.actorType === 'summon' && ['damage', 'condition', 'control', 'blind'].includes(event.type)
    ),
    false
  );

  const delayed = simulate('Core', [
    'Thieves Guild',
    { type: 'wait', durationMs: 2000 },
    { type: 'combat-start' },
    { type: 'wait', durationMs: 2100 }
  ]);
  const summonAttacks = delayed.events.filter(
    (event) => event.actorType === 'summon' && ['damage', 'condition'].includes(event.type)
  );

  assert.ok(summonAttacks.length > 0);
  assert.ok(summonAttacks.every((event) => event.at >= delayed.combatStartTime));
});

test('Thieves Guild summons three specialization-specific thieves for 24 seconds', () => {
  assert.equal(thiefCatalog.skillsByName.get('Thieves Guild').cooldown, 120);
  assert.equal(thiefCatalog.skillsByName.get('Thieves Guild').summonAttack.duration, 24);
  const expectedThirdSummon = new Map([
    ['Core', 'Sword Thief'],
    ['Daredevil', 'Staff Daredevil'],
    ['Deadeye', 'Rifle Deadeye'],
    ['Specter', 'Scepter Specter'],
    ['Antiquary', 'Sword/Dagger Skritt']
  ]);

  for (const [specialization, thirdSummon] of expectedThirdSummon) {
    const result = simulate(specialization, [
      'Thieves Guild',
      { type: 'combat-start' },
      { type: 'wait', durationMs: 1800 }
    ]);

    assert.deepEqual(
      [
        ...new Set(
          result.resolvedEvents
            .filter(
              (event) =>
                event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
            )
            .map((event) => event.skillName)
        )
      ].sort(),
      [
        'Thieves Guild — Male Dual-Pistol Thief',
        'Thieves Guild — Female Dual-Dagger Thief',
        `Thieves Guild — ${thirdSummon}`
      ].sort(),
      specialization
    );
  }

  const lifetime = simulate('Specter', [
    'Thieves Guild',
    { type: 'combat-start' },
    { type: 'wait', durationMs: 26000 }
  ]);
  const summonPackets = lifetime.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
  );

  assert.ok(summonPackets.length > 0);
  assert.equal(lifetime.endState.profession.activeThievesGuild, null);
  assert.deepEqual(
    [...new Set(summonPackets.map((event) => event.skillWeapon))].sort(),
    ['Pistol', 'Dagger', 'Scepter'].sort()
  );
  const entityRows = skillBreakdownRows(lifetime).filter((row) => row.parentSkill === 'Thieves Guild');

  assert.ok(entityRows.length > 0);
  assert.ok(entityRows.every((row) => !row.name.startsWith('Thieves Guild \u2014 ')));
  assert.ok(entityRows.some((row) => row.name === 'Thief \u2014 Unload'));
  assert.ok(entityRows.some((row) => row.name === 'Specter \u2014 Shadow Bolt'));
  const scorpionWire = entityRows.find((row) => row.name === 'Thief \u2014 Scorpion Wire');

  assert.ok(scorpionWire.strike > 0);
  assert.ok(scorpionWire.condition > 0);
  assert.ok(entityRows.every((row) => !row.name.endsWith(' \u2014 Poisoned')));
});

test('Specter Thieves Guild follows its measured scepter, well, and Triple Threat pattern', () => {
  const result = simulate('Specter', ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 26000 }]);
  const specterStrikes = result.events.filter(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.sourceId === 'thief.thieves-guild' &&
      event.skillName === 'Thieves Guild \u2014 Scepter Specter'
  );
  const strikesFor = (name) => specterStrikes.filter((event) => event.damageBreakdownName === `Specter \u2014 ${name}`);
  const strikeTimesFor = (name) => strikesFor(name).map((event) => Number(event.at.toFixed(3)));

  assert.deepEqual(strikeTimesFor('Well of Sorrow'), [4.358, 5.357, 6.358, 7.356, 8.355]);
  assert.deepEqual(strikeTimesFor('Triple Threat'), [20.914, 21.437, 22.037]);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.damageBreakdownName === 'Specter \u2014 Well of Sorrow')
      .map((event) => [Number(event.at.toFixed(3)), event.condition, event.stacks, event.duration]),
    [
      [4.358, 'Poisoned', 1, 3],
      [5.357, 'Torment', 2, 4],
      [6.358, 'Torment', 1, 4],
      [7.356, 'Torment', 1, 4],
      [8.355, 'Poisoned', 1, 3]
    ]
  );
  assert.deepEqual(
    specterStrikes.filter((event) => event.at >= 6 && event.at < 10).map((event) => event.damageBreakdownName),
    [
      'Specter \u2014 Shadow Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Double Bolt',
      'Specter \u2014 Double Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Triple Bolt',
      'Specter \u2014 Well of Sorrow',
      'Specter \u2014 Triple Bolt',
      'Specter \u2014 Triple Bolt'
    ]
  );

  const tripleThreatConditions = result.events.filter(
    (event) => event.type === 'condition' && event.damageBreakdownName === 'Specter \u2014 Triple Threat'
  );

  assert.deepEqual(
    tripleThreatConditions.map((event) => [Number(event.at.toFixed(3)), event.condition, event.stacks, event.duration]),
    [
      [20.914, 'Torment', 1, 2],
      [21.437, 'Torment', 1, 2],
      [22.037, 'Torment', 1, 2]
    ]
  );
  assert.deepEqual(strikeTimesFor('Shadow Bolt'), [2.517, 6.04, 11.107, 16.173, 23.758]);
});

test('Thieves Guild uses independent summon weapons and attack profiles', () => {
  const rotation = ['Thieves Guild', { type: 'combat-start' }, { type: 'wait', durationMs: 26000 }];
  const result = simulate('Daredevil', rotation);
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
  );
  const profile = (name) => strikes.filter((event) => event.skillName.includes(name));
  const entityRowNames = skillBreakdownRows(result)
    .filter((row) => row.parentSkill === 'Thieves Guild')
    .map((row) => row.name);

  assert.ok(entityRowNames.includes('Thief \u2014 Unload'));
  assert.ok(entityRowNames.includes('Daredevil \u2014 Vault'));
  const impairingDaggers = skillBreakdownRows(result).find((row) => row.name === 'Daredevil \u2014 Impairing Daggers');

  assert.ok(impairingDaggers.strike > 0);
  assert.ok(impairingDaggers.condition > 0);
  assert.ok(
    entityRowNames.every(
      (name) => !name.startsWith('Male ') && !name.startsWith('Female ') && !name.startsWith('Staff ')
    )
  );
  const summarize = (name) => {
    const events = profile(name);

    return {
      coefficient: Number(events.reduce((total, event) => total + Number(event.coefficient || 0), 0).toFixed(3)),
      hits: events.reduce((total, event) => total + Number(event.hits || 0), 0),
      weaponStrengthProfiles: [...new Set(events.map((event) => event.weaponStrengthProfileId))]
    };
  };

  assert.deepEqual(summarize('Male Dual-Pistol Thief'), {
    coefficient: 9.2,
    hits: 49,
    weaponStrengthProfiles: ['weapon.pistol']
  });
  assert.deepEqual(summarize('Female Dual-Dagger Thief'), {
    coefficient: 43.9,
    hits: 33,
    weaponStrengthProfiles: ['weapon.dagger']
  });
  assert.deepEqual(summarize('Staff Daredevil'), {
    coefficient: 10.95,
    hits: 17,
    weaponStrengthProfiles: ['weapon.staff']
  });
  assert.ok(
    strikes.every(
      (event) =>
        event.independentSummonStrike === true &&
        event.summonBasePower === 1750 &&
        event.criticalChance === 0.2 &&
        event.criticalDamage === 1.5
    )
  );

  const summonStrikeDamage = (simulation) =>
    simulation.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.actorType === 'summon' && event.sourceId === 'thief.thieves-guild'
      )
      .reduce((total, event) => total + Number(event.damage || 0), 0);
  const summonConditionDamage = (simulation) =>
    simulation.breakdown
      .filter((entry) => entry.parentSkill === 'Thieves Guild')
      .reduce((total, entry) => total + Number(entry.conditionDamage || 0), 0);
  const lowPower = simulate('Daredevil', rotation, {
    stats: { power: 1000, precision: 1000, ferocity: 0 }
  });
  const highPower = simulate('Daredevil', rotation, {
    stats: { power: 4000, precision: 3000, ferocity: 1500 }
  });

  assert.equal(summonStrikeDamage(lowPower), summonStrikeDamage(highPower));
  const withRelic = simulate('Daredevil', rotation, { relic: 'Thief' });
  const withoutRelic = simulate('Daredevil', rotation);

  assert.equal(summonStrikeDamage(withRelic), summonStrikeDamage(withoutRelic));
  assert.equal(summonConditionDamage(withRelic), summonConditionDamage(withoutRelic));
});

test('Antiquary exposes every artifact from Swipe and Scuffle', () => {
  const expectedArtifactIds = [...THIEF_ARTIFACT_IDS.OFFENSIVE, ...THIEF_ARTIFACT_IDS.DEFENSIVE];
  const config = {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger'
  };

  const swipe = simulate('Antiquary', ['Skritt Swipe'], config);

  assert.deepEqual(
    swipe.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds
  );
  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: 'Antiquary',
    professionState: swipe.endState.profession,
    build: { assumptions: {} }
  });

  assert.deepEqual(
    paletteGroups.find((group) => group.id === 'thief-artifacts-offensive').skillIds,
    THIEF_ARTIFACT_IDS.OFFENSIVE
  );
  assert.deepEqual(
    paletteGroups.find((group) => group.id === 'thief-artifacts-defensive').skillIds,
    THIEF_ARTIFACT_IDS.DEFENSIVE
  );
  assert.deepEqual(
    paletteGroups.filter((group) => group.id.startsWith('thief-artifacts-')).map((group) => group.stackId),
    ['thief-artifacts', 'thief-artifacts']
  );
  assert.equal(paletteGroups.find((group) => group.id === 'thief-profession').skillIds.includes(ID.RESHUFFLE), false);

  const picked = simulate('Antiquary', ['Skritt Swipe', 'Mistburn Mortar'], config);

  assert.equal(picked.warnings.length, 0);
  assert.equal(picked.endState.profession.artifactUsesRemaining, 0);
  // Spent artifacts stay listed (never concealed); paletteSkillAvailability is
  // what greys them out, so a used artifact is disabled rather than removed.
  const spentContext = {
    specialization: 'Antiquary',
    professionState: picked.endState.profession,
    build: { assumptions: {} }
  };

  assert.equal(
    thiefProfession.ui
      .paletteGroups(spentContext)
      .filter((group) => group.id.startsWith('thief-artifacts-'))
      .every((group) => group.skillIds.length > 0 && !group.className.includes('pal-group-concealed')),
    true
  );
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(spentContext, {
      id: ID.MISTBURN_MORTAR,
      name: 'Mistburn Mortar',
      artifactKind: 'offensive'
    }).available,
    false
  );

  const scuffle = simulate('Antiquary', ['Skritt Scuffle', { type: 'wait', durationMs: 5200 }], config);

  assert.deepEqual(
    scuffle.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds
  );
});

test('Meticulous Custodian upgrades artifact packets and effect durations', () => {
  const config = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    deterministicChoices: { forgedSurferBombsHit: '1' }
  };
  const artifact = (name, meticulous = false) =>
    simulate('Antiquary', ['Skritt Swipe', name, { type: 'wait', durationMs: 6000 }], {
      ...config,
      selectedTraitIds: meticulous ? [TRAIT.METICULOUS_CUSTODIAN] : []
    });
  const damage = (result, match) =>
    result.breakdown.find((entry) => (typeof match === 'function' ? match(entry) : entry.name === match))?.damage || 0;
  const ratio = (name, rowName = name) => {
    const base = artifact(name);
    const meticulous = artifact(name, true);

    return damage(meticulous, rowName) / damage(base, rowName);
  };

  assert.ok(
    Math.abs(
      ratio(
        'Metal Legion Guitar',
        (entry) => entry.sourceSkill === 'Metal Legion Guitar' && entry.name.endsWith('Packet 1')
      ) - 1.5
    ) < 1e-9
  );
  assert.ok(Math.abs(ratio('Metal Legion Guitar', 'Final Smash') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Mistburn Mortar') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Summon Kryptis Turret') - 3.84 / 2.8) < 1e-9);
  assert.ok(Math.abs(ratio('Chak Shield') - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio('Holo-Dancer Decoy') - 1.5) < 1e-9);

  const mortar = artifact('Mistburn Mortar', true);
  const turret = artifact('Summon Kryptis Turret', true);
  const sunCrystal = artifact('Zephyrite Sun Crystal', true);
  const chakShield = artifact('Chak Shield', true);

  assert.equal(chakShield.breakdown.find((entry) => entry.name === 'Chak Shield').hits, 6);
  assert.equal(mortar.endState.profession.mistburnExpiresAt, 13.2);
  assert.equal(turret.endState.profession.kryptisDamageUntil, 10.96);
  assert.ok(sunCrystal.conditionDamage > artifact('Zephyrite Sun Crystal').conditionDamage * 1.8);
});

test('Antiquary skill bar previews wiki-categorized artifacts', () => {
  const groups = thiefProfession.ui.skillBarGroups({
    specialization: 'Antiquary'
  });

  assert.deepEqual(
    groups.map((group) => ({
      label: group.label,
      names: group.skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name)
    })),
    [
      {
        label: 'Offensive Artifacts',
        names: ['Forged Surfer Dash', 'Metal Legion Guitar', 'Mistburn Mortar', 'Summon Kryptis Turret']
      },
      {
        label: 'Defensive Artifacts',
        names: ['Chak Shield', 'Exalted Hammer', 'Holo-Dancer Decoy', 'Zephyrite Sun Crystal']
      }
    ]
  );
  const specter = thiefProfession.ui.skillBarGroups({
    specialization: 'Specter'
  });

  assert.deepEqual(
    specter.map((group) => group.label),
    ['F Keys', 'Shadow Shroud']
  );
  assert.deepEqual(
    specter[1].skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    ['Haunt Shot', 'Grasping Shadows', "Dawn's Repose", 'Eternal Night', 'Mind Shock']
  );
});

test('Thief skill bar previews specialization-specific stolen skills', () => {
  const namesFor = (specialization, config = {}) =>
    thiefProfession.ui
      .skillBarGroups({ specialization, config: { specialization, ...config } })
      .flatMap((group) => group.skillIds)
      .map((id) => thiefCatalog.skillsById.get(id)?.name);

  assert.deepEqual(namesFor('Core'), ['Throw Gunk', 'Consume Plasma', 'Whirling Axe']);
  assert.deepEqual(namesFor('Daredevil'), namesFor('Core'));
  assert.deepEqual(namesFor('Deadeye'), [
    'Steal Time',
    'Steal Warmth',
    'Steal Resistance',
    'Steal Precision',
    'Steal Health',
    'Steal Strength',
    'Steal Durability',
    'Steal Defenses',
    'Steal Mobility'
  ]);
  assert.deepEqual(namesFor('Deadeye', { selectedTraitIds: [TRAIT.FIRE_FOR_EFFECT] }), ['Steal Time']);
  assert.deepEqual(
    thiefProfession.ui
      .paletteGroups({ specialization: 'Deadeye', traits: new Set([TRAIT.FIRE_FOR_EFFECT]) })
      .find((group) => group.id === 'deadeye-stolen-skills').skillIds,
    [ID.STEAL_TIME]
  );
  assert.equal(
    thiefProfession.ui
      .skillBarGroups({ specialization: 'Deadeye', config: { specialization: 'Deadeye' } })
      .find((group) => group.id === 'deadeye-stolen-skills').className,
    'deadeye-stolen-skills-grid'
  );
});

test('Thief is a loadable native application', async () => {
  assert.equal((await loadProfession('thief')).id, 'thief');
  const adapter = await loadProfessionAppAdapter('thief');

  assert.equal(adapter.profession.id, 'thief');
  assert.equal(adapter.weaponSkillMatchesSet, thiefWeaponSkillMatchesSet);
  assert.ok(adapter.assumptionControls.length >= 3);
  const html = await readFile(new URL('../../../dist/site/thief.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="thief"/);
  assert.match(html, /Thief<\/span> Rotation Simulator/);
});
