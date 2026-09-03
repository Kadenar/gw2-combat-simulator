import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticTomeStowTimelineMarkers, timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
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

test('Firebrand tomes consume shared pages and execute tome damage', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 4: Scorched Aftermath',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 6000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.tomePages, 4);
  assert.equal(result.endState.profession.ashesCharges, 0);
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Burning'));
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Bleeding'));
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Ashes of the Just'),
    true
  );
});

test('Firebrand tome chapters use their reference packets and cooldowns', () => {
  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    maximumTomePages: 8,
    initialTomePages: 8
  };
  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Chapter 3: Heated Rebuke',
      'Chapter 4: Scorched Aftermath',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const coefficients = (skillId) =>
    justice.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === skillId)
      .reduce((sum, event) => sum + event.coefficient, 0);
  const condition = (skillId, name) =>
    justice.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === skillId && event.condition === name
    );

  assert.equal(coefficients(GUARDIAN_SKILL_IDS.SEARING_SPELL), 0.95);
  assert.equal(coefficients(GUARDIAN_SKILL_IDS.IGNITING_BURST), 0.55);
  assert.equal(coefficients(GUARDIAN_SKILL_IDS.HEATED_REBUKE), 0.45);
  assert.equal(Number(coefficients(GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH).toFixed(6)), 3.2);
  assert.deepEqual(
    justice.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH)
      .map((event) => event.coefficient),
    [0.64, 0.64, 0.64, 0.64, 0.64]
  );
  assert.deepEqual(
    {
      stacks: condition(GUARDIAN_SKILL_IDS.SEARING_SPELL, 'Vulnerability').stacks,
      duration: condition(GUARDIAN_SKILL_IDS.SEARING_SPELL, 'Vulnerability').duration
    },
    { stacks: 2, duration: 10 }
  );
  assert.equal(condition(GUARDIAN_SKILL_IDS.IGNITING_BURST, 'Weakness').duration, 4);
  assert.equal(
    justice.events.find((event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.HEATED_REBUKE)
      .controlKind,
    'pull'
  );
  assert.equal(
    justice.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillId === GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH &&
        event.condition === 'Burning'
    ).length,
    5
  );
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH).comboFields[0].fieldType, 'Fire');

  const resolve = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      'Chapter 1: Desert Bloom',
      'Chapter 2: Radiant Recovery',
      'Chapter 3: Azure Sun',
      'Chapter 4: Shining River',
      'Epilogue: Eternal Oasis',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const resolveBuffs = (skillId, kind) =>
    resolve.events.filter((event) => event.type === 'buff' && event.skillId === skillId && event.kind === kind);

  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'vigor')[0].duration, 5);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'regeneration')[0].duration, 6);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.AZURE_SUN, 'swiftness')[0].duration, 5);
  assert.equal(resolveBuffs(GUARDIAN_SKILL_IDS.SHINING_RIVER, 'swiftness').length, 5);

  const courage = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Courage',
      'Chapter 1: Unflinching Charge',
      'Chapter 2: Daring Challenge',
      'Chapter 3: Valiant Bulwark',
      'Chapter 4: Stalwart Stand',
      'Epilogue: Unbroken Lines',
      { type: 'wait', durationMs: 4000 }
    ],
    config: firebrandConfig
  });
  const courageBuffs = (skillId, kind) =>
    courage.events.filter((event) => event.type === 'buff' && event.skillId === skillId && event.kind === kind);

  assert.equal(
    courage.events
      .filter((event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.DARING_CHALLENGE)
      .reduce((sum, event) => sum + event.coefficient, 0),
    1.4
  );
  assert.deepEqual(
    courage.events
      .filter((event) => event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.DARING_CHALLENGE)
      .map((event) => [event.controlKind, event.duration]),
    [['taunt', 2]]
  );
  assert.equal(courageBuffs(GUARDIAN_SKILL_IDS.STALWART_STAND, 'resistance').length, 4);
  assert.deepEqual(
    ['protection', 'stability', 'aegis', 'toughness'].map((kind) => [
      kind,
      courageBuffs(GUARDIAN_SKILL_IDS.UNBROKEN_LINES, kind)[0].duration
    ]),
    [
      ['protection', 5],
      ['stability', 5],
      ['aegis', 4],
      ['toughness', 5]
    ]
  );
  assert.equal(courageBuffs(GUARDIAN_SKILL_IDS.UNBROKEN_LINES, 'toughness')[0].stacks, 300);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.VALIANT_BULWARK).cooldown, 15);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.STALWART_STAND).cooldown, 20);
  assert.equal(guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.UNBROKEN_LINES).cooldown, 25);
});

test('Ashes of the Just grants party charges using Firebrand condition stats', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 3000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE],
      allies: { count: 4, strikesPerSecond: 1 }
    }
  });
  const ashesBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'ashes-of-the-just');
  const might = result.events.find(
    (event) => event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST && event.kind === 'might'
  );
  const allyBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && event.triggeredByAlly
  );
  const personalBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.triggeredByAlly
  );

  assert.deepEqual(
    {
      stacks: ashesBuff.stacks,
      duration: ashesBuff.duration,
      recipients: ashesBuff.resolvedAudience.recipientCount
    },
    { stacks: 2, duration: 10, recipients: 5 }
  );
  assert.deepEqual(
    {
      stacks: might.stacks,
      duration: might.duration,
      recipients: might.resolvedAudience.recipientCount
    },
    { stacks: 8, duration: 10, recipients: 5 }
  );
  assert.equal(allyBurns.length, 8);
  assert.equal(personalBurns.length, 1);
  assert.ok(allyBurns.every((event) => event.duration === 2 && event.effectiveDuration === 2.4));
  assert.ok(personalBurns.every((event) => event.duration === 2 && event.effectiveDuration === 2.4));
  assert.ok(result.conditionDamage > 0);
});

test('Ashes of the Just cannot trigger before its application event', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'True Strike',
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'Symbol of Faith',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });
  const ashesAppliedAt = result.events.find(
    (event) => event.type === 'guardian.tome-page-used' && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST
  ).at;
  const ashes = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

  assert.ok(ashes.length > 0);
  assert.ok(ashes.every((event) => event.at >= ashesAppliedAt));
});

test('later tome pages do not restore consumed Ashes charges', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Chapter 2: Igniting Burst',
      'Stow Tome',
      'True Strike',
      'Pure Strike',
      'Faithful Strike',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      allies: { count: 0, strikesPerSecond: 1 }
    }
  });
  const personalBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.triggeredByAlly
  );

  assert.equal(personalBurns.length, 2);
  assert.equal(result.endState.profession.ashesCharges, 0);
});

test('Firebrand page exhaustion stows the tome and pages regenerate', () => {
  const exhausted = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      'Epilogue: Eternal Oasis',
      'Chapter 1: Desert Bloom',
      { type: 'wait', durationMs: 8000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 2
    }
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS, GUARDIAN_TRAIT_IDS.LOREMASTER]
    }
  });

  assert.match(exhausted.warnings.join(' '), /Chapter 1: Desert Bloom is unavailable/);
  assert.equal(exhausted.endState.profession.activeTome, '');
  assert.equal(exhausted.endState.profession.tomePages, 1);
  assert.equal(traited.endState.profession.maximumTomePages, 8);
  assert.equal(traited.endState.profession.tomePages, 8);
  assert.equal(traited.endState.profession.tomePageInterval, 5);
});

test('Firebrand page exhaustion injects a timeline stow and closes its lane', () => {
  const rotation = ['Tome of Resolve', 'Epilogue: Eternal Oasis', 'True Strike'];
  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    primaryWeapon: 'Mace',
    initialTomePages: 2
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: firebrandConfig
  });

  assert.deepEqual(automaticTomeStowTimelineMarkers(result, rotation.length), [
    {
      insertionIndex: 2,
      skill: 'Stow Tome',
      start: 200,
      detail: 'page exhaustion'
    }
  ]);
  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rows = timelineWeaponRows(rotation, {
    weaponLineEndIndexes: new Set(
      automaticTomeStowTimelineMarkers(result, rotation.length).map((marker) => marker.insertionIndex)
    ),
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Resolve', null]
  );
});

test('Firebrand tome page cost waits for a regenerating page', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      // Epilogue: Eternal Oasis costs two pages; starting at one page it must
      // wait for the next scheduled page rather than being discarded.
      'Epilogue: Eternal Oasis'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 1
    }
  });

  const epilogue = result.steps.find((step) => step.skill === 'Epilogue: Eternal Oasis');

  assert.deepEqual(result.warnings, []);
  assert.ok(epilogue && !epilogue.invalid);
  // The first page lands at the 8s interval, so the cast is delayed to it.
  assert.ok(epilogue.start >= 8000);
  assert.equal(result.endState.profession.activeTome, '');
});

test('Firebrand axe skills and Unrelenting Criticism use reference packets', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Core Cleave',
      'Bleeding Edge',
      'Searing Slash',
      'Symbol of Vengeance',
      'Blazing Edge',
      { type: 'wait', durationMs: 5000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Axe',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM]
    }
  });
  const packet = (skillId) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);
  const coefficient = (skillId) => packet(skillId).reduce((sum, event) => sum + event.coefficient, 0);

  assert.deepEqual(
    [
      [packet(GUARDIAN_SKILL_IDS.CORE_CLEAVE).length, coefficient(GUARDIAN_SKILL_IDS.CORE_CLEAVE)],
      [packet(GUARDIAN_SKILL_IDS.BLEEDING_EDGE).length, coefficient(GUARDIAN_SKILL_IDS.BLEEDING_EDGE)],
      [packet(GUARDIAN_SKILL_IDS.SEARING_SLASH).length, coefficient(GUARDIAN_SKILL_IDS.SEARING_SLASH)],
      [packet(GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE).length, coefficient(GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE)],
      [packet(GUARDIAN_SKILL_IDS.BLAZING_EDGE).length, coefficient(GUARDIAN_SKILL_IDS.BLAZING_EDGE)]
    ],
    [
      [2, 0.72],
      [2, 0.72],
      [2, 2.4],
      [5, 3],
      [1, 0.8]
    ]
  );
  const criticism = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Unrelenting Criticism — Bleeding'
  );

  assert.equal(criticism.length, 12);
  assert.ok(criticism.every((event) => event.duration === 4.5));
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE && event.kind === 'fury'
    ).length,
    5
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' &&
        event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_VENGEANCE &&
        event.controlKind === 'daze'
    ),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'control' && event.skillId === GUARDIAN_SKILL_IDS.BLAZING_EDGE && event.controlKind === 'pull'
    ),
    true
  );
});

test('Condition Firebrand uses configured cast and strike packet timings', () => {
  const profile = (result, skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      packets: result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === skillName)
        .map((event) => Math.round((event.at - action.at) * 1000))
    };
  };

  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    boons: { quickness: true }
  };
  const axe = simulateGw2({
    profession: guardianProfession,
    rotation: ['Core Cleave', 'Bleeding Edge', 'Searing Slash'],
    config: { ...firebrandConfig, primaryWeapon: 'Axe' }
  });
  const pistol = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Hail of Justice',
      'Peacekeeper',
      'Symbol of Ignition',
      'Through the Heart',
      { type: 'wait', durationMs: 3000 }
    ],
    config: {
      ...firebrandConfig,
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol'
    }
  });
  const tome = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Purging Flames',
      'Tome of Justice',
      'Chapter 4: Scorched Aftermath',
      { type: 'wait', durationMs: 5000 }
    ],
    config: firebrandConfig
  });
  const cleansing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Cleansing Flame'],
    config: {
      ...firebrandConfig,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch'
    }
  });

  assert.deepEqual(profile(axe, 'Core Cleave'), {
    cast: 640,
    packets: [360, 600]
  });
  assert.deepEqual(profile(axe, 'Bleeding Edge'), {
    cast: 680,
    packets: [480, 640]
  });
  assert.deepEqual(profile(axe, 'Searing Slash'), {
    cast: 640,
    packets: [480, 640]
  });
  assert.deepEqual(profile(pistol, 'Hail of Justice'), {
    cast: 1120,
    packets: [280, 440, 640, 800, 960]
  });
  assert.deepEqual(profile(pistol, 'Peacekeeper'), {
    cast: 1040,
    packets: [280, 480, 640, 800, 960]
  });
  assert.deepEqual(profile(pistol, 'Symbol of Ignition'), {
    cast: 360,
    packets: [280, 960, 1640, 2320, 3000]
  });
  assert.deepEqual(profile(pistol, 'Through the Heart'), {
    cast: 600,
    packets: [360]
  });
  assert.deepEqual(profile(tome, 'Purging Flames'), {
    cast: 320,
    packets: [320, 1320, 2320, 3320, 4320, 5320]
  });
  assert.deepEqual(profile(tome, 'Chapter 4: Scorched Aftermath'), {
    cast: 920,
    packets: [440, 1440, 2440, 3440, 4440]
  });
  assert.deepEqual(profile(cleansing, 'Cleansing Flame'), {
    cast: 2600,
    packets: [260, 520, 780, 1040, 1300, 1560, 1820, 2080, 2340, 2600]
  });
  assert.equal(
    cleansing.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Cleansing Flame').length,
    10
  );
  assert.ok(
    Math.abs(
      cleansing.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === 'Cleansing Flame')
        .reduce((sum, event) => sum + event.coefficient, 0) - 4
    ) < 1e-9
  );
  assert.equal(
    cleansing.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Cleansing Flame' &&
        event.condition === 'Burning' &&
        event.stacks === 2 &&
        event.duration === 4 &&
        Math.abs(
          event.at -
            cleansing.events.find(
              (candidate) => candidate.type === 'action' && candidate.skillName === 'Cleansing Flame'
            ).endsAt
        ) < 1e-9
    ),
    true
  );
});

test('Guardian scepter skills use reference cast times and Symbol of Punishment packets', () => {
  const scepterConfig = {
    ...config,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    boons: { quickness: true }
  };
  const baseline = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', 'Orb of Wrath', { type: 'wait', durationMs: 5000 }],
    config: scepterConfig
  });
  const writ = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', { type: 'wait', durationMs: 7000 }],
    config: {
      ...scepterConfig,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE]
    }
  });
  const recharge = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Punishment', 'Symbol of Punishment'],
    config: scepterConfig
  });
  const symbolAction = baseline.events.find(
    (event) => event.type === 'action' && event.skillName === 'Symbol of Punishment'
  );
  const orbAction = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Orb of Wrath');
  const symbolDamage = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Symbol of Punishment');
  const baseDamage = symbolDamage(baseline);
  const writDamage = symbolDamage(writ);
  const baseBreakdown = baseline.breakdown.find((entry) => entry.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT);
  const writBreakdown = writ.breakdown.find((entry) => entry.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT);
  const symbolMight = baseline.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Symbol of Punishment' && event.kind === 'might'
  );
  const symbolField = baseline.events.find(
    (event) => event.type === 'combo_field' && event.skillName === 'Symbol of Punishment'
  );

  assert.equal(Math.round((symbolAction.endsAt - symbolAction.at) * 1000), 320);
  assert.equal(Math.round((orbAction.endsAt - orbAction.at) * 1000), 440);
  assert.equal(
    baseline.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Orb of Wrath').coefficient,
    0.6
  );
  assert.deepEqual(
    baseDamage.map((event) => Math.round((event.at - symbolAction.at) * 1000)),
    [240, 760, 1240, 1240, 1760, 2240, 2240, 2760, 3240, 3240, 3760, 4240]
  );
  assert.ok(Math.abs(baseDamage.reduce((sum, event) => sum + event.coefficient, 0) - 3.6) < 1e-9);
  assert.equal(baseBreakdown.hits, 12);
  assert.equal(writDamage.length, 18);
  assert.ok(Math.abs(writDamage.reduce((sum, event) => sum + event.coefficient, 0) - 5.4) < 1e-9);
  assert.equal(writBreakdown.hits, 18);
  assert.equal(symbolMight.length, 5);
  assert.equal(
    symbolMight.every((event) => event.stacks === 4 && event.duration === 5),
    true
  );
  assert.equal(symbolField.fieldType, 'Light');
  assert.equal(Math.round((symbolField.at - symbolAction.at) * 1000), 240);
  assert.equal(symbolField.expiresAt - symbolField.at, 4);
  assert.equal(
    writ.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Symbol of Punishment' && event.kind === 'might'
    ).length,
    7
  );
  assert.deepEqual(
    writ.events
      .filter((event) => event.type === 'combo_field' && event.skillName === 'Symbol of Punishment')
      .map((event) => [event.at, event.expiresAt]),
    [
      [0.24, 4.24],
      [4.24, 6.24]
    ]
  );
  assert.deepEqual(
    recharge.events
      .filter((event) => event.type === 'action' && event.skillName === 'Symbol of Punishment')
      .map((event) => event.at),
    [0, 10.32]
  );
});

test('Guardian pistol conditions and Symbol of Ignition use full packets', () => {
  const pistolConfig = {
    ...config,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol',
    boons: { quickness: true }
  };
  const packets = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Hail of Justice',
      'Hail of Justice',
      'Peacekeeper',
      'Through the Heart',
      'Jurisdiction',
      { type: 'wait', durationMs: 8000 }
    ],
    config: pistolConfig
  });
  const ignition = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Ignition', 'Peacekeeper', { type: 'wait', durationMs: 5000 }],
    config: pistolConfig
  });
  const conditions = (result, skillName, condition) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === condition
    );

  assert.deepEqual(packets.warnings, []);
  assert.deepEqual(
    packets.events
      .filter((event) => event.type === 'action' && event.skillName === 'Hail of Justice')
      .map((event) => event.at),
    [0, 2.12]
  );
  assert.equal(conditions(packets, 'Hail of Justice', 'Bleeding').length, 10);
  assert.equal(conditions(packets, 'Hail of Justice', 'Crippled').length, 10);
  assert.equal(
    conditions(packets, 'Hail of Justice', 'Crippled').every(
      (event) => event.duration === 1 && event.projectile === true
    ),
    true
  );
  assert.equal(conditions(packets, 'Peacekeeper', 'Burning').length, 5);
  assert.equal(
    conditions(packets, 'Peacekeeper', 'Burning').every((event) => event.duration === 1.5),
    true
  );
  assert.equal(conditions(packets, 'Through the Heart', 'Bleeding').length, 1);
  assert.equal(conditions(packets, 'Through the Heart', 'Bleeding')[0].duration, 8);
  assert.equal(
    conditions(packets, 'Jurisdiction', 'Burning').some((event) => event.stacks === 5 && event.duration === 6),
    true
  );
  assert.equal(
    packets.events.some(
      (event) => event.type === 'control' && event.skillName === 'Jurisdiction' && event.controlKind === 'stun'
    ),
    true
  );

  const symbolDamage = ignition.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Symbol of Ignition'
  );
  const symbolMight = ignition.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Symbol of Ignition' && event.kind === 'might'
  );
  const ignitions = conditions(ignition, 'Symbol of Ignition', 'Burning');
  const symbolAction = ignition.events.find(
    (event) => event.type === 'action' && event.skillName === 'Symbol of Ignition'
  );

  assert.equal(symbolDamage.length, 5);
  assert.equal(
    symbolDamage.reduce((sum, event) => sum + event.coefficient, 0),
    2
  );
  assert.equal(symbolMight.length, 5);
  assert.equal(
    symbolMight.every((event) => event.duration === 5),
    true
  );
  assert.equal(ignitions.length, 3);
  assert.equal(
    ignitions.every((event) => event.duration === 1),
    true
  );
  assert.equal(symbolAction.comboFields[0].fieldType, 'Light');
  assert.equal(symbolAction.comboFields[0].duration, 4);
});

test('Peacekeeper begins its six-second recharge when its cast starts', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Peacekeeper', 'Peacekeeper'],
    config: {
      ...config,
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol',
      boons: { quickness: true, alacrity: true }
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Peacekeeper')
      .map((event) => event.at),
    [0, 4.8]
  );
});

test('Signet of Wrath loses its passive condition damage while recharging', () => {
  const throughDamage = (result) =>
    result.breakdown.find((entry) => entry.name.startsWith('Through the Heart') && entry.conditionDamage > 0)
      .conditionDamage;
  const baseConfig = {
    ...config,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  };
  const withoutSignet = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: baseConfig
  });
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });
  const recharging = simulateGw2({
    profession: guardianProfession,
    rotation: ['Signet of Wrath', 'Through the Heart', 'Signet of Wrath', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });
  const signetConditions = recharging.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Signet of Wrath'
  );

  assert.ok(throughDamage(passive) > throughDamage(withoutSignet));
  assert.ok(Math.abs(throughDamage(recharging) - throughDamage(withoutSignet)) < 1e-9);
  assert.deepEqual(
    recharging.events
      .filter((event) => event.type === 'action' && event.skillName === 'Signet of Wrath')
      .map((event) => event.at),
    [0, 19]
  );
  assert.equal(
    signetConditions.some((event) => event.condition === 'Burning' && event.stacks === 3 && event.duration === 5),
    true
  );
  assert.equal(
    signetConditions.some((event) => event.condition === 'Immobilized' && event.duration === 6),
    true
  );
});

test('Firebrand mantras resolve normal and final charges with full recharge', () => {
  const flame = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge', { type: 'wait', durationMs: 15800 }, 'Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS],
      boons: { alacrity: true }
    }
  });
  const flameConditions = flame.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.condition === 'Burning' &&
      ['Flame Rush', 'Flame Surge'].includes(event.skillName)
  );

  assert.deepEqual(
    flame.steps.filter((step) => ['Flame Rush', 'Flame Surge'].includes(step.skill)).map((step) => step.start),
    [0, 1000, 2000, 18000]
  );
  assert.deepEqual(
    flameConditions.map((event) => [event.skillName, event.stacks, event.duration]),
    [
      ['Flame Rush', 1, 12],
      ['Flame Rush', 1, 12],
      ['Flame Surge', 3, 12],
      ['Flame Rush', 1, 12]
    ]
  );
  assert.equal(flame.procSteps.filter((step) => step.skill === 'Weighty Terms').length, 1);

  const support = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Restoring Reprieve',
      'Restoring Reprieve',
      'Rejuvenating Respite',
      'Potent Haste',
      'Potent Haste',
      'Overwhelming Celerity',
      'Portent of Freedom',
      'Portent of Freedom',
      'Unhindered Delivery'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Solace', 'Mantra of Potence', 'Mantra of Liberation'],
      allies: { count: 4, strikesPerSecond: 1 }
    }
  });
  const boonsFor = (skillName) =>
    support.events
      .filter((event) => event.type === 'buff' && event.skillName === skillName)
      .map((event) => [event.kind, event.stacks, event.duration]);

  assert.deepEqual(boonsFor('Rejuvenating Respite'), [
    ['aegis', 1, 2],
    ['protection', 1, 3],
    ['resolution', 1, 3]
  ]);
  assert.deepEqual(boonsFor('Overwhelming Celerity'), [
    ['quickness', 1, 5],
    ['might', 8, 10]
  ]);
  assert.deepEqual(boonsFor('Unhindered Delivery'), [
    ['resolution', 1, 8],
    ['stability', 5, 8],
    ['swiftness', 1, 5]
  ]);
  assert.deepEqual(support.warnings, []);
});

test('Firebrand mantra parents and charged skills use distinct cast states', () => {
  const solace = guardianCatalog.skillsByName.get('Mantra of Solace');
  const reprieve = guardianCatalog.skillsByName.get('Restoring Reprieve');
  const respite = guardianCatalog.skillsByName.get('Rejuvenating Respite');
  const flame = guardianCatalog.skillsByName.get('Mantra of Flame');
  const rush = guardianCatalog.skillsByName.get('Flame Rush');
  const surge = guardianCatalog.skillsByName.get('Flame Surge');

  assert.equal(solace.castTimeMs, 2240);
  assert.equal(flame.castTimeMs, 2240);
  assert.equal(reprieve.castTimeMs, 0);
  assert.equal(respite.castTimeMs, 0);
  assert.equal(rush.castTimeMs, 0);
  assert.equal(surge.castTimeMs, 0);
  assert.equal(reprieve.flipParentId, solace.id);
  assert.equal(respite.flipParentId, reprieve.id);
  assert.equal(rush.flipParentId, flame.id);
  assert.equal(surge.flipParentId, rush.id);

  const normal = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.ok(normal.endState.profession.availableFlips[rush.id]);
  assert.equal(normal.endState.profession.availableFlips[surge.id], undefined);
  assert.equal(normal.endState.ammo['Flame Rush'].charges, 2);

  const final = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(final.endState.profession.availableFlips[rush.id], undefined);
  assert.ok(final.endState.profession.availableFlips[surge.id]);

  const depleted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(depleted.endState.profession.availableFlips[rush.id], undefined);
  assert.equal(depleted.endState.profession.availableFlips[surge.id], undefined);
  assert.equal(depleted.endState.ammo['Flame Rush'], undefined);
  assert.ok(depleted.endState.cooldowns['Mantra of Flame'].remaining > 0);
});

test('Firebrand tome transitions are weapon swaps and timeline row changes', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome'],
    config: { ...config, specialization: 'Firebrand' }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'weapon_set').map((event) => [event.skillName, event.mechanicSwap]),
    [
      ['Tome of Justice', true],
      ['Stow Tome', true],
      ['Tome of Resolve', true],
      ['Stow Tome', true]
    ]
  );

  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    'Tome of Justice',
    'Chapter 1: Searing Spell',
    'Stow Tome',
    'True Strike',
    'Tome of Resolve',
    'Stow Tome'
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Justice', null, 'Tome of Resolve']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3, 4], [5]]
  );
});

test('Feel My Wrath applies split quickness durations and triggers Quickfire', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['"Feel My Wrath!"', '"Feel My Wrath!"', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['"Feel My Wrath!"'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      boons: { quickness: true },
      allies: { count: 1, strikesPerSecond: 1 }
    }
  });
  const quickness = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === '"Feel My Wrath!"' && event.kind === 'quickness'
  );

  assert.deepEqual(
    result.steps.filter((step) => step.skill === '"Feel My Wrath!"').map((step) => [step.start, step.end]),
    [
      [0, 400],
      [30400, 30800]
    ]
  );
  assert.deepEqual(
    quickness.map((event) => [event.resolvedAudience.alliedPlayerCount, event.duration]),
    [
      [1, 3],
      [0, 3],
      [1, 3],
      [0, 3]
    ]
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Quickfire' && event.triggeredByAlly === 1).length,
    2
  );
  assert.ok(
    result.resolvedEvents.filter((event) => event.skillName === 'Quickfire').every((event) => event.duration === 2)
  );
});

test('Quickfire grants one Ashes charge to a self-only quickness recipient', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Chapter 2: Igniting Burst', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      allies: { count: 0, strikesPerSecond: 0 }
    }
  });
  const quickfireBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && event.duration === 2
  );

  assert.equal(result.procSteps.filter((step) => step.skill === 'Quickfire').length, 1);
  assert.equal(quickfireBurns.length, 1);
  assert.equal(quickfireBurns[0].triggeredByAlly, undefined);
});

test('dormant Tome equips preserve recharge and do not trigger virtue traits', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Stow Tome',
      { type: 'wait', durationMs: 11000 },
      'Tome of Justice',
      'Stow Tome',
      { type: 'wait', durationMs: 9000 },
      'Tome of Justice'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE]
    }
  });

  assert.equal(
    result.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    2
  );
  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Lesser Symbol of Blades').map((step) => step.start),
    [0, 20000]
  );
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)
      .length,
    2
  );
  assert.equal(result.endState.profession.virtueReadyAt.justice, 40);
  assert.deepEqual(result.warnings, []);
});

test('Power of the Virtuous reduces each Tome dormancy duration', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome', 'Tome of Courage'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]
    }
  });

  assert.deepEqual(result.endState.profession.tomeDormantReadyAt, {
    justice: 17,
    resolve: 25.5,
    courage: 38.25
  });
});

test('Firebrand specialization traits drive pages, quickness, and tome bonuses', () => {
  const lore = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Chapter 3: Heated Rebuke',
      'Stow Tome',
      'Tome of Justice'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 5,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LEGENDARY_LORE]
    }
  });

  assert.equal(lore.endState.profession.tomePages, 3);
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    1
  );
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE && event.kind === 'might'
    ).length,
    3
  );
  assert.ok(
    lore.events
      .filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)
      .every((event) => event.stacks === 2 && event.duration === 10)
  );

  const weighted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Potent Haste', 'Potent Haste', 'Overwhelming Celerity'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Potence'],
      initialTomePages: 1,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS]
    }
  });

  assert.deepEqual(weighted.warnings, []);
  assert.equal(weighted.endState.profession.tomePages, 3);
  assert.deepEqual(
    weighted.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS)
      .map((event) => [event.condition, event.duration]),
    [['Slow', 1.5]]
  );

  const liberated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Shelter'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Shelter'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LIBERATORS_VOW]
    }
  });

  assert.equal(
    liberated.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'quickness' &&
        event.sourceId === GUARDIAN_SKILL_IDS.SHELTER &&
        event.duration === 2
    ),
    true
  );
});

test('Firebrand grandmaster support traits react to boons and control', () => {
  const quickfire = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Epilogue: Unbroken Lines', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      maximumTomePages: 8,
      initialTomePages: 8,
      allies: { count: 1, strikesPerSecond: 1 },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STALWART_SPEED, GUARDIAN_TRAIT_IDS.QUICKFIRE]
    }
  });

  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Stalwart Speed'),
    true
  );
  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Quickfire'),
    true
  );
  const stoic = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Chapter 2: Daring Challenge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR]
    }
  });
  const stoicBuffs = stoic.events.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR
  );

  assert.deepEqual(
    stoicBuffs.map((event) => [event.kind, event.stacks, event.duration]),
    [
      ['resistance', 1, 2],
      ['might', 3, 10]
    ]
  );
});

test('Firebrand dormant passives and Imbued Haste use timeline state', () => {
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath', { type: 'wait', durationMs: 80000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.equal(passive.endState.profession.justicePassiveBurns, 2);
  assert.equal(
    passive.resolvedEvents
      .filter((event) => event.sourceId === 'guardian.justice-passive')
      .every((event) => event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE && event.skillName === 'Tome of Justice'),
    true
  );
  assert.deepEqual(
    passive.events
      .filter(
        (event) =>
          event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_COURAGE && event.kind === 'aegis'
      )
      .map((event) => event.at),
    [0, 40, 80]
  );

  const tome = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Tome of Justice', 'Chapter 1: Searing Spell', { type: 'wait', durationMs: 3000 }],
      config: {
        ...config,
        specialization: 'Firebrand',
        selectedTraitIds
      }
    });
  const normal = tome([]);
  const imbued = tome([GUARDIAN_TRAIT_IDS.IMBUED_HASTE]);

  assert.ok(imbued.conditionDamage > normal.conditionDamage);
});
