import assert from 'node:assert/strict';
import test from 'node:test';

import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import { resultSkillIcon } from '#gw2/app/rotation/shared/icons.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { migrateRangerBuild } from '#gw2/professions/ranger/build/build.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { rangerCoreCriticalReactions } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { rangerCoreModifierRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import { druidModifierRules } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  selectedPet: 'Jacaranda',
  selectedPet2: 'Carrion Devourer',
  primaryWeapon: 'Dagger',
  offHandWeapon: 'Torch',
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1800,
    expertise: 1200,
    concentration: 750
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: rangerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization: 'Druid',
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    mode: 'sequence'
  });
}

test('condition Druid weapon timings and packets use configured profiles', () => {
  for (const [id, castTime] of [
    [ID.GROUNDWORK_GOUGE, 280],
    [ID.LEADING_SWIPE, 320],
    [ID.SERPENT_STAB, 280],
    [ID.DEADLY_DELIVERY, 440],
    [ID.DOUBLE_ARC, 600],
    [ID.INSTINCTIVE_ENGAGE, 840],
    [ID.CRIPPLING_TALON, 360],
    [ID.STALKERS_STRIKE, 760]
  ]) {
    assert.equal(rangerCatalog.skillsById.get(id).quicknessCastTimeMs, castTime);
  }

  const doubleArc = rangerCatalog.skillsById.get(ID.DOUBLE_ARC);

  assert.equal(doubleArc.recharge, 6);
  assert.equal(doubleArc.effects.find(({ type }) => type === 'strike').coefficient, 1.6);
  assert.equal(
    doubleArc.effects.filter(({ type }) => type === 'condition').find(({ condition }) => condition === 'Bleeding')
      .stacks,
    6
  );
  assert.equal(
    doubleArc.effects.some(({ type, condition }) => type === 'condition' && condition === 'Poisoned'),
    false
  );

  const throwTorch = rangerCatalog.skillsById.get(ID.THROW_TORCH);

  assert.equal(throwTorch.ammo, 2);
  assert.equal(throwTorch.ammoRecharge, 15);
  assert.equal(throwTorch.ammoCastLockout, 1);

  const bonfire = rangerCatalog.skillsById.get(ID.BONFIRE);

  assert.equal(bonfire.recharge, 25);
  assert.equal(bonfire.comboFields[0].fieldType, 'Fire');
  assert.equal(bonfire.effects.find(({ type }) => type === 'strike').ticks.length, 9);

  const naturalConvergence = rangerCatalog.skillsById.get(ID.NATURAL_CONVERGENCE);

  assert.equal(naturalConvergence.castTimeMs, 3120);
  assert.equal(naturalConvergence.quicknessCastTimeMs, 2080);
  assert.deepEqual(
    naturalConvergence.effects
      .find(({ type, ticks }) =>
        type === 'condition' ? ticks?.some(({ condition }) => condition === 'Immobilized') : false
      )
      .ticks.map(({ atMs, duration }) => [atMs, duration]),
    [[2640, 4]]
  );
  assert.deepEqual(
    naturalConvergence.effects
      .find(({ name }) => name === 'Black Hole')
      .ticks.map(({ atMs, flatDamage }) => [atMs, flatDamage]),
    [
      [2640, 158],
      [4160, 158],
      [5680, 158],
      [7200, 158]
    ]
  );

  const convergenceStrikes = simulate(['Celestial Avatar', 'Natural Convergence']).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.NATURAL_CONVERGENCE && event.coefficient > 0
  );

  assert.equal(convergenceStrikes.length, 4);
  assert.ok(
    convergenceStrikes.every(
      ({ weaponStrengthProfileId, resolvedWeaponStrength }) =>
        weaponStrengthProfileId === 'transform.celestial-avatar' && resolvedWeaponStrength === 617
    )
  );

  const entangle = rangerCatalog.skillsById.get(ID.ENTANGLE);

  assert.deepEqual(
    entangle.effects
      .find(({ type, ticks }) =>
        type === 'condition' ? ticks?.some(({ condition }) => condition === 'Immobilized') : false
      )
      .ticks.map(({ atMs, duration }) => [atMs, duration]),
    [
      [1560, 2],
      [3080, 2],
      [4600, 2],
      [6120, 2],
      [7640, 2]
    ]
  );

  const sunSpirit = rangerCatalog.skillsById.get(ID.SUN_SPIRIT);

  assert.equal(sunSpirit.recharge, 20);
  assert.equal(sunSpirit.quicknessCastTimeMs, 360);
  assert.deepEqual(
    [
      ID.ENTANGLE,
      ID.BONFIRE,
      ID.THROW_TORCH,
      ID.VIPERS_NEST,
      ID.LUNAR_IMPACT,
      ID.REJUVENATING_TIDES,
      ID.POISONOUS_CLOUD,
      ID.JACARANDAS_EMBRACE,
      ID.SPLITBLADE
    ].map((id) => rangerCatalog.skillsById.get(id).quicknessCastTimeMs),
    [680, 560, 440, 600, 920, 480, 1800, 1480, 560]
  );
  assert.deepEqual(
    sunSpirit.effects.map(({ type, duration, stacks }) => [type, duration, stacks]),
    [
      ['boon', 15, 2],
      ['blind', 5, undefined]
    ]
  );
  assert.equal(sunSpirit.effects[0].applications, 4);
  assert.equal(sunSpirit.effects[0].atMs, 2840);
  assert.equal(sunSpirit.effects[0].intervalMs, 1000);
  assert.equal(sunSpirit.effects[0].audience.recipients, 'party');
  assert.equal(sunSpirit.effects[0].audience.maximumRecipients, 5);

  const rejuvenatingTides = rangerCatalog.skillsById.get(ID.REJUVENATING_TIDES).effects[0];

  assert.deepEqual(
    [
      rejuvenatingTides.stacks,
      rejuvenatingTides.applications,
      rejuvenatingTides.atMs,
      rejuvenatingTides.intervalMs,
      rejuvenatingTides.audience.recipients,
      rejuvenatingTides.audience.maximumRecipients
    ],
    [1, 5, 960, 600, 'party', 5]
  );
  assert.ok(
    rangerCatalog.skillsById
      .get(ID.NATURAL_CONVERGENCE)
      .effects.filter(({ type, boon }) => type === 'boon' && boon === 'might')
      .every(({ audience }) => audience?.recipients === 'party' && audience.maximumRecipients === 5)
  );
});

test('Ranger evade skills and dodges trigger Light on Your Feet', () => {
  for (const id of [
    ID.STALKERS_STRIKE,
    ID.SERPENTS_STRIKE,
    ID.COUNTERATTACK_KICK,
    ID.SWOOP,
    ID.QUICK_SHOT,
    ID.PREDATORS_AMBUSH,
    ID.WARCLAWS_ENGAGE,
    ID.FLEETING_ZEPHYR,
    ID.WHIRLWIND
  ]) {
    assert.equal(rangerCatalog.skillsById.get(id).evades, true);
  }

  const result = simulate(["Stalker's Strike", 'Dodge'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });

  assert.equal(result.events.filter((event) => event.type === 'buff' && event.kind === 'light-on-your-feet').length, 2);
});

test('Light on Your Feet and Natural Balance add condition duration', () => {
  const lightOnYourFeet = rangerCoreModifierRules.find(
    ({ id }) => id === 'ranger.light-on-your-feet-condition-duration'
  );
  const naturalBalance = druidModifierRules.find(({ id }) => id === 'ranger.natural-balance-condition-duration');

  for (const rule of [lightOnYourFeet, naturalBalance]) {
    assert.equal(rule.target, 'conditionDuration');
    assert.equal(rule.operation, 'add');
    assert.equal(rule.amount, 0.1);
  }

  const result = simulate(['Dodge', 'Celestial Avatar', 'Release Celestial Avatar', 'Crippling Talon'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger',
    stats: { expertise: 0 },
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET, TRAIT.NATURAL_BALANCE]
  });
  const bleeding = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === ID.CRIPPLING_TALON && event.condition === 'Bleeding'
  );
  const baseDuration = rangerCatalog.skillsById
    .get(ID.CRIPPLING_TALON)
    .effects.find(({ condition }) => condition === 'Bleeding').duration;

  assert.ok(bleeding, JSON.stringify(result.warnings));
  assert.ok(Math.abs(bleeding.effectiveDuration - baseDuration * 1.2) < 1e-9);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'buff' && event.kind === 'natural-balance')
      .map(({ duration }) => duration),
    [10, 10]
  );
});

test('Light on Your Feet applies its six-second buff and shortbow upgrades', () => {
  const buffed = simulate(['Dodge', 'Crossfire'], {
    primaryWeapon: 'Shortbow',
    offHandWeapon: '',
    stats: { expertise: 0 },
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });
  const buff = buffed.events.find((event) => event.type === 'buff' && event.kind === 'light-on-your-feet');
  const crossfireBleeding = buffed.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Bleeding' &&
      (event.sourceId === ID.CROSSFIRE || event.sourceId === TRAIT.LIGHT_ON_YOUR_FEET)
  );

  assert.equal(buff.duration, 6);
  assert.equal(
    crossfireBleeding.reduce((total, event) => total + event.stacks, 0),
    2
  );
  assert.ok(crossfireBleeding.every((event) => event.effectiveDuration === 5.5));

  const evade = simulate(["Stalker's Strike"], {
    stats: { expertise: 0 },
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });
  const evadePoison = evade.resolvedEvents.filter(
    (event) => event.sourceId === ID.STALKERS_STRIKE && event.condition === 'Poisoned'
  );

  assert.ok(evadePoison.every((event) => event.effectiveDuration === 8.8));

  const stacked = simulate(['Dodge', 'Dodge'], {
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  }).events.filter((event) => event.type === 'buff' && event.kind === 'light-on-your-feet');

  assert.deepEqual(
    stacked.map(({ duration }) => duration),
    [6, 11.2]
  );

  const shortbow = simulate(['Poison Volley', 'Poison Volley'], {
    primaryWeapon: 'Shortbow',
    offHandWeapon: '',
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });

  assert.equal(shortbow.steps[1].start - shortbow.steps[0].end, 6400);

  const upgrades = simulate(['Poison Volley', 'Crippling Shot', 'Concussion Shot'], {
    primaryWeapon: 'Shortbow',
    offHandWeapon: '',
    stats: { expertise: 0 },
    target: { defiant: false, conditions: {} },
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });
  const poison = upgrades.resolvedEvents.find(
    (event) => event.sourceId === ID.POISON_VOLLEY && event.condition === 'Poisoned'
  );
  const immobilized = upgrades.resolvedEvents.find(
    (event) => event.sourceId === ID.CRIPPLING_SHOT && event.condition === 'Immobilized'
  );
  const vulnerability = upgrades.resolvedEvents.find(
    (event) => event.sourceId === TRAIT.LIGHT_ON_YOUR_FEET && event.condition === 'Vulnerability'
  );

  assert.equal(poison.duration, 5);
  assert.equal(immobilized.duration, 1.5);
  assert.deepEqual([vulnerability.stacks, vulnerability.duration], [10, 10]);

  const defiant = simulate(['Poison Volley', 'Crippling Shot'], {
    primaryWeapon: 'Shortbow',
    offHandWeapon: '',
    stats: { expertise: 0 },
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });

  assert.equal(
    defiant.resolvedEvents.find((event) => event.sourceId === ID.POISON_VOLLEY && event.condition === 'Poisoned')
      .effectiveDuration,
    7
  );
  assert.equal(
    defiant.resolvedEvents.find((event) => event.sourceId === ID.CRIPPLING_SHOT && event.condition === 'Immobilized')
      .effectiveDuration,
    2.5
  );
});

test('Jacaranda AI and Beast command expose the requested pulses', () => {
  const jacaranda = RANGER_PETS.find(({ name }) => name === 'Jacaranda');

  assert.deepEqual(jacaranda.skillIds, [
    ID.JACARANDA_ROOT_SLAP,
    ID.JACARANDA_CALL_LIGHTNING,
    ID.PHOTOSYNTHESIZE,
    ID.JACARANDAS_EMBRACE
  ]);

  const callLightning = rangerCatalog.skillsById.get(ID.JACARANDA_CALL_LIGHTNING);

  assert.equal(callLightning.recharge, 15);
  assert.equal(callLightning.effects[0].ticks.length, 5);
  assert.equal(
    callLightning.effects[0].ticks.reduce((total, tick) => total + tick.coefficient, 0),
    2.5
  );

  const embrace = rangerCatalog.skillsById.get(ID.JACARANDAS_EMBRACE);

  assert.deepEqual(embrace.effects[0].ticks, [{ atMs: 920, coefficient: 0.16 }]);
  assert.deepEqual(
    embrace.effects
      .find(({ type, ticks }) => type === 'condition' && ticks?.some(({ condition }) => condition === 'Immobilized'))
      .ticks.filter(({ condition }) => condition === 'Immobilized')
      .map(({ duration }) => duration),
    [1, 2, 2, 2, 2]
  );

  const result = simulate(['__combat_start', { type: 'wait', durationMs: 3000 }], {
    selectedPet: 'Jacaranda',
    selectedTraitIds: []
  });
  const packet = result.resolvedEvents.find(({ type, actorType }) => type === 'damage' && actorType === 'summon');
  const rootAction = result.events.find(({ type, skillId }) => type === 'action' && skillId === ID.JACARANDA_ROOT_SLAP);
  const rootHit = result.resolvedEvents.find(
    ({ type, skillId }) => type === 'damage' && skillId === ID.JACARANDA_ROOT_SLAP
  );

  // Root Slap connects 920 ms into its recovery, matching the EVTC packet instead of waiting for animation end.
  assert.ok(Math.abs(rootHit.at - rootAction.at - 0.92) < 1e-9);

  assert.deepEqual(
    [
      packet.summonBasePower,
      packet.summonBasePrecision,
      packet.summonBaseToughness,
      packet.summonBaseVitality,
      packet.summonBaseConditionDamage,
      packet.summonBaseFerocity,
      packet.summonBaseHealingPower
    ],
    [1868, 1524, 2211, 2211, 400, 0, 1200]
  );
});

test("Stalker's Strike bonuses require Cripple, Slow, or Immobilize", () => {
  const run = (target) =>
    simulate(["Stalker's Strike"], {
      target,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger',
      stats: { expertise: 0 },
      selectedTraitIds: []
    });
  const strikeDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.STALKERS_STRIKE).damage;
  const poisonStacks = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === ID.STALKERS_STRIKE)
      .reduce((total, event) => total + event.stacks, 0);
  const base = run({ defiant: false, conditions: {} });
  const defiant = run({ defiant: true, conditions: {} });

  assert.equal(poisonStacks(base), 3);
  assert.equal(poisonStacks(defiant), 3);
  assert.equal(strikeDamage(defiant), strikeDamage(base));

  for (const condition of ['Cripple', 'Slow', 'Immobilize']) {
    const impaired = run({ defiant: false, conditions: { [condition]: true } });

    assert.equal(poisonStacks(impaired), 5);
    assert.equal(strikeDamage(impaired), strikeDamage(base) * 2);
  }
});

test('Carrion Devourer packets use its level-80 attributes', () => {
  const result = simulate(['__combat_start', { type: 'wait', durationMs: 2000 }], {
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: []
  });
  const packet = result.resolvedEvents.find(({ type, actorType }) => type === 'damage' && actorType === 'summon');

  assert.deepEqual(
    [
      packet.summonBasePower,
      packet.summonBasePrecision,
      packet.summonBaseToughness,
      packet.summonBaseVitality,
      packet.summonBaseConditionDamage,
      packet.summonBaseFerocity,
      packet.summonBaseHealingPower
    ],
    [1524, 1524, 2898, 2211, 1000, 0, 0]
  );
});

test('Poisonous Cloud uses six player packets across its fixed field window', () => {
  const result = simulate(['Poisonous Cloud', { type: 'wait', durationMs: 10000 }], {
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: [],
    stats: { conditionDamage: 0, expertise: 0 }
  });
  const packets = result.resolvedEvents.filter(({ skillId }) => skillId === ID.POISONOUS_CLOUD);
  const strikes = packets.filter(({ type }) => type === 'damage');
  const poison = packets.filter(({ type }) => type === 'condition');
  const skill = rangerCatalog.skillsById.get(ID.POISONOUS_CLOUD);

  assert.equal(skill.recharge, 30);
  assert.equal(strikes.length, 6);
  assert.ok(strikes.every(({ coefficient }) => coefficient === 0.2));
  assert.ok(strikes.every(({ actorType }) => actorType === 'player'));
  assert.equal(poison.length, 6);
  assert.ok(poison.every(({ actorType, source }) => actorType === 'player' && source === 'ranger'));
  assert.ok(
    poison.every(({ stacks, duration, effectiveDuration }) => stacks === 1 && duration === 6 && effectiveDuration === 6)
  );
  assert.deepEqual(skill.comboFields[0], {
    ownerId: 'ranger',
    fieldType: 'Poison',
    duration: 5,
    startMs: 1000,
    startAnchor: 'castStart'
  });

  const twinDarts = rangerCatalog.skillsById.get(ID.TWIN_DARTS);
  const tailLash = rangerCatalog.skillsById.get(ID.PET_TAIL_LASH);

  assert.equal(
    twinDarts.effects[0].ticks.reduce((total, { coefficient }) => total + coefficient, 0),
    0.3
  );
  assert.equal(twinDarts.effects[0].comboFinishers[0].chance, 0.2);
  assert.equal(tailLash.recharge, 20);
  assert.equal(tailLash.effects[0].ticks[0].coefficient, 0.5);
});

test('pet commands do not reserve the player cast lane', () => {
  const result = simulate(['Poisonous Cloud', 'Instinctive Engage'], {
    selectedPet: 'Carrion Devourer'
  });
  const command = result.steps.find(({ skill }) => skill === 'Poisonous Cloud');
  const playerSkill = result.steps.find(({ skill }) => skill === 'Instinctive Engage');

  assert.equal(command.start, 0);
  assert.equal(playerSkill.start, 0);
});

test('Poison Master remains player-scaled and Poisonous Strikes inherits its attacker', () => {
  const poisonMaster = simulate(["Jacaranda's Embrace", { type: 'wait', durationMs: 4000 }], {
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });
  const poisonMasterProc = poisonMaster.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER
  );

  assert.equal(poisonMasterProc.stacks, 2);
  assert.equal(poisonMasterProc.duration, 8);
  assert.equal(poisonMasterProc.effectiveDuration, 14.4);
  assert.equal(poisonMasterProc.actorType, 'effect');
  assert.equal(Object.hasOwn(poisonMasterProc, 'summonBaseConditionDamage'), false);

  const zeroPlayerConditionDamage = simulate(["Jacaranda's Embrace", { type: 'wait', durationMs: 4000 }], {
    stats: { conditionDamage: 0, expertise: 0 },
    selectedTraitIds: [TRAIT.POISON_MASTER]
  }).resolvedEvents.find((event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER);

  // The pet triggers Poison Master, but the trait packet scales from the Ranger's Condition Damage and Expertise.
  assert.ok(poisonMasterProc.damage > zeroPlayerConditionDamage.damage);
  assert.equal(zeroPlayerConditionDamage.effectiveDuration, 8);

  const poisonousStrikes = simulate([{ name: '__combat_start' }, 'Double Arc', { type: 'wait', durationMs: 8000 }]);
  const poisonousStrikeProcs = poisonousStrikes.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === ID.DOUBLE_ARC && event.skillName === 'Poisonous Strikes'
  );

  assert.equal(poisonousStrikeProcs.length, 2);
  assert.equal(poisonousStrikes.events.find((event) => event.type === 'ranger.poisonous-strikes').duration, 7);
  assert.equal(
    poisonousStrikes.resolvedEvents.some(
      (event) =>
        event.sourceId === ID.DOUBLE_ARC && event.condition === 'Poisoned' && event.skillName !== 'Poisonous Strikes'
    ),
    false
  );
  assert.equal(
    poisonousStrikeProcs.every((event) => event.actorType === 'summon' && event.summonBaseConditionDamage != null),
    true
  );
  assert.ok(poisonousStrikeProcs.every((event) => event.duration === 6 && event.effectiveDuration === 6));

  const poisonousStrikesWithPoisonMaster = simulate(
    [{ name: '__combat_start' }, 'Double Arc', { type: 'wait', durationMs: 8000 }],
    {
      selectedTraitIds: [TRAIT.POISON_MASTER]
    }
  ).resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === ID.DOUBLE_ARC && event.skillName === 'Poisonous Strikes'
  );

  assert.ok(
    poisonousStrikesWithPoisonMaster.every((event, index) => event.damage === poisonousStrikeProcs[index].damage)
  );
});

test('Sharpened Edges procs for player and pet critical hits at 33%', () => {
  assert.equal(rangerCoreCriticalReactions.chanceOnCriticalHit, 0.33);
  assert.deepEqual(rangerCoreCriticalReactions.actorTypes, ['player', 'summon']);
});

test('Druid Avatar traits grant alacrity, Eclipse conditions, and Blood Moon', () => {
  const selectedTraitIds = [
    TRAIT.CELESTIAL_BEING,
    TRAIT.NATURAL_MENDER,
    TRAIT.BLOOD_MOON,
    TRAIT.GRACE_OF_THE_LAND,
    TRAIT.ECLIPSE
  ];
  const result = simulate(
    ['Celestial Avatar', 'Natural Convergence', 'Lunar Impact', 'Rejuvenating Tides', 'Release Celestial Avatar'],
    { selectedTraitIds }
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.filter((event) => event.type === 'buff' && event.kind === 'alacrity').length, 6);
  assert.equal(
    result.events
      .filter(
        (event) => event.type === 'condition' && event.sourceId === TRAIT.ECLIPSE && event.condition === 'Burning'
      )
      .reduce((total, event) => total + event.stacks, 0),
    6
  );
  const seed = simulate(['Celestial Avatar', 'Seed of Life'], {
    selectedTraitIds: [TRAIT.ECLIPSE]
  }).resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.ECLIPSE && event.condition === 'Poisoned'
  );

  assert.equal(seed.stacks, 3);
  assert.equal(seed.duration, 8);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.BLOOD_MOON).length >=
      3,
    true
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' &&
          event.sourceId === TRAIT.BLOOD_MOON &&
          (event.triggeredBy === 'Lunar Impact' || event.triggeredBy === 'Eclipse')
      )
      .map(({ triggeredBy, stacks, duration }) => [triggeredBy, stacks, duration]),
    [
      ['Lunar Impact', 2, 4],
      ['Eclipse', 2, 4]
    ]
  );
  assert.equal(result.endState.profession.celestialAvatarActive, false);
  assert.equal(result.endState.profession.astralForce > 0, true);

  const naturalMender = simulate([{ type: 'wait', durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER]
  });

  assert.equal(naturalMender.endState.profession.astralForce, 16);

  const convergence = simulate(
    ['Celestial Avatar', 'Natural Convergence', 'Release Celestial Avatar', { type: 'wait', durationMs: 8000 }],
    { selectedTraitIds: [TRAIT.BLOOD_MOON] }
  );

  assert.deepEqual(
    convergence.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === TRAIT.BLOOD_MOON)
      .map(({ at, triggeredBy }) => [Math.round(at * 1000), triggeredBy]),
    [
      [2640, 'Natural Convergence'],
      [2640, 'Black Hole'],
      [4160, 'Black Hole'],
      [5680, 'Black Hole'],
      [7200, 'Black Hole']
    ]
  );

  const entangle = simulate(['Entangle', { type: 'wait', durationMs: 8000 }], {
    selectedTraitIds: [TRAIT.BLOOD_MOON]
  });

  assert.deepEqual(
    entangle.resolvedEvents
      .filter(
        (event) => event.type === 'condition' && event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === 'Entangle'
      )
      .map(({ at }) => Math.round(at * 1000)),
    [1560, 3080, 4600, 6120, 7640]
  );

  const embrace = simulate(
    ["Jacaranda's Embrace", { type: 'wait', durationMs: 2000 }, 'Swap Pets', { type: 'wait', durationMs: 6000 }],
    { selectedTraitIds: [TRAIT.BLOOD_MOON] }
  );
  const embraceBloodMoon = embrace.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === "Jacaranda's Embrace"
  );

  assert.equal(embraceBloodMoon.length, 5);
  assert.ok(
    embraceBloodMoon.every(
      ({ actorType, ownerActorType, stacks, duration }) =>
        actorType === 'effect' && ownerActorType === 'player' && stacks === 2 && duration === 4
    )
  );
});

test("Sun Spirit emits Solar Flare's burning packet", () => {
  const result = simulate(['Sun Spirit', { type: 'wait', durationMs: 6000 }], {
    sharePlayerBoonsWithSummons: true
  });
  const solarFlare = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === ID.SOLAR_FLARE
  );

  assert.equal(solarFlare.stacks, 3);
  assert.equal(solarFlare.duration, 6);
  assert.equal(solarFlare.triggeredBy, 'Sun Spirit');
  const might = result.events.filter(({ type, kind }) => type === 'buff' && kind === 'might');

  assert.deepEqual(
    might.map(({ at, stacks }) => [at, stacks]),
    [
      [2.84, 2],
      [3.84, 2],
      [4.84, 2],
      [5.84, 2]
    ]
  );
  assert.ok(might.every(({ resolvedAudience }) => resolvedAudience.includesSummons));
});

test('Ranger child damage rows resolve their dedicated icons', () => {
  const app = {
    attributeData: { activeTraits: [] },
    results: { procSteps: [] },
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    skills: rangerCatalog.skills
  };
  const solarFlare = skillBreakdownRows(simulate(['Sun Spirit', { type: 'wait', durationMs: 6000 }])).find(
    ({ sourceSkill }) => sourceSkill === 'Solar Flare'
  );
  const blackHole = skillBreakdownRows(simulate(['Celestial Avatar', 'Natural Convergence'])).find(
    ({ sourceSkill }) => sourceSkill === 'Black Hole'
  );

  assert.ok(solarFlare);
  assert.ok(blackHole);
  assert.equal(
    resultSkillIcon(app, solarFlare),
    'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Solar_Flare.png'
  );
  assert.equal(
    resultSkillIcon(app, blackHole),
    'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Black_Hole.png'
  );
});

test('Celestial Avatar Might pulses reach the active pet', () => {
  const result = simulate(
    [
      'Celestial Avatar',
      'Natural Convergence',
      'Rejuvenating Tides',
      { type: 'wait', durationMs: 4000 },
      'Release Celestial Avatar'
    ],
    { selectedTraitIds: [], sharePlayerBoonsWithSummons: true }
  );
  const might = result.events.filter(
    ({ type, kind, skillId }) =>
      type === 'buff' && kind === 'might' && [ID.NATURAL_CONVERGENCE, ID.REJUVENATING_TIDES].includes(skillId)
  );

  assert.equal(might.length, 9);
  assert.ok(might.every(({ stacks, resolvedAudience }) => stacks === 1 && resolvedAudience.includesSummons));
});

test('legacy healing-rate assumptions no longer generate Astral Force', () => {
  const result = simulate([{ type: 'wait', durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER],
    professionAssumptions: { astralForceHealingEventsPerSecond: 2 }
  });

  assert.equal(result.endState.profession.astralForce, 16);
  assert.equal(
    Object.hasOwn(
      migrateRangerBuild({
        assumptions: { astralForceHealingEventsPerSecond: 2 }
      }).assumptions,
      'astralForceHealingEventsPerSecond'
    ),
    false
  );
});

test('Astral Force follows landed direct damage and excludes pet damage', () => {
  const directDamage = simulate(["Viper's Nest", 'Celestial Avatar'], {
    initialAstralForce: 98.5,
    selectedTraitIds: [TRAIT.NATURAL_MENDER]
  });

  assert.equal(directDamage.steps.find(({ skill }) => skill === 'Celestial Avatar').start, 1000);

  const petDamage = simulate(['Poisonous Cloud', 'Celestial Avatar'], {
    initialAstralForce: 99.25,
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: [TRAIT.NATURAL_MENDER]
  });

  assert.equal(petDamage.steps.find(({ skill }) => skill === 'Celestial Avatar').start, 3000);

  const withoutEclipse = simulate([
    'Celestial Avatar',
    'Natural Convergence',
    { type: 'wait', durationMs: 8000 },
    'Release Celestial Avatar'
  ]);
  const withEclipse = simulate(
    ['Celestial Avatar', 'Natural Convergence', { type: 'wait', durationMs: 8000 }, 'Release Celestial Avatar'],
    { selectedTraitIds: [TRAIT.ECLIPSE] }
  );

  assert.equal(withEclipse.endState.profession.astralForce, withoutEclipse.endState.profession.astralForce);

  const eclipseDamage = simulate(["Viper's Nest", 'Celestial Avatar'], {
    initialAstralForce: 97,
    selectedTraitIds: [TRAIT.ECLIPSE]
  });

  assert.equal(eclipseDamage.steps.find(({ skill }) => skill === 'Celestial Avatar').start, 900);
});

test('Celestial Avatar transitions trigger swap mechanics and weapon lines', () => {
  const result = simulate(
    ['__combat_start', 'Celestial Avatar', { type: 'wait', durationMs: 10000 }, 'Release Celestial Avatar'],
    {
      sigilSets: [
        { names: ['Hydromancy'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'sigil_swap').map((event) => event.skillName),
    ['Celestial Avatar', 'Release Celestial Avatar']
  );
  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Hydromancy').map((step) => step.sourceSkill),
    ['Celestial Avatar', 'Release Celestial Avatar']
  );

  const transition = rangerProfession.ui.timelineWeaponLineTransition;
  const rotation = ['Splitblade', 'Celestial Avatar', 'Natural Convergence', 'Release Celestial Avatar', 'Splitblade'];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: rangerCatalog.skillsByName.get(name),
        specialization: 'Druid',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Celestial Avatar', null]
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
});
