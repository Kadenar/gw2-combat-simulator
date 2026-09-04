import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createGuardianBuildDefaults, migrateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  },
  target: { armor: 2597 }
};

const PLAYER_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

test('Guardian player strikes trigger shared player-owned sigils', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike'],
    config: {
      ...config,
      stats: {
        ...config.stats,
        precision: 3100
      },
      boons: { fury: true },
      sigilSets: [
        { names: ['Air'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.equal(result.resolvedEvents.find((event) => event.skillName === 'True Strike').actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Air'),
    true
  );
});

test('Guardian timing applies Quickness, Alacrity, ammo, and trait recharge', () => {
  const quick = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike'],
    config: { ...config, boons: { quickness: true } }
  });
  const alacrity = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice'],
    config: { ...config, boons: { alacrity: true } }
  });
  const virtuous = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice'],
    config: {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]
    }
  });
  const ammo = simulateGw2({
    profession: guardianProfession,
    rotation: ['Hail of Justice', 'Hail of Justice', 'Hail of Justice'],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Pistol'
    }
  });

  assert.equal(quick.endState.time, 360);
  assert.equal(alacrity.endState.cooldowns['Virtue of Justice'].readyAt, 16000);
  assert.equal(virtuous.endState.cooldowns['Virtue of Justice'].readyAt, 17000);
  assert.equal(ammo.endState.ammo['Hail of Justice'].charges, 0);
  assert.equal(ammo.steps[2].start, 11680);
  assert.deepEqual(ammo.warnings, []);
});

test('Zealous Blade reduces every Greatsword skill recharge by 20%', () => {
  const skillNames = ['Whirling Wrath', 'Leap of Faith', 'Symbol of Resolution', 'Binding Blade'];
  const rechargeDurations = (selectedTraitIds) =>
    skillNames.map((skillName) => {
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: [skillName],
        config: { ...config, primaryWeapon: 'Greatsword', selectedTraitIds }
      });
      const skill = guardianCatalog.skillsByName.get(skillName);
      const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);
      const rechargeStart = skill.rechargeAnchor === 'castStart' ? action.at : action.endsAt;

      return Number((action.rechargeReadyAt - rechargeStart).toFixed(3));
    });

  assert.deepEqual(rechargeDurations([]), [8, 10, 12, 25]);
  assert.deepEqual(rechargeDurations([GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE]), [6.4, 8, 9.6, 20]);
});

test('Guardian measured Quickness cast times remain exact', () => {
  const quicknessConfig = {
    ...config,
    boons: { quickness: true },
    specialization: 'Luminary',
    primaryWeapon: 'Spear'
  };
  const castDuration = (rotation, skillName) => {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: quicknessConfig
    });
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return Math.round((action.endsAt - action.at) * 1000);
  };

  assert.equal(castDuration(['Helio Rush'], 'Helio Rush'), 440);
  assert.equal(castDuration(['Gleaming Disc'], 'Gleaming Disc'), 560);
  assert.equal(castDuration(['Solar Storm'], 'Solar Storm'), 560);
  assert.equal(castDuration(['Enter Radiant Forge', 'Dazzling Hammer'], 'Dazzling Hammer'), 480);

  const repeated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daybreaking Slash', 'Daybreaking Slash', 'Helio Rush', 'Daybreaking Slash'],
    config: quicknessConfig
  });

  assert.deepEqual(
    repeated.events
      .filter((event) => event.type === 'action' && event.skillName === 'Daybreaking Slash')
      .map((event) => Math.round((event.endsAt - event.at) * 1000)),
    [560, 560, 560]
  );
});

test('Guardian spear packets use measured safe-cancel and lockout timing', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      { name: 'Helio Rush', interruptMs: 280 },
      { name: 'Daybreaking Slash', interruptMs: 400 },
      'Daybreaking Slash'
    ],
    config: {
      ...config,
      boons: { quickness: true },
      specialization: 'Luminary',
      primaryWeapon: 'Spear'
    }
  });
  const actions = result.events.filter((event) => event.type === 'action');
  const damageOffset = (action) => {
    const packet = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.activationId === action.activationId
    );

    return Math.round((packet.at - action.at) * 1000);
  };

  assert.deepEqual(actions.map(damageOffset), [240, 400, 400]);
  assert.equal(Math.round((actions[0].endsAt - actions[0].at) * 1000), 280);
  assert.equal(actions[0].castLockoutEndsAt, undefined);
  assert.equal(Math.round((actions[1].endsAt - actions[1].at) * 1000), 400);
  assert.equal(actions[1].castLockoutEndsAt, undefined);
  assert.equal(Math.round((actions[2].at - actions[1].at) * 1000), 400);
  assert.deepEqual(result.warnings, []);
});

test('Willbender utilities use the supplied physical skill profiles', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Flash Combo',
      "Heaven's Palm",
      'Whirling Light',
      'Crashing Courage',
      { type: 'wait', durationMs: 6000 }
    ],
    config: {
      ...config,
      specialization: 'Willbender',
      boons: { quickness: true }
    }
  });
  const actions = new Map(
    result.events.filter((event) => event.type === 'action').map((event) => [event.skillName, event])
  );
  const strikes = (name) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === name);
  const conditions = (name) =>
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === name);

  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round((actions.get('Flash Combo').endsAt - actions.get('Flash Combo').at) * 1000), 680);
  assert.equal(Math.round((actions.get("Heaven's Palm").endsAt - actions.get("Heaven's Palm").at) * 1000), 960);
  assert.equal(strikes('Flash Combo').length, 5);
  assert.equal(
    strikes('Flash Combo').reduce((sum, event) => sum + event.coefficient, 0),
    4.5
  );
  assert.deepEqual(
    strikes("Heaven's Palm").map((event) => event.coefficient),
    [3]
  );
  assert.equal(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === "Heaven's Palm" && event.controlKind === 'knockback'
    ),
    true
  );
  assert.equal(strikes('Whirling Light').length, 4);
  assert.equal(
    strikes('Whirling Light').every(
      (event) => event.comboFinishers?.[0]?.finisherType === 'Whirl' && event.comboFinishers[0].ownerId === 'guardian'
    ),
    true
  );
  assert.equal(
    conditions('Whirling Light').filter((event) => event.condition === 'Burning' && event.duration === 3).length,
    4
  );
  assert.equal(
    conditions('Whirling Light').filter((event) => event.condition === 'Weakness' && event.duration === 3).length,
    4
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Crashing Courage' &&
        event.kind === 'aegis' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Crashing Courage' &&
        event.kind === 'stability' &&
        event.duration === 4
    ),
    true
  );
  assert.equal(
    strikes('Crashing Courage').find((event) => event.name === 'Crashing Courage — Initial Damage').coefficient,
    1
  );
  assert.equal(
    strikes('Willbender Flames').filter((event) => event.skillId === GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES_COURAGE)
      .length,
    5
  );
  assert.equal(result.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.REPOSE], 6.68);
});

test('Whirling Light creates four Burning Bolts inside Purging Flames', () => {
  const inFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Purging Flames', 'Whirling Light'],
    config: {
      ...config,
      specialization: 'Willbender'
    }
  });
  const withoutFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Light'],
    config: {
      ...config,
      specialization: 'Willbender'
    }
  });
  const burningCombos = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Whirling Light' &&
        event.fieldType === 'Fire' &&
        event.finisherType === 'Whirl'
    );

  assert.deepEqual(inFireField.warnings, []);
  assert.equal(burningCombos(inFireField).length, 1);
  assert.equal(
    burningCombos(inFireField).every(
      (event) => event.applicationCount === 4 && event.outcome.condition === 'Burning' && event.outcome.duration === 1
    ),
    true
  );
  assert.equal(burningCombos(withoutFireField).length, 0);
});

test('Guardian Blasts use centralized field binding and require an active field', () => {
  const inFireField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Purging Flames', 'Mighty Blow'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });
  const withoutField = simulateGw2({
    profession: guardianProfession,
    rotation: ['Mighty Blow'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });
  const finisher = inFireField.events.find(
    (event) => event.type === 'combo_finisher' && event.skillName === 'Mighty Blow'
  );
  const combo = inFireField.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Mighty Blow');

  assert.equal(finisher.finisherType, 'Blast');
  assert.equal(finisher.fieldBinding.kind, 'field-id');
  assert.equal(combo.fieldType, 'Fire');
  assert.equal(combo.finisherType, 'Blast');
  assert.equal(
    inFireField.events.some((event) => event.type === 'blast_combo'),
    false
  );
  assert.equal(
    withoutField.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Mighty Blow'),
    false
  );
});

test('Willbender virtues, flames, and trait triggers use their full mechanics', () => {
  const willbenderConfig = {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  };
  const full = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.POWER_FOR_POWER,
        GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
        GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM
      ]
    }
  });
  const powerFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_FOR_POWER]
    }
  });
  const plainFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: willbenderConfig
  });
  const searingFlames = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SEARING_PACT]
    }
  });
  const amplifiedWrath = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH]
    }
  });
  const permeatingWrath = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
    }
  });
  const flameStrikes = full.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Willbender Flames'
  );
  const whirlingAction = full.events.find((event) => event.type === 'action' && event.skillName === 'Whirling Wrath');
  const firstFlameDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Willbender Flames').damage;

  assert.deepEqual(full.warnings, []);
  assert.equal(
    Math.round(
      (full.events.find((event) => event.type === 'action' && event.skillName === 'Rushing Justice').endsAt -
        full.events.find((event) => event.type === 'action' && event.skillName === 'Rushing Justice').at) *
        1000
    ),
    480
  );
  assert.equal(full.resolvedEvents.find((event) => event.name === 'Rushing Justice — Impact Damage').coefficient, 1.5);
  assert.equal(full.resolvedEvents.find((event) => event.name === 'Rushing Justice — Initial Burning').duration, 4);
  assert.equal(flameStrikes.length, 5);
  assert.equal(
    flameStrikes.every((event) => event.coefficient === 0.22),
    true
  );
  assert.ok(Math.abs(firstFlameDamage(powerFlames) / firstFlameDamage(plainFlames) - 3) < 1e-9);
  assert.equal(
    searingFlames.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Searing Pact' &&
        event.condition === 'Burning' &&
        event.duration === 1
    ).length,
    5
  );
  assert.equal(
    powerFlames.resolvedEvents.some((event) => event.type === 'condition' && event.skillName === 'Willbender Flames'),
    false
  );
  assert.equal(
    full.resolvedEvents.some(
      (event) => event.name === 'Justice — Active Burning' && event.duration === 2 && event.icon
    ),
    true
  );
  assert.equal(
    amplifiedWrath.resolvedEvents.find((event) => event.name === 'Rushing Justice — Initial Burning').effectiveDuration,
    4
  );
  assert.equal(
    amplifiedWrath.resolvedEvents.find((event) => event.name === 'Justice — Active Burning').effectiveDuration,
    2.4
  );
  assert.equal(amplifiedWrath.resolvedEvents.filter((event) => event.name === 'Justice — Active Burning').length, 3);
  assert.equal(permeatingWrath.resolvedEvents.filter((event) => event.name === 'Justice — Active Burning').length, 5);
  assert.equal(full.endState.profession.justiceUntil, 10.04);
  assert.equal(full.endState.profession.lethalTempoStacks, 5);
  assert.equal(
    full.events.filter(
      (event) =>
        event.type === 'proc' &&
        event.name === 'Restorative Virtues' &&
        event.at >= whirlingAction.at &&
        event.at <= whirlingAction.endsAt
    ).length,
    3
  );
  assert.equal(
    full.events.some(
      (event) =>
        event.type === 'proc' && event.name === 'Restorative Virtues' && event.detail === '0.25s weapon recharge'
    ),
    true
  );
  assert.equal(full.events.find((event) => event.type === 'buff' && event.name === 'Lethal Tempo').duration, 4);
  const rushingJusticeAction = full.events.find(
    (event) => event.type === 'action' && event.skillName === 'Rushing Justice'
  );
  const rushingJusticePackets = full.resolvedEvents.filter(
    (event) => event.name === 'Rushing Justice — Impact Damage' || event.name === 'Rushing Justice — Initial Burning'
  );

  assert.deepEqual(
    rushingJusticePackets.map((event) => Math.round((event.at - rushingJusticeAction.at) * 1000)),
    [440, 440]
  );
  assert.equal(rushingJusticeAction.rechargeReadyAt - rushingJusticeAction.at, 12);
});

test('Willbender chart treats Lethal Tempo events as refreshed stack snapshots', () => {
  const effectPresentations = guardianProfession.ui.effectPresentations({
    specialization: 'Willbender',
    catalog: guardianProfession.catalog
  });
  const series = buildChartSeries(
    {
      duration: 3,
      events: [
        {
          type: 'buff',
          at: 0,
          kind: 'lethal-tempo',
          duration: 4,
          stacks: 1,
          resolvedAudience: PLAYER_AUDIENCE
        },
        {
          type: 'buff',
          at: 1,
          kind: 'lethal-tempo',
          duration: 4,
          stacks: 2,
          resolvedAudience: PLAYER_AUDIENCE
        }
      ]
    },
    1000,
    effectPresentations
  );

  assert.deepEqual(
    series.effects['Lethal Tempo'].map((point) => point.v),
    [1, 2, 2, 2]
  );
});

test('Willbender flame replacement and Phoenix Protocol follow virtue triggers', () => {
  const willbenderConfig = {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  };
  const overlapping = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Flowing Resolve', { type: 'wait', durationMs: 6000 }],
    config: willbenderConfig
  });
  const replaced = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Flowing Resolve',
      { type: 'wait', durationMs: 700 },
      'Rushing Justice',
      { type: 'wait', durationMs: 6000 }
    ],
    config: willbenderConfig
  });
  const phoenix = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL]
    }
  });
  const stackedVirtues = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', { type: 'wait', durationMs: 1000 }, 'Rushing Justice', 'Whirling Wrath'],
    config: willbenderConfig
  });
  const allVirtues = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flowing Resolve', 'Crashing Courage', 'Rushing Justice', 'Whirling Wrath'],
    config: {
      ...willbenderConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES]
    }
  });
  const flameCount = (result, skillId) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Willbender Flames' && event.skillId === skillId
    ).length;

  assert.equal(flameCount(overlapping, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 10);
  assert.equal(overlapping.steps[1].start - overlapping.steps[0].start, 1020);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 1);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES_ID_62618), 5);
  assert.deepEqual(
    new Set(
      stackedVirtues.events
        .filter((event) => event.type === 'guardian.willbender-virtue-triggered')
        .map((event) => event.virtue)
    ),
    new Set(['justice', 'resolve'])
  );
  const allVirtueTriggers = allVirtues.events.filter((event) => event.type === 'guardian.willbender-virtue-triggered');

  assert.deepEqual(new Set(allVirtueTriggers.map((event) => event.virtue)), new Set(['justice', 'resolve', 'courage']));
  for (const virtue of ['justice', 'resolve', 'courage']) {
    assert.equal(
      allVirtueTriggers.some((event) => event.virtue === virtue && event.cooldownReduction > 0),
      true
    );
  }

  const courageTriggers = allVirtueTriggers.filter((event) => event.virtue === 'courage');

  for (const kind of ['aegis', 'stability']) {
    assert.equal(
      allVirtues.events.filter(
        (event) =>
          event.type === 'buff' &&
          event.skillName === 'Crashing Courage' &&
          event.kind === kind &&
          String(event.name || '').startsWith('Crashing Courage — Triggered')
      ).length,
      courageTriggers.length
    );
  }

  const phoenixResolveTriggers = phoenix.events.filter(
    (event) => event.type === 'guardian.willbender-virtue-triggered' && event.virtue === 'resolve'
  );
  const phoenixActivationAlacrity = phoenix.events.filter(
    (event) => event.type === 'buff' && event.name === 'Phoenix Protocol — Activation Alacrity'
  );
  const phoenixTriggeredAlacrity = phoenix.events.filter(
    (event) => event.type === 'buff' && event.name === 'Phoenix Protocol — Alacrity'
  );

  assert.deepEqual(
    phoenixActivationAlacrity.map((event) => [
      event.duration,
      event.audience?.recipients,
      event.resolvedAudience.alliedPlayerCount
    ]),
    [[5, 'self', 0]]
  );
  assert.equal(phoenixResolveTriggers.length > 0, true);
  assert.equal(phoenixTriggeredAlacrity.length, phoenixResolveTriggers.length);
  assert.deepEqual(
    phoenixTriggeredAlacrity.map((event) => [event.at, event.duration, event.resolvedAudience.alliedPlayerCount]),
    phoenixResolveTriggers.map((event) => [event.at, 1, 0])
  );
  assert.equal(
    phoenixTriggeredAlacrity.every((event) => event.triggeredBy != null && String(event.triggeredBy).length > 0),
    true
  );
});

test('Willbender Flames use a separate stochastic weapon-strength activation from their virtue', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Rushing Justice', { type: 'wait', durationMs: 6000 }],
    config: {
      ...config,
      specialization: 'Willbender',
      randomness: { mode: 'stochastic', seed: 1 }
    }
  });
  const virtue = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Rushing Justice'
  );
  const flames = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Willbender Flames'
  );

  assert.equal(virtue.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.equal(flames.length, 5);
  assert.notEqual(flames[0].activationId, virtue.activationId);
  assert.equal(new Set(flames.map((event) => event.activationId)).size, 1);
  assert.equal(
    flames.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'),
    true
  );
});

test('Guardian symbols and persistent attacks resolve after their casts', () => {
  const symbol = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 4000 }],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });
  const procession = simulateGw2({
    profession: guardianProfession,
    rotation: ['Procession of Blades', { type: 'wait', durationMs: 5000 }],
    config: {
      ...config,
      specialization: 'Dragonhunter'
    }
  });

  assert.equal(
    symbol.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Resolution')
      .length,
    5
  );
  assert.equal(
    procession.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Procession of Blades')
      .length,
    10
  );
});

test('Guardian autoattack chains and torch flips enforce sequence state', () => {
  const invalidChain = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike', 'Faithful Strike'],
    config: { ...config, primaryWeapon: 'Mace' }
  });
  const chain = simulateGw2({
    profession: guardianProfession,
    rotation: ['True Strike', 'Pure Strike', 'Faithful Strike'],
    config: { ...config, primaryWeapon: 'Mace' }
  });
  const invalidFlip = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Fire"],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }
  });
  const flip = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", "Zealot's Fire", { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }
  });

  assert.match(invalidChain.warnings.join(' '), /Faithful Strike is unavailable — cast Pure Strike first\./);
  assert.equal(chain.resolvedEvents.filter((event) => event.type === 'damage').length, 3);
  assert.match(invalidFlip.warnings.join(' '), /Zealot's Fire is unavailable — not currently armed\./);
  assert.ok(flip.strikeDamage > 0);
  assert.ok(flip.conditionDamage > 0);
});

test('Guardian greatsword autoattacks restart after another skill', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Strike', 'Whirling Wrath', 'Strike'],
    config: { ...config, primaryWeapon: 'Greatsword' }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Strike', 'Whirling Wrath', 'Strike']
  );
});

test("Zealot's Flame preserves one-handed roots without exempting its flip", () => {
  const sword = simulateGw2({
    profession: guardianProfession,
    rotation: ['Sword of Wrath', "Zealot's Flame", 'Sword Arc'],
    config: { ...config, primaryWeapon: 'Sword', secondaryWeapon: 'Torch' }
  });
  const reset = simulateGw2({
    profession: guardianProfession,
    rotation: ['Sword of Wrath', "Zealot's Flame", "Zealot's Fire", 'Sword of Wrath'],
    config: { ...config, primaryWeapon: 'Sword', secondaryWeapon: 'Torch' }
  });

  assert.deepEqual(sword.warnings, []);
  assert.deepEqual(
    sword.steps.map((step) => step.skill),
    ['Sword of Wrath', "Zealot's Flame", 'Sword Arc']
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.map((step) => step.skill),
    ['Sword of Wrath', "Zealot's Flame", "Zealot's Fire", 'Sword of Wrath']
  );
});

test("Radiant Fire upgrades Zealot's Flame duration, recharge, and ammo", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Zealot's Flame",
      "Zealot's Fire",
      "Zealot's Flame",
      "Zealot's Fire",
      "Zealot's Flame",
      "Zealot's Fire",
      { type: 'wait', durationMs: 4000 }
    ],
    config: {
      ...config,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      boons: { quickness: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE]
    }
  });
  const flameActions = result.events.filter((event) => event.type === 'action' && event.skillName === "Zealot's Flame");
  const flameBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Zealot's Flame" && event.condition === 'Burning'
  );
  const fireBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === "Zealot's Fire" && event.condition === 'Burning'
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    flameActions.map((event) => event.at),
    [0, 0.68, 12]
  );
  assert.equal(result.endState.ammo["Zealot's Flame"].maximum, 2);
  assert.equal(flameBurns.length, 12);
  assert.deepEqual(
    flameBurns.filter((event) => event.activationId === flameActions[0].activationId).map((event) => event.at),
    [0, 1, 2, 3]
  );
  assert.equal(
    flameBurns.every((event) => Math.abs(event.effectiveDuration - 5.4) < 1e-9),
    true
  );
  assert.equal(
    fireBurns.every((event) => event.stacks === 3 && Math.abs(event.effectiveDuration - 3.6) < 1e-9),
    true
  );
});

test('Guardian damage traits use resolver-time target state', () => {
  const baseline = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Mace',
      secondaryWeapon: 'Torch'
    }
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      primaryWeapon: 'Mace',
      secondaryWeapon: 'Torch',
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FIERY_WRATH,
        GUARDIAN_TRAIT_IDS.RADIANT_POWER,
        GUARDIAN_TRAIT_IDS.RADIANT_FIRE,
        GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH
      ]
    }
  });

  assert.ok(traited.strikeDamage > baseline.strikeDamage);
  assert.ok(traited.conditionDamage > baseline.conditionDamage);
});

test('Renewed Focus recharges all three core virtues', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Virtue of Justice', 'Virtue of Resolve', 'Virtue of Courage', 'Renewed Focus'],
    config
  });

  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Justice'), false);
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Resolve'), false);
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Virtue of Courage'), false);
  assert.deepEqual(result.endState.profession.virtueReadyAt, {
    justice: 2,
    resolve: 2,
    courage: 2
  });
});

test('a supported Guardian weapon skill executes without warnings', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Hammer Swing'],
    config: { ...config, primaryWeapon: 'Hammer' }
  });

  assert.ok(result.totalDamage > 0);
  assert.deepEqual(result.warnings, []);
});

test('Guardian alias input loads canonical Sword of Justice while Shield of Absorption remains a real flip', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [{ type: 'cast', skillId: 44846 }],
    config
  });
  const action = result.events.find((event) => event.type === 'action');

  assert.equal(guardianCatalog.skillsById.has(44846), false);
  assert.equal(action.skillId, GUARDIAN_SKILL_IDS.SWORD_OF_JUSTICE);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION).flipSkillId, 9224);
  assert.equal(guardianCatalog.skillsById.get(9224).flipParentId, GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION);
});

test('non-DPS Guardian slot skills are excluded from the simulator surface', () => {
  const excludedNames = [
    '"Advance!"',
    '"Save Yourselves!"',
    '"Hold the Line!"',
    'Signet of Mercy',
    'Merciful Intervention',
    'Wall of Reflection',
    'Contemplation of Purity',
    '"Stand Your Ground!"',
    'Valorous Stance',
    'Stalwart Stance',
    'Mantra of Lore',
    'Hallowed Ground',
    'Bow of Truth'
  ];

  for (const name of excludedNames) {
    assert.equal(guardianCatalog.skillsByName.get(name)?.simulatorExcluded, true, name);
  }

  const migrated = migrateGuardianBuild({
    ...createGuardianBuildDefaults(),
    selectedSkills: {
      ...createGuardianBuildDefaults().selectedSkills,
      Utility1: 'Contemplation of Purity'
    }
  });

  assert.notEqual(migrated.selectedSkills.Utility1, 'Contemplation of Purity');
});

test('Guardian results advance to cooldown expiry before recasting', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'True Strike',
      { type: 'wait', durationMs: 1000 },
      'Pure Strike',
      'Virtue of Justice',
      'Virtue of Justice'
    ],
    config: { ...config, primaryWeapon: 'Mace' }
  });

  assert.deepEqual(
    result.steps.map((step) => ({
      ri: step.ri,
      skill: step.skill,
      start: step.start,
      end: step.end,
      invalid: Boolean(step.invalid)
    })),
    [
      { ri: 0, skill: 'True Strike', start: 0, end: 500, invalid: false },
      { ri: 1, skill: 'Wait', start: 500, end: 1500, invalid: false },
      { ri: 2, skill: 'Pure Strike', start: 1500, end: 2000, invalid: false },
      {
        ri: 3,
        skill: 'Virtue of Justice',
        start: 2000,
        end: 2000,
        invalid: false
      },
      {
        ri: 4,
        skill: 'Virtue of Justice',
        start: 22000,
        end: 22000,
        invalid: false
      }
    ]
  );
  assert.equal(result.endState.cooldowns['Virtue of Justice'].readyAt, 42000);
  assert.deepEqual(result.warnings, []);
});
