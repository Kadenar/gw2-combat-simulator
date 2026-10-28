import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { criticalResolved } from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { druidModule } from '#gw2/professions/ranger/specializations/druid/module.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  selectedPet: 'Jacaranda',
  selectedPet2: 'Carrion Devourer',
  primaryWeapon: 'Dagger',
  offHandWeapon: 'Torch',
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1800,
    expertise: 1200,
    concentration: 750
  }),
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(rotation, config = {}) {
  const options = {
    ...baseConfig,
    ...config,
    specialization: 'Druid',
    attributeInputs: baseAttributeInputs({
      ...baseConfig.attributeInputs.weaponSets[0].commonTotals,
      ...config.attributeInputs?.weaponSets[0].commonTotals
    }),
    target: { ...baseConfig.target, ...config.target }
  };
  return observeGw2Runtime({ profession: rangerProfession.runtimeFor(options), rotation, config: options });
}

test('condition Druid weapon packets and cooldowns use configured profiles', () => {
  const doubleArc = rangerCatalog.skillsById.get(ID.DOUBLE_ARC);

  assert.equal(doubleArc.cooldown, 6);
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

  const bonfire = rangerCatalog.skillsById.get(ID.BONFIRE);

  assert.equal(bonfire.cooldown, 25);
  assert.equal(bonfire.comboFields[0].fieldType, 'Fire');

  const convergenceStrikes = simulate([
    'Celestial Avatar',
    'Natural Convergence',
    { type: 'wait', durationMs: 2000 }
  ]).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.NATURAL_CONVERGENCE && event.coefficient > 0
  );

  assert.ok(convergenceStrikes.length > 0);
  assert.ok(
    convergenceStrikes.every(
      ({ weaponStrengthProfileId, resolvedWeaponStrength }) =>
        weaponStrengthProfileId === 'transform.celestial-avatar' && resolvedWeaponStrength === 617
    )
  );

  const sunSpirit = rangerCatalog.skillsById.get(ID.SUN_SPIRIT);

  assert.equal(sunSpirit.cooldown, 20);
  assert.deepEqual(
    sunSpirit.effects.map(({ type, duration, stacks }) => [type, duration, stacks]),
    [
      ['boon', 15, 2],
      ['condition', 5, 1]
    ]
  );
  assert.equal(sunSpirit.effects[0].audience.recipients, 'party');
  assert.equal(sunSpirit.effects[0].audience.maximumRecipients, 5);
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
  const lightOnYourFeet = rangerCoreModule.modifiers.modifierRules.find(
    ({ id }) => id === 'ranger.light-on-your-feet-condition-duration'
  );
  const naturalBalance = druidModule.modifiers.modifierRules.find(
    ({ id }) => id === 'ranger.natural-balance-condition-duration'
  );

  for (const rule of [lightOnYourFeet, naturalBalance]) {
    assert.equal(rule.target, 'conditionDuration');
    assert.equal(rule.operation, 'add');
    assert.equal(rule.amount({ catalog: rangerCatalog }), 0.1);
  }

  const result = simulate(['Dodge', 'Celestial Avatar', 'Release Celestial Avatar', 'Crippling Talon'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Dagger',
    attributeInputs: baseAttributeInputs({ expertise: 0 }),
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

test("Stalker's Strike bonuses require Cripple, Slow, or Immobilize", () => {
  const run = (target) =>
    simulate(["Stalker's Strike"], {
      target,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Dagger',
      attributeInputs: baseAttributeInputs({ expertise: 0 }),
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

  for (const condition of ['Crippled', 'Slow', 'Immobilized']) {
    const impaired = run({ defiant: false, conditions: { [condition]: true } });

    assert.equal(poisonStacks(impaired), 5);
    assert.ok(Math.abs(strikeDamage(impaired) - strikeDamage(base) * 2) <= 1);
  }
});

test('Carrion Devourer packets use its level-80 attributes', () => {
  const result = simulate(['__combat_start', { type: 'wait', durationMs: 2000 }], {
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: []
  });
  const packet = result.resolvedEvents.find(({ type, actorType }) => type === 'damage' && actorType === 'summon');

  assert.deepEqual(
    [packet.summonBasePower, packet.summonBasePrecision, packet.summonBaseConditionDamage, packet.summonBaseFerocity],
    [1524, 1524, 1000, 0]
  );
});

test('precast Poisonous Cloud retains player ownership across combat entry and pet retirement', () => {
  // A precast cloud starts before combat and its player-owned damage survives replacement of the casting pet.
  const result = simulate(
    [
      'Celestial Avatar',
      'Poisonous Cloud',
      { type: 'combat-start', concurrentOffsetMs: 1040 },
      { type: 'cast', skillId: ID.PET_SWAP, concurrentOffsetMs: 1600 },
      { type: 'wait', durationMs: 10000 }
    ],
    {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Jacaranda',
      selectedTraitIds: [],
      attributeInputs: baseAttributeInputs({ conditionDamage: 0, expertise: 0 })
    }
  );
  const packets = result.resolvedEvents.filter(({ skillId }) => skillId === ID.POISONOUS_CLOUD);
  const strikes = packets.filter(({ type }) => type === 'damage');
  const poison = packets.filter(({ type }) => type === 'condition');
  const skill = rangerCatalog.skillsById.get(ID.POISONOUS_CLOUD);

  assert.equal(skill.cooldown, 30);
  assert.ok(strikes.every(({ coefficient }) => coefficient === 0.2));
  assert.ok(strikes.every(({ actorType }) => actorType === 'player'));
  assert.ok(poison.every(({ actorType, source }) => actorType === 'player' && source === 'ranger'));
  assert.ok(
    poison.every(({ stacks, duration, effectiveDuration }) => stacks === 1 && duration === 6 && effectiveDuration === 6)
  );
  assert.ok(strikes[0].at > result.combatStartTime);
  const retirement = result.events.find(({ type, action }) => type === 'marker' && action === 'companion-retired');
  assert.ok(retirement);
  assert.ok(strikes.some(({ at, damage }) => at > retirement.at && damage > 0));
  assert.ok(poison.some(({ at, damage }) => at > retirement.at && damage > 0));
  assert.ok(packets.every(({ summonOwner }) => summonOwner === retirement.summonOwner));

  const twinDarts = rangerCatalog.skillsById.get(ID.TWIN_DARTS);
  const tailLash = rangerCatalog.skillsById.get(ID.PET_TAIL_LASH);

  assert.equal(
    twinDarts.effects[0].ticks.reduce((total, { coefficient }) => total + coefficient, 0),
    0.3
  );
  assert.equal(twinDarts.effects[0].comboFinishers[0].chance, 0.2);
  assert.equal(tailLash.cooldown, 20);
  assert.equal(tailLash.effects[0].coefficient, 0.5);
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

test('Hidden Barbs boosts only player-owned bleeding', () => {
  // Resolve the same condition with and without the trait so pet modifier inheritance cannot leak the player bonus.
  for (const ownership of [
    { actorType: 'player' },
    { actorType: 'effect', ownerActorType: 'player' },
    {
      actorType: 'summon',
      independentConditionOwner: true,
      summonUsesProfessionModifiers: true,
      summonBaseConditionDamage: 1000
    },
    { actorType: 'effect', ownerActorType: 'summon', summonUsesProfessionModifiers: true }
  ]) {
    for (const condition of ['Bleeding', 'Poisoned']) {
      const damage = (selectedTraitIds) =>
        resolveTestGw2Events({
          profession: rangerProfession,
          config: { ...baseConfig, specialization: 'Druid', selectedTraitIds },
          endTime: 3,
          events: [
            {
              at: 0,
              type: 'condition',
              condition,
              duration: 1,
              stacks: 1,
              source: 'ranger',
              sourceId: 'fixture.hidden-barbs',
              skillName: 'Ownership fixture',
              ...ownership
            }
          ]
        }).resolvedEvents.find((event) => event.sourceId === 'fixture.hidden-barbs').damage;
      const base = damage([]);
      const boosted = damage([TRAIT.HIDDEN_BARBS]);
      const playerOwned = (ownership.ownerActorType ?? ownership.actorType) === 'player';
      assert.ok(base > 0);
      assert.ok(
        Math.abs(boosted - base * (playerOwned && condition === 'Bleeding' ? 1.2 : 1)) <= 1,
        JSON.stringify({ ownership, condition, base, boosted })
      );
    }
  }
});

test('Poison Master remains player-scaled and Poisonous Strikes inherits its attacker', () => {
  const poisonMaster = simulate(["Jacaranda's Embrace", { type: 'wait', durationMs: 4000 }], {
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });
  const poisonMasterProc = poisonMaster.resolvedEvents.find(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER
  );

  assert.equal(
    poisonMaster.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER)
      .reduce((sum, event) => sum + event.stacks, 0),
    2
  );
  assert.equal(poisonMasterProc.duration, 8);
  assert.equal(poisonMasterProc.effectiveDuration, 14.4);
  assert.equal(poisonMasterProc.actorType, 'effect');
  assert.equal(Object.hasOwn(poisonMasterProc, 'summonBaseConditionDamage'), false);

  const zeroPlayerConditionDamage = simulate(["Jacaranda's Embrace", { type: 'wait', durationMs: 4000 }], {
    attributeInputs: baseAttributeInputs({ conditionDamage: 0, expertise: 0 }),
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
  assert.equal(poisonousStrikes.events.find((event) => event.type === 'ranger.poisonous-strikes').duration, 10);
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

// Compiled critical listeners reread the selected profile and keep player/pet admission before secondary rolls.
test('Sharpened Edges observes patched critical chance and packets through its selected trigger', () => {
  const selectedTraitIds = [TRAIT.SHARPENED_EDGES],
    queued = [],
    chances = [];
  const context = {
    config: { selectedTraitIds },
    catalog: rangerCatalog,
    random: {
      roll(chance) {
        chances.push(chance);
        return true;
      }
    },
    // Capture actual materialized packets so the fixture preserves the shared emission contract.
    effects: captureEffectEmissions({ submit: (event) => queued.push(event) }).effects
  };
  bindTriggerPoints(context, rangerProfession, context.config);
  const details = { hitContext: { critical: { chance: 1, didCrit: true } } };
  for (const [chance, duration, override] of [
    [0.33, 3, undefined],
    [0.75, 6, undefined],
    [0.75, 6, 0.25],
    [0.75, 6, undefined]
  ]) {
    // Clearing the saved override restores the active patch's default; it never changes critical eligibility.
    context.config.procRateOverrides = override === undefined ? {} : { 'ranger.sharpened-edges': override };
    context.catalog = withProfile(rangerCatalog, TRAIT.SHARPENED_EDGES, {
      criticalChance: chance,
      effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration, stacks: 2 }]
    });
    const event = { type: 'damage', at: 1, actorType: 'player', skillName: 'Test' };
    context.fireTrigger(criticalResolved, { event: { ...event, actorType: 'effect' }, details });
    context.fireTrigger(criticalResolved, {
      event,
      details: { hitContext: { critical: { chance: 1, didCrit: false } } }
    });
    context.fireTrigger(criticalResolved, { event, details });
    assert.equal(chances.at(-1), override ?? chance);
    assert.equal(queued.at(-1).duration, duration);
    assert.equal(queued.at(-1).stacks, 2);
  }

  assert.deepEqual(chances, [0.33, 0.75, 0.25, 0.75]);
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
  const graceAlacrity = result.events.filter((event) => event.type === 'buff' && event.kind === 'alacrity');
  assert.ok(graceAlacrity.length > 0);
  // Grace of the Land is an allied area boon: the active pet receives every grant, which speeds its Beast recharge.
  assert.ok(
    graceAlacrity.every(
      ({ resolvedAudience }) => resolvedAudience.includesSelf && resolvedAudience.companionIds.length === 1
    )
  );
  assert.equal(
    result.events
      .filter(
        (event) => event.type === 'condition' && event.sourceId === TRAIT.ECLIPSE && event.condition === 'Burning'
      )
      .reduce((total, event) => total + event.stacks, 0),
    6
  );
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
      ['Lunar Impact', 1, 4],
      ['Lunar Impact', 1, 4],
      ['Eclipse', 1, 4],
      ['Eclipse', 1, 4]
    ]
  );
  assert.equal(result.planningState.profession[STATE.CELESTIAL_AVATAR_ENDS_AT], null);
  assert.equal(result.planningState.profession[STATE.ASTRAL_CLOCK].value > 0, true);

  const naturalMender = simulate([{ type: 'wait', durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER]
  });

  assert.equal(naturalMender.planningState.profession[STATE.ASTRAL_CLOCK].value, 16);

  const convergence = simulate(
    ['Celestial Avatar', 'Natural Convergence', 'Release Celestial Avatar', { type: 'wait', durationMs: 8000 }],
    { selectedTraitIds: [TRAIT.BLOOD_MOON] }
  );
  assert.ok(
    convergence.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === 'Black Hole'
    )
  );
  // The persistent child owns the immobilize and trait trigger after Avatar release, without a second disable.
  const blackHoleImmobilize = convergence.resolvedEvents.find(
    (event) => event.sourceId === ID.BLACK_HOLE && event.condition === 'Immobilized'
  );
  const release = convergence.steps.find(({ skill }) => skill === 'Release Celestial Avatar');
  assert.ok(blackHoleImmobilize.at > release.end / 1000);
  assert.equal(blackHoleImmobilize.ownerActorType, 'player');
  assert.equal(blackHoleImmobilize.duration, 2);
  assert.equal(
    convergence.events.some((event) => event.sourceId === ID.BLACK_HOLE && event.type === 'control'),
    false
  );
  assert.equal(
    convergence.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === 'Natural Convergence'
    ),
    false
  );

  const entangle = simulate(['Entangle', { type: 'wait', durationMs: 8000 }], {
    selectedTraitIds: [TRAIT.BLOOD_MOON]
  });
  assert.ok(
    entangle.resolvedEvents.some((event) => event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === 'Entangle')
  );

  const embrace = simulate(
    ["Jacaranda's Embrace", { type: 'wait', durationMs: 2000 }, 'Swap Pets', { type: 'wait', durationMs: 6000 }],
    { selectedTraitIds: [TRAIT.BLOOD_MOON] }
  );
  const embraceBloodMoon = embrace.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === "Jacaranda's Embrace"
  );
  assert.ok(embraceBloodMoon.length > 0);
  assert.ok(
    embraceBloodMoon.every(
      ({ actorType, ownerActorType, stacks, duration }) =>
        actorType === 'effect' && ownerActorType === 'player' && stacks === 1 && duration === 4
    )
  );
});

// Embrace splits its strikes by owner: the pet's projectile is crit-eligible on the pet's own attributes, while the
// four Ranger-owned vine strikes are locked to never crit, even at full Ranger critical chance, so they never feed
// Sharpened Edges.
test("Jacaranda's Embrace vine strikes are Ranger-owned and never crit", () => {
  const result = simulate([{ type: 'combat-start' }, "Jacaranda's Embrace", { type: 'wait', durationMs: 8000 }], {
    selectedTraitIds: [TRAIT.SHARPENED_EDGES],
    attributeInputs: baseAttributeInputs({ precision: 6000 })
  });
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.JACARANDAS_EMBRACE
  );
  assert.deepEqual(
    strikes.map(({ actorType, critEligible }) => [actorType, critEligible]),
    [
      ['summon', true],
      ['player', false],
      ['player', false],
      ['player', false],
      ['player', false]
    ]
  );
  const vines = strikes.filter((event) => event.actorType === 'player');
  assert.ok(vines.every((event) => event.damage > 0 && event.didCrit === false));
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Sharpened Edges' &&
        vines.some((vine) => vine.at === event.at)
    ),
    false
  );
});

test('Seed of Life detonates with Eclipse after releasing Celestial Avatar', () => {
  // Releasing the form before detonation must preserve the planted seed and its player-owned trait payload.
  const result = simulate(
    [
      'Celestial Avatar',
      'Seed of Life',
      { type: 'wait', durationMs: 200 },
      'Release Celestial Avatar',
      { type: 'wait', durationMs: 1500 }
    ],
    { selectedTraitIds: [TRAIT.ECLIPSE] }
  );
  const release = result.steps.find(({ skill }) => skill === 'Release Celestial Avatar');
  const blind = result.resolvedEvents.find(
    (event) => event.sourceId === ID.SEED_OF_LIFE && event.condition === 'Blindness'
  );
  const poison = result.resolvedEvents.filter(
    (event) => event.sourceId === TRAIT.ECLIPSE && event.condition === 'Poisoned'
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.CELESTIAL_AVATAR_ENDS_AT], null);
  assert.ok(blind.at > release.end / 1000);
  assert.equal(
    poison.reduce((sum, event) => sum + event.stacks, 0),
    3
  );
  assert.ok(
    poison.every((event) => event.at === blind.at && event.duration === 8 && event.ownerActorType === 'player')
  );
});

test('Blood Moon requires player ownership for both disables and immobilizes', () => {
  // Actor display labels do not grant ownership: summoned pets are excluded, but player-owned child effects qualify.
  for (const ownership of [
    { actorType: 'player' },
    { actorType: 'effect', ownerActorType: 'player' },
    { actorType: 'summon' },
    { actorType: 'effect', ownerActorType: 'summon' },
    { actorType: 'unknown' }
  ]) {
    for (const payload of [
      { type: 'control', controlKind: 'knockback' },
      { type: 'condition', condition: 'Immobilized', duration: 2, stacks: 1 }
    ]) {
      const result = resolveTestGw2Events({
        profession: rangerProfession,
        config: { ...baseConfig, specialization: 'Druid', selectedTraitIds: [TRAIT.BLOOD_MOON] },
        endTime: 1,
        events: [
          {
            at: 0,
            source: 'ranger',
            sourceId: 'fixture.blood-moon',
            skillName: 'Ownership fixture',
            ...ownership,
            ...payload
          }
        ]
      });
      const bleeds = result.resolvedEvents.filter(
        (event) => event.sourceId === TRAIT.BLOOD_MOON && event.triggeredBy === 'Ownership fixture'
      );
      const playerOwned = (ownership.ownerActorType ?? ownership.actorType) === 'player';
      assert.equal(
        bleeds.reduce((sum, event) => sum + event.stacks, 0),
        playerOwned ? 2 : 0
      );
      assert.ok(bleeds.every((event) => event.ownerActorType === 'player' && event.duration === 4));
    }
  }
});

test("Sun Spirit emits Solar Flare's individual burning stacks", () => {
  const result = simulate(['Sun Spirit', { type: 'wait', durationMs: 6000 }], {
    sharePlayerBoonsWithSummons: true
  });
  const solarFlare = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === ID.SOLAR_FLARE
  );

  // Solar Flare shares the first shake while preserving player ownership and three burning applications.
  assert.ok(solarFlare.length > 0);
  assert.ok(
    solarFlare.every((event) => event.stacks === 1 && event.duration === 6 && event.triggeredBy === 'Sun Spirit')
  );
  assert.ok(solarFlare.every((event) => event.at === solarFlare[0].at));
  const might = result.events.filter(({ type, kind }) => type === 'buff' && kind === 'might');
  assert.equal(solarFlare[0].at, might[0].at);
  assert.ok(might.every(({ resolvedAudience }) => resolvedAudience.includesSummons));
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

  assert.ok(might.length > 0);
  assert.ok(might.every(({ stacks, resolvedAudience }) => stacks === 1 && resolvedAudience.includesSummons));
});

// Unused saved assumptions must not contribute simulated Astral Force.
test('legacy healing-rate assumptions no longer generate Astral Force', () => {
  const result = simulate([{ type: 'wait', durationMs: 6000 }], {
    initialAstralForce: 0,
    selectedTraitIds: [TRAIT.NATURAL_MENDER],
    professionAssumptions: { astralForceHealingEventsPerSecond: 2 }
  });

  assert.equal(result.planningState.profession[STATE.ASTRAL_CLOCK].value, 16);
});

test('Astral Force follows landed direct damage and excludes pet damage', () => {
  const directDamage = simulate(["Viper's Nest", 'Celestial Avatar'], {
    initialAstralForce: 98.5,
    selectedTraitIds: [TRAIT.NATURAL_MENDER]
  });

  // Astral Force becomes available on the second delayed trap pulse.
  assert.equal(directDamage.steps.find(({ skill }) => skill === 'Celestial Avatar').start, 2400);

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

  assert.equal(
    withEclipse.planningState.profession[STATE.ASTRAL_CLOCK].value,
    withoutEclipse.planningState.profession[STATE.ASTRAL_CLOCK].value
  );

  const eclipseDamage = simulate(["Viper's Nest", 'Celestial Avatar'], {
    initialAstralForce: 97,
    selectedTraitIds: [TRAIT.ECLIPSE]
  });

  // Eclipse doubles each landed grant; the second pulse funds entry without a skipped-cast warning.
  assert.deepEqual(eclipseDamage.warnings, []);
  assert.equal(eclipseDamage.steps.find(({ skill }) => skill === 'Celestial Avatar').start, 2400);
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
        skill: rangerCatalog.skills.find((candidate) => candidate.name === name),
        specialization: 'Druid',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
});
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
