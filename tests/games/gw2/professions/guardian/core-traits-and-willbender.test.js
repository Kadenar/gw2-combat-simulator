import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { createGuardianBuildDefaults, migrateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
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

test('a summoned Sword of Justice completes its queued attacks after the player cancels the recovery animation', () => {
  // A completed summon owns its delayed damage and conditions independently of the remaining player animation.
  const run = (cast) =>
    createObservedProfessionSimulator(guardianProfession, { ...config, boons: { quickness: true } })(undefined, [
      cast,
      { type: 'wait', durationMs: 4000 }
    ]);
  const full = run('Sword of Justice');
  const cancelled = run({ name: 'Sword of Justice', interruptMs: 500 });
  assert.deepEqual(cancelled.warnings, []);
  assert.ok(cancelled.totalDamage > 0);
  assert.equal(cancelled.totalDamage, full.totalDamage);
  assert.equal(
    cancelled.events.filter((event) => event.type === 'condition' && event.condition === 'Vulnerability').length,
    full.events.filter((event) => event.type === 'condition' && event.condition === 'Vulnerability').length
  );
});

test('off-hand sword coefficients include the PvE dash damage and marked-target dual strike bonus', () => {
  // The focused formula contract includes the follow-up bonus earned by the same cast's initial hit.
  const advancing = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.ADVANCING_STRIKE);
  const executioner = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.EXECUTIONERS_CALLING);
  assert.equal(
    advancing.effects[0].ticks.reduce((sum, tick) => sum + tick.coefficient, 0),
    3.5
  );
  assert.equal(executioner.effects[1].coefficient, 2.5 * 1.2);
});

test('Guardian player strikes trigger shared player-owned sigils', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
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
  })(undefined, ['True Strike']);

  assert.equal(result.resolvedEvents.find((event) => event.skillName === 'True Strike').actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Air'),
    true
  );
});

// Recharge modifiers and exhausted ammo must affect when the scheduler allows another cast.
test('Guardian recharge applies Alacrity, ammo, and trait reductions', () => {
  const alacrity = createObservedProfessionSimulator(guardianProfession, { ...config, boons: { alacrity: true } })(
    undefined,
    ['Virtue of Justice']
  );
  const virtuous = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]
  })(undefined, ['Virtue of Justice']);
  const ammo = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol'
  })(undefined, ['Hail of Justice', 'Hail of Justice', 'Hail of Justice']);

  assert.equal(alacrity.planningState.cooldowns['Virtue of Justice'].readyAt, 16000);
  assert.equal(virtuous.planningState.cooldowns['Virtue of Justice'].readyAt, 17000);
  assert.equal(ammo.planningState.ammo['Hail of Justice'].charges, 0);
  assert.equal(ammo.steps[2].start, ammo.steps[0].end + 10000);
  assert.deepEqual(ammo.warnings, []);
});

test('Zealous Blade reduces every Greatsword skill recharge by 20%', () => {
  const skillNames = ['Whirling Wrath', 'Leap of Faith', 'Symbol of Resolution', 'Binding Blade'];
  const rechargeDurations = (selectedTraitIds) =>
    skillNames.map((skillName) => {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        primaryWeapon: 'Greatsword',
        selectedTraitIds
      })(undefined, [skillName]);
      const skill = guardianCatalog.skillsByName.get(skillName);
      const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);
      const rechargeStart = skill.rechargeAnchor === 'castStart' ? action.at : action.endsAt;

      return Number((observedRuntime(result).cooldowns.get(skill.id) - rechargeStart).toFixed(3));
    });

  assert.deepEqual(rechargeDurations([]), [8, 10, 12, 25]);
  assert.deepEqual(rechargeDurations([GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE]), [6.4, 8, 9.6, 20]);
});

test('Willbender utilities use the supplied physical skill profiles', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    boons: { quickness: true }
  })(undefined, [
    'Flash Combo',
    "Heaven's Palm",
    'Whirling Light',
    'Crashing Courage',
    { type: 'wait', durationMs: 6000 }
  ]);
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
  // The later utility casts outlast Repose, so planning state must no longer expose its flip.
  assert.equal(result.planningState.profession.availableFlips[GUARDIAN_SKILL_IDS.REPOSE], undefined);
});

test('Flash Combo schedules separate strikes and preserves only landed packets when interrupted', () => {
  // A nonzero start checks the timing anchor; cancellation includes the boundary hit but drops later hits.
  for (const interruptMs of [undefined, 400]) {
    const result = createObservedProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Willbender',
      boons: { quickness: true }
    })(undefined, [
      { type: 'wait', durationMs: 1000 },
      { name: 'Flash Combo', ...(interruptMs == null ? {} : { interruptMs }) },
      { type: 'wait', durationMs: 1000 }
    ]);
    const strikes = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.FLASH_COMBO
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      strikes.map((event) => Math.round(event.at * 1000)),
      interruptMs == null ? [1120, 1280, 1400, 1520, 1600] : [1120, 1280, 1400]
    );
    assert.ok(strikes.every((event) => event.coefficient === 0.9));
  }
});

test('Whirling Light creates four Burning Bolts inside Purging Flames', () => {
  const inFireField = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender'
  })(undefined, ['Purging Flames', 'Whirling Light']);
  const withoutFireField = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender'
  })(undefined, ['Whirling Light']);
  const burningCombos = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Whirling Light' &&
        event.fieldType === 'Fire' &&
        event.finisherType === 'Whirl'
    );

  assert.deepEqual(inFireField.warnings, []);
  assert.equal(burningCombos(inFireField).length, 4);
  assert.equal(new Set(burningCombos(inFireField).map((event) => event.at)).size, 4);
  assert.equal(
    burningCombos(inFireField).every(
      (event) => event.applicationCount === 1 && event.outcome.condition === 'Burning' && event.outcome.duration === 1
    ),
    true
  );
  assert.equal(burningCombos(withoutFireField).length, 0);
});

test('Master of Consecrations extends the usable combo field without creating a duplicate', () => {
  // Finishers between the base and traited expirations must bind only when the duration trait is selected.
  for (const traited of [false, true]) {
    for (const delay of [6000, 8000]) {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        specialization: 'Willbender',
        selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS] : []
      })(undefined, ['Purging Flames', { type: 'wait', durationMs: delay }, 'Whirling Light']);
      const fields = result.events.filter(
        (event) => event.type === 'combo_field' && event.skillId === GUARDIAN_SKILL_IDS.PURGING_FLAMES
      );
      assert.equal(fields.length, 1);
      assert.equal(fields[0].expiresAt - fields[0].at, traited ? 7 : 5);
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'combo' && event.fieldType === 'Fire'),
        traited && delay === 6000
      );
      assert.deepEqual(result.warnings, []);
    }
  }
});

test('Flowing Resolve starts its flame trail before recovery and retains off-target ownership', () => {
  // An early replacement must preserve the pulse that landed during Resolve's trail, but suppress an off-target trail.
  for (const offTarget of [false, true]) {
    const result = createObservedProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
      undefined,
      [
        { type: 'cast', skillId: GUARDIAN_SKILL_IDS.FLOWING_RESOLVE, offTarget },
        { type: 'wait', durationMs: 500 },
        'Rushing Justice',
        { type: 'wait', durationMs: 2000 }
      ]
    );
    const flames = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES
    );
    assert.deepEqual(
      flames.map((event) => event.at),
      offTarget ? [] : [1]
    );
    assert.deepEqual(result.warnings, []);
  }
});

test('Guardian Blasts use centralized field binding and require an active field', () => {
  const inFireField = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Hammer' })(
    undefined,
    ['Purging Flames', 'Mighty Blow']
  );
  const withoutField = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Hammer' })(
    undefined,
    ['Mighty Blow']
  );
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
  const full = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.POWER_FOR_POWER,
      GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
      GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM
    ]
  })(undefined, ['Rushing Justice', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }]);
  const powerFlames = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_FOR_POWER]
  })(undefined, ['Rushing Justice', { type: 'wait', durationMs: 6000 }]);
  const plainFlames = createObservedProfessionSimulator(guardianProfession, willbenderConfig)(undefined, [
    'Rushing Justice',
    { type: 'wait', durationMs: 6000 }
  ]);
  const searingFlames = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SEARING_PACT]
  })(undefined, ['Rushing Justice', { type: 'wait', durationMs: 6000 }]);
  const amplifiedWrath = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH]
  })(undefined, ['Rushing Justice', 'Whirling Wrath']);
  const permeatingWrath = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH]
  })(undefined, ['Rushing Justice', 'Whirling Wrath']);
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
  assert.equal(full.combatState.profession.justiceUntil, 10.04);
  assert.equal(full.combatState.profession.lethalTempoStacks, 5);
  assert.equal(
    full.procSteps.filter(
      (step) =>
        step.skill === 'Restorative Virtues' &&
        step.start / 1000 >= whirlingAction.at &&
        step.start / 1000 <= whirlingAction.endsAt
    ).length,
    3
  );
  assert.equal(
    full.procSteps.some((step) => step.skill === 'Restorative Virtues' && step.detail === '0.28s weapon recharge'),
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
  assert.equal(observedRuntime(full).rechargeProgress.get(rushingJusticeAction.skillId).work, 12);
});

test('Restorative Virtues converts base recharge reduction through Alacrity', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES]
  })(undefined, ['Rushing Justice', 'Whirling Wrath']);
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Whirling Wrath');
  const procs = result.procSteps.filter((step) => step.skill === 'Restorative Virtues');
  const trackedReadyAt = observedRuntime(result).cooldowns.get(action.skillId);

  assert.deepEqual(result.warnings, []);
  assert.ok(procs.length > 0);
  assert.equal(
    procs.every((event) => event.detail === '0.224s weapon recharge'),
    true
  );
  const skill = guardianCatalog.skillsById.get(action.skillId);
  assert.ok(Math.abs(action.endsAt + skill.cooldown / 1.25 - trackedReadyAt - procs.length * 0.224) < 1e-9);
});

test('Willbender chart treats Lethal Tempo events as refreshed stack snapshots', () => {
  const effectPresentations = guardianProfession.ui.effectPresentations({
    specialization: 'Willbender',
    catalog: guardianProfession.catalog
  });
  const series = buildChartSeries(
    {
      rotationEndTime: 3,
      observationEndTime: 3,
      combatEndTime: 3,
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

test('Willbender virtue windows appear as independent timed buff uptimes', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
    undefined,
    ['Rushing Justice', 'Flowing Resolve', { type: 'wait', durationMs: 10000 }]
  );
  const presentations = guardianProfession.ui.effectPresentations({
    specialization: 'Willbender',
    catalog: guardianProfession.catalog
  });
  const summaries = buildChartSeries(result, 1000, presentations).effectSummaries;

  assert.ok(summaries['Rushing Justice'].uptime > 0);
  assert.ok(summaries['Flowing Resolve'].uptime > 0);
  assert.equal(summaries['Crashing Courage'], undefined);
});

test('Willbender flame replacement and Phoenix Protocol follow virtue triggers', () => {
  const willbenderConfig = {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true }
  };
  const overlapping = createObservedProfessionSimulator(guardianProfession, willbenderConfig)(undefined, [
    'Flowing Resolve',
    'Flowing Resolve',
    { type: 'wait', durationMs: 6000 }
  ]);
  const replaced = createObservedProfessionSimulator(guardianProfession, willbenderConfig)(undefined, [
    'Flowing Resolve',
    { type: 'wait', durationMs: 700 },
    'Rushing Justice',
    { type: 'wait', durationMs: 6000 }
  ]);
  const phoenix = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL]
  })(undefined, ['Flowing Resolve', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }]);
  const stackedVirtues = createObservedProfessionSimulator(guardianProfession, willbenderConfig)(undefined, [
    'Flowing Resolve',
    { type: 'wait', durationMs: 1000 },
    'Rushing Justice',
    'Whirling Wrath'
  ]);
  const allVirtues = createObservedProfessionSimulator(guardianProfession, {
    ...willbenderConfig,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES]
  })(undefined, ['Flowing Resolve', 'Crashing Courage', 'Rushing Justice', 'Whirling Wrath']);
  const flameCount = (result, skillId) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Willbender Flames' && event.skillId === skillId
    ).length;

  assert.equal(flameCount(overlapping, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 10);
  assert.equal(overlapping.steps[1].start - overlapping.steps[0].start, 1040);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES), 1);
  assert.equal(flameCount(replaced, GUARDIAN_SKILL_IDS.WILLBENDER_FLAMES_ID_62618), 5);
  // Every live virtue contributes independently to the aggregate trigger counter.
  assert.ok(
    stackedVirtues.combatState.profession.triggeredVirtueEffects >
      stackedVirtues.combatState.profession.justiceActiveBurns
  );
  const allState = allVirtues.combatState.profession;
  const courageBoons = (kind) =>
    allVirtues.events.filter(
      (event) => event.type === 'buff' && event.kind === kind && event.sourceId === GUARDIAN_SKILL_IDS.CRASHING_COURAGE
    );
  assert.ok(courageBoons('aegis').length > 0);
  assert.equal(courageBoons('aegis').length, courageBoons('stability').length);
  assert.equal(allState.triggeredVirtueEffects, allState.justiceActiveBurns * 3);
  assert.ok(allVirtues.procSteps.some((step) => step.skill === 'Restorative Virtues'));
  const phoenixTriggerCount = phoenix.combatState.profession.triggeredVirtueEffects;
  const phoenixActivationAlacrity = phoenix.events.filter(
    (event) =>
      event.type === 'buff' &&
      event.sourceId === GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL &&
      event.name === 'Phoenix Protocol — alacrity'
  );
  const phoenixTriggeredAlacrity = phoenix.events.filter(
    (event) =>
      event.type === 'buff' &&
      event.sourceId === GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL &&
      event.name === 'Phoenix Protocol — alacrity (triggered)'
  );

  assert.deepEqual(
    phoenixActivationAlacrity.map((event) => [
      event.duration,
      event.audience?.recipients,
      event.resolvedAudience.alliedPlayerCount
    ]),
    [[5, 'self', 0]]
  );
  assert.ok(phoenixTriggerCount > 0);
  assert.equal(phoenixTriggeredAlacrity.length, phoenixTriggerCount);
  assert.ok(
    phoenixTriggeredAlacrity.every((event) => event.duration === 1 && event.resolvedAudience.alliedPlayerCount === 0)
  );
  assert.equal(
    phoenixTriggeredAlacrity.every((event) => event.triggeredBy != null && String(event.triggeredBy).length > 0),
    true
  );
});

test('Battle Presence shares Phoenix Protocol alacrity and Inspired Virtue boons reach allies', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true },
    allies: { count: 4 },
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
      GUARDIAN_TRAIT_IDS.BATTLE_PRESENCE,
      GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE
    ]
  })(undefined, ['Flowing Resolve', 'Whirling Wrath', { type: 'wait', durationMs: 6000 }]);
  const alacrity = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL
  );
  assert.ok(alacrity.length > 1);
  assert.ok(alacrity.every((event) => event.audience?.recipients === 'party'));
  assert.ok(alacrity.every((event) => event.resolvedAudience.alliedPlayerCount === 4));

  const inspired = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE
  );
  assert.ok(inspired.length > 0);
  assert.ok(inspired.every((event) => event.resolvedAudience.alliedPlayerCount === 4));
});

test('Holy Reckoning grants Fury on Rushing Justice activation and Might only on virtue triggers', () => {
  // One run covers the activation/trigger boundary and the party audience without depending on a saved rotation.
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    allies: { count: 4 },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.HOLY_RECKONING]
  })(undefined, ['Rushing Justice', 'Whirling Wrath']);
  const activation = result.events.find((event) => event.type === 'buff' && event.kind === 'willbender-justice');
  const triggers = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Justice — Active Burning'
  );
  const fury = result.events.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.HOLY_RECKONING && event.kind === 'fury'
  );
  const might = result.events.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.HOLY_RECKONING && event.kind === 'might'
  );

  assert.deepEqual(
    fury.map((event) => [event.at, event.kind, event.stacks, event.duration, event.audience?.recipients]),
    [[activation.at, 'fury', 1, 3, 'self']]
  );
  assert.equal(might.length, triggers.length);
  assert.deepEqual(
    might.map((event) => [event.at, event.kind, event.stacks, event.duration, event.audience?.recipients]),
    triggers.map((event) => [event.at, 'might', 1, 15, 'party'])
  );
  assert.equal(
    might.every((event) => event.resolvedAudience.alliedPlayerCount === 4),
    true
  );
});

test('Willbender Flames use a separate stochastic weapon-strength activation from their virtue', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    randomness: { mode: 'stochastic', seed: 1 }
  })(undefined, ['Rushing Justice', { type: 'wait', durationMs: 6000 }]);
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
  const symbol = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Greatsword' })(
    undefined,
    ['Symbol of Resolution', { type: 'wait', durationMs: 4000 }]
  );
  const procession = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter'
  })(undefined, ['Procession of Blades', { type: 'wait', durationMs: 5000 }]);

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
  const invalidChain = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Mace' })(
    undefined,
    ['True Strike', 'Faithful Strike']
  );
  const chain = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Mace' })(undefined, [
    'True Strike',
    'Pure Strike',
    'Faithful Strike'
  ]);
  const invalidFlip = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Torch'
  })(undefined, ["Zealot's Fire"]);
  const flip = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Torch'
  })(undefined, ["Zealot's Flame", "Zealot's Fire", { type: 'wait', durationMs: 3000 }]);

  assert.match(invalidChain.warnings.join(' '), /Faithful Strike is unavailable — cast Pure Strike first\./);
  assert.equal(chain.resolvedEvents.filter((event) => event.type === 'damage').length, 3);
  assert.match(invalidFlip.warnings.join(' '), /Zealot's Fire is unavailable — not currently armed\./);
  assert.ok(flip.strikeDamage > 0);
  assert.ok(flip.conditionDamage > 0);
});

test('Guardian greatsword autoattacks restart after another skill', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Greatsword' })(
    undefined,
    ['Strike', 'Whirling Wrath', 'Strike']
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Strike', 'Whirling Wrath', 'Strike']
  );
});

test("Zealot's Flame preserves one-handed roots without exempting its flip", () => {
  const sword = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Torch'
  })(undefined, ['Sword of Wrath', "Zealot's Flame", 'Sword Arc']);
  const reset = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Torch'
  })(undefined, ['Sword of Wrath', "Zealot's Flame", "Zealot's Fire", 'Sword of Wrath']);

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

test("Zealot's Fire locks out Flame until 400 ms or an intervening skill", () => {
  for (const alacrity of [false, true]) {
    for (const between of [[], [{ type: 'wait', durationMs: 50 }], [{ name: 'Symbol of Blades', interruptMs: 320 }]]) {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Torch',
        boons: { quickness: true, alacrity },
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE]
      })(undefined, ["Zealot's Flame", "Zealot's Fire", ...between, "Zealot's Flame", "Zealot's Fire"]);
      const throws = result.steps.filter((step) => step.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FIRE);
      const flames = result.steps.filter((step) => step.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME);
      assert.deepEqual(result.warnings, []);
      assert.equal(throws.length, 2);
      assert.equal(flames[1].start - throws[0].end, between[0]?.name === 'Symbol of Blades' ? 320 : 400);
      assert.equal(throws[1].start, flames[1].end);
    }
  }
});

test("Radiant Fire upgrades Zealot's Flame duration, recharge, and ammo", () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    boons: { quickness: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE]
  })(undefined, [
    "Zealot's Flame",
    "Zealot's Fire",
    "Zealot's Flame",
    "Zealot's Fire",
    "Zealot's Flame",
    "Zealot's Fire",
    { type: 'wait', durationMs: 4000 }
  ]);
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
    [0, 1.08, 12]
  );
  assert.equal(result.planningState.ammo["Zealot's Flame"].maximum, 2);
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
    fireBurns.every((event) => event.stacks === 1 && Math.abs(event.effectiveDuration - 3.6) < 1e-9),
    true
  );
});

test('Guardian damage traits use resolver-time target state', () => {
  const baseline = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Torch'
  })(undefined, ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }]);
  const traited = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Torch',
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.FIERY_WRATH,
      GUARDIAN_TRAIT_IDS.RADIANT_POWER,
      GUARDIAN_TRAIT_IDS.RADIANT_FIRE,
      GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH
    ]
  })(undefined, ["Zealot's Flame", 'True Strike', { type: 'wait', durationMs: 3000 }]);

  assert.ok(traited.strikeDamage > baseline.strikeDamage);
  assert.ok(traited.conditionDamage > baseline.conditionDamage);
});

test('Renewed Focus recharges all three core virtues', () => {
  const result = createObservedProfessionSimulator(guardianProfession, config)(undefined, [
    'Virtue of Justice',
    'Virtue of Resolve',
    'Virtue of Courage',
    'Renewed Focus'
  ]);

  assert.equal(Object.hasOwn(result.planningState.cooldowns, 'Virtue of Justice'), false);
  assert.equal(Object.hasOwn(result.planningState.cooldowns, 'Virtue of Resolve'), false);
  assert.equal(Object.hasOwn(result.planningState.cooldowns, 'Virtue of Courage'), false);
  assert.deepEqual(result.combatState.profession.virtueReadyAt, {
    justice: result.steps.at(-1).end / 1000,
    resolve: result.steps.at(-1).end / 1000,
    courage: result.steps.at(-1).end / 1000
  });
});

test('a supported Guardian weapon skill executes without warnings', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Hammer' })(
    undefined,
    ['Hammer Swing']
  );

  assert.ok(result.totalDamage > 0);
  assert.deepEqual(result.warnings, []);
});

test('Guardian alias input loads canonical Sword of Justice while Shield of Absorption remains a real flip', () => {
  const result = createObservedProfessionSimulator(guardianProfession, config)(undefined, [
    { type: 'cast', skillId: 44846 }
  ]);
  const action = result.events.find((event) => event.type === 'action');

  assert.equal(guardianCatalog.skillsById.has(44846), false);
  assert.equal(action.skillId, GUARDIAN_SKILL_IDS.SWORD_OF_JUSTICE);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION).flipSkillId, 9224);
  assert.equal(guardianCatalog.skillsById.get(9224).flipParentId, GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION);
});

// Minimal shout rotations check loadout persistence, charge scheduling, and party boon duration scaling.
for (const [name, recharge, boons, duration] of [
  ['"Advance!"', 24, ['swiftness', 'aegis'], 20],
  ['"Hold the Line!"', 20, ['protection', 'regeneration'], 6]
]) {
  test(`${name} remains selectable and shares instant boons with a two-charge cooldown`, () => {
    const defaults = createGuardianBuildDefaults();
    const migrated = migrateGuardianBuild({
      ...defaults,
      selectedSkills: { ...defaults.selectedSkills, Utility1: name }
    });
    assert.equal(migrated.selectedSkills.Utility1, name);

    for (const alacrity of [false, true]) {
      const result = createObservedProfessionSimulator(guardianProfession, {
        ...config,
        selectedSkills: [name],
        boons: { alacrity },
        stats: { ...config.stats, concentration: alacrity ? 750 : 0 },
        allies: { count: 4 }
      })(undefined, [name, name, name]);
      const rate = alacrity ? 1.25 : 1;
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(
        result.steps.map((step) => step.start),
        [0, 5000 / rate, (recharge * 1000) / rate]
      );
      assert.ok(result.steps.every((step) => step.end === step.start));
      assert.equal(result.planningState.ammo[name].charges, 0);
      const buffs = result.events.filter(
        (event) => event.type === 'buff' && event.skillName === name && event.at === 0
      );
      assert.deepEqual(
        buffs.map((event) => event.kind),
        boons
      );
      for (const buff of buffs) {
        assert.equal(buff.duration, duration * (alacrity ? 1.5 : 1));
        assert.equal(buff.resolvedAudience.includesSelf, true);
        assert.equal(buff.resolvedAudience.alliedPlayerCount, 4);
      }
    }
  });
}

test('out-of-scope Guardian slot skills are absent and migrate out of saved builds', () => {
  const excludedNames = [
    '"Save Yourselves!"',
    'Signet of Mercy',
    'Merciful Intervention',
    'Wall of Reflection',
    'Contemplation of Purity',
    '"Stand Your Ground!"',
    'Stalwart Stance',
    'Mantra of Lore',
    'Hallowed Ground',
    'Bow of Truth'
  ];

  for (const name of excludedNames) {
    assert.equal(guardianCatalog.skillsByName.has(name), false, name);
  }

  // Valorous Stance has simulated boons, so only its loadout selection is hidden.
  const valorousStance = guardianCatalog.skillsByName.get('Valorous Stance');
  assert.equal(valorousStance.simulatorExcluded, false);
  assert.equal(valorousStance.slotSelectable, false);

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
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Mace' })(
    undefined,
    ['True Strike', { type: 'wait', durationMs: 1000 }, 'Pure Strike', 'Virtue of Justice', 'Virtue of Justice']
  );

  const casts = result.steps.filter((step) => step.skill === 'Virtue of Justice');
  assert.equal(casts[1].start - casts[0].start, 20000);
  assert.ok(result.steps.every((step) => !step.invalid));
  assert.equal(result.planningState.cooldowns['Virtue of Justice'].readyAt, casts[1].end + 20000);
  assert.deepEqual(result.warnings, []);
});
