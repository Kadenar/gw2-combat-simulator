import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { createGuardianBuildDefaults, migrateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { willbenderVirtueTriggered } from '#gw2/professions/guardian/specializations/willbender/mechanics/trigger-points.js';
import { effectFields } from '#tests/helpers/effect-report.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { captureTriggerPoint } from '#tests/helpers/trigger-points.js';

const config = {
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  }),
  target: { armor: 2597 }
};

test('Guardian player strikes trigger shared player-owned sigils', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    attributeInputs: baseAttributeInputs({
      ...config.attributeInputs?.weaponSets[0].commonTotals,
      precision: 3100
    }),
    boons: { fury: true },
    sigilSets: [
      { names: ['Air'], strikeAdd: 0, conditionAdd: 0 },
      { names: [], strikeAdd: 0, conditionAdd: 0 }
    ]
  })(undefined, ['True Strike']);

  assert.equal(result.resolvedEvents.find((event) => event.skillName === 'True Strike').actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Sigil of Air'),
    true
  );
});

// Compare the same virtue under identical boon settings to isolate its trait recharge.
test('Power of the Virtuous shortens Justice recharge', () => {
  const readyAt = (selectedTraitIds) => {
    const result = createObservedProfessionSimulator(guardianProfession, { ...config, selectedTraitIds })(undefined, [
      'Virtue of Justice'
    ]);
    assert.deepEqual(result.warnings, []);
    return result.planningState.cooldownsBySkillId[GUARDIAN_SKILL_IDS.JUSTICE].readyAtMs;
  };

  assert.ok(readyAt([GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]) < readyAt([]));
});

// Whirling Light applies its conditions on each landed strike.
test('Whirling Light applies its conditions with its whirl finishers', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, specialization: 'Willbender' })(
    undefined,
    ['Whirling Light']
  );
  const strikes = (name) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === name);
  const whirls = strikes('Whirling Light');
  assert.deepEqual(result.warnings, []);
  assert.ok(whirls.length > 0);
  assert.ok(
    whirls.every(
      (event) => event.comboFinishers?.[0]?.finisherType === 'Whirl' && event.comboFinishers[0].ownerId === 'guardian'
    )
  );
  for (const condition of ['Burning', 'Weakness']) {
    const applications = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Whirling Light' && event.condition === condition
    );
    assert.deepEqual(
      applications.map((event) => event.at),
      whirls.map((event) => event.at)
    );
  }
});

// Native finishers bind to a live field and retain their condition payload.
test('Whirling Light creates Burning Bolts only inside Purging Flames', () => {
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
  assert.ok(burningCombos(inFireField).length > 0);
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
  assert.ok(finisher.fieldId);
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

// Virtue traits modify landed flames and their rewards independently of the native cast and pulse schedule.
// Compare both flame traits on the same virtue activation.
test('Power for Power strengthens flame hits and Searing Pact burns on each flame hit', () => {
  const flames = (selectedTraitIds) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Willbender',
      selectedTraitIds
    })(undefined, ['Rushing Justice', { type: 'wait', durationMs: 6000 }]);
  const hits = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Willbender Flames');
  const burns = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === 'Searing Pact');
  const plain = flames([]);
  const powered = flames([GUARDIAN_TRAIT_IDS.POWER_FOR_POWER]);
  const searing = flames([GUARDIAN_TRAIT_IDS.SEARING_PACT]);
  assert.ok(hits(powered)[0].damage > hits(plain)[0].damage);
  assert.deepEqual(burns(plain), []);
  assert.ok(hits(searing).length > 0);
  assert.deepEqual(
    burns(searing).map((event) => event.at),
    hits(searing).map((event) => event.at)
  );
});

test('Restorative Virtues converts base recharge reduction through Alacrity', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES]
  })(undefined, ['Rushing Justice', 'Whirling Wrath']);
  const procs = result.procSteps.filter((step) => step.skill === 'Restorative Virtues');

  assert.deepEqual(result.warnings, []);
  assert.ok(procs.length > 0);
  assert.equal(
    procs.every((event) => event.detail === '0.224s weapon recharge'),
    true
  );
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
      ...effectFields([], 3, {
        frames: [
          { at: 0, states: [timedEffectState('lethal-tempo', [{ stacks: 1, expiresAt: 4 }], 5)] },
          { at: 1, states: [timedEffectState('lethal-tempo', [{ stacks: 2, expiresAt: 5 }], 5)] }
        ]
      })
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

test('independent Willbender cycles deliver virtue payloads and selected trait rewards from the accepted hit', () => {
  // Seed independent cycles so one accepted strike tests their rewards without activation grants or flame schedules.
  for (const virtues of [
    ['justice', 'resolve'],
    ['justice', 'resolve', 'courage']
  ]) {
    const { triggers, extend } = captureTriggerPoint(willbenderVirtueTriggered);
    let workBeforeHit;
    const result = runGuardian(
      [{ type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Willbender',
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL]
      },
      {
        extend,
        initialize(runtime) {
          const state = runtime.profession.specialization.state;
          for (const virtue of virtues) {
            state[`${virtue}Until`] = 2;
            state.virtueHitCounts[virtue] = 4;
          }

          const skill = runtime.helpers.skillsById.get(GUARDIAN_SKILL_IDS.CHAINS_OF_LIGHT);
          runtime.cooldownController.startRecharge(skill, 0, 10);
          workBeforeHit = runtime.cooldownController.remaining(
            skill,
            runtime.cooldownController.rechargeFor(skill.id),
            1
          );
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: 1,
              actorType: 'player',
              source: 'guardian',
              sourceId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
              skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
              skillName: 'Orb of Wrath',
              activationId: 'cycle-hit',
              coefficient: 1,
              weaponStrengthProfileId: 'weapon.scepter'
            }
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      triggers.map(({ virtue, cause }) => [virtue, cause.activationId]),
      virtues.map((virtue) => [virtue, 'cycle-hit'])
    );
    const burns = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillId === GUARDIAN_SKILL_IDS.WILLBENDER_JUSTICE
    );
    assert.equal(burns.length, 1);
    const courageBoons = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_SKILL_IDS.CRASHING_COURAGE
    );
    assert.deepEqual(
      courageBoons.map((event) => event.kind),
      virtues.includes('courage') ? ['aegis', 'stability'] : []
    );
    assert.ok(courageBoons.every((event) => event.activationId === 'cycle-hit'));
    const alacrity = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL
    );
    assert.deepEqual(
      alacrity.map((event) => [
        event.kind,
        event.duration,
        event.resolvedAudience.alliedPlayerCount,
        event.triggeredBy
      ]),
      [['alacrity', 1, 0, 'Orb of Wrath']]
    );
    const work = observedRuntime(result).cooldownController.rechargeFor(GUARDIAN_SKILL_IDS.CHAINS_OF_LIGHT).work;
    assert.ok(Math.abs(workBeforeHit - work - virtues.length * 0.28) < 1e-9);
    assert.ok(result.procSteps.some((step) => step.skill === 'Restorative Virtues'));
  }
});

test('Phoenix Protocol activation grants remain distinct from hit-cycle rewards', () => {
  // An off-target Resolve opens its window and grants activation Alacrity without completing a hit cycle.
  const { triggers, extend } = captureTriggerPoint(willbenderVirtueTriggered);
  const result = runGuardian(
    [
      { skillId: GUARDIAN_SKILL_IDS.FLOWING_RESOLVE, offTarget: true },
      { type: 'wait', durationMs: 1000 }
    ],
    {
      specialization: 'Willbender',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL]
    },
    { extend }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(triggers, []);
  const alacrity = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL
  );
  assert.deepEqual(
    alacrity.map((event) => [
      event.kind,
      event.duration,
      event.audience?.recipients,
      event.resolvedAudience.alliedPlayerCount
    ]),
    [['alacrity', 5, 'party', 0]]
  );
});

test('Phoenix Protocol and Inspired Virtue boons reach allies without Battle Presence', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Willbender',
    primaryWeapon: 'Greatsword',
    boons: { quickness: true },
    allies: { count: 4 },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE]
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
    (event) => event.type === 'condition' && event.name === 'Justice - Active Burning'
  );
  // Counter-triggered Burning reports a proc independently of Rushing Justice's cast output.
  assert.ok(triggers.length > 0);
  assert.ok(triggers.every((event) => event.procActivation?.count === 1));
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

  assert.match(
    invalidChain.warnings.map(({ message }) => message).join(' '),
    /Faithful Strike is unavailable - cast Pure Strike first\./
  );
  assert.equal(chain.resolvedEvents.filter((event) => event.type === 'damage').length, 3);
  assert.match(
    invalidFlip.warnings.map(({ message }) => message).join(' '),
    /Zealot's Fire is unavailable - not currently armed\./
  );
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
    result.steps.map((step) => step.skillName),
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
    sword.steps.map((step) => step.skillName),
    ['Sword of Wrath', "Zealot's Flame", 'Sword Arc']
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.map((step) => step.skillName),
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

// Compare charge availability and Burning on the same torch input before and after selecting Radiant Fire.
test("Radiant Fire adds a Zealot's Flame charge and extends its Burning", () => {
  const cast = (selectedTraitIds) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      selectedTraitIds
    })(undefined, ["Zealot's Flame", "Zealot's Fire", { type: 'wait', durationMs: 4000 }]);
  const normal = cast([]);
  const traited = cast([GUARDIAN_TRAIT_IDS.RADIANT_FIRE]);
  assert.deepEqual(normal.warnings, []);
  assert.deepEqual(traited.warnings, []);
  const charges = (result) => result.planningState.ammoBySkillId[GUARDIAN_SKILL_IDS.ZEALOTS_FLAME]?.maximum ?? 1;
  const burning = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === "Zealot's Flame" && event.condition === 'Burning'
    ).effectiveDuration;
  assert.ok(charges(traited) > charges(normal));
  assert.ok(burning(traited) > burning(normal));
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

  assert.equal(Object.hasOwn(result.planningState.cooldownsBySkillId, GUARDIAN_SKILL_IDS.JUSTICE), false);
  assert.equal(Object.hasOwn(result.planningState.cooldownsBySkillId, GUARDIAN_SKILL_IDS.RESOLVE), false);
  assert.equal(Object.hasOwn(result.planningState.cooldownsBySkillId, GUARDIAN_SKILL_IDS.COURAGE), false);
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

// Supported boon shouts must remain available when loading a canonical saved build.
test('"Stand Your Ground!" is available and retained in saved Guardian builds', () => {
  const skillId = GUARDIAN_SKILL_IDS.STAND_YOUR_GROUND;
  assert.equal(guardianCatalog.skillsById.get(skillId)?.name, '"Stand Your Ground!"');

  const defaults = createGuardianBuildDefaults();
  const build = migrateGuardianBuild({
    ...defaults,
    selectedSkillIds: { ...defaults.selectedSkillIds, Utility1: skillId }
  });
  assert.equal(build.selectedSkillIds.Utility1, skillId);
});

test('out-of-scope Guardian slot skills are absent and rejected in saved builds', () => {
  const excludedNames = [
    '"Save Yourselves!"',
    'Signet of Mercy',
    'Merciful Intervention',
    'Wall of Reflection',
    'Contemplation of Purity',
    'Stalwart Stance',
    'Mantra of Lore',
    'Hallowed Ground',
    'Bow of Truth'
  ];

  for (const name of excludedNames) {
    assert.equal(
      guardianCatalog.skills.some((candidate) => candidate.name === name),
      false,
      name
    );
  }

  assert.throws(
    () =>
      migrateGuardianBuild({
        ...createGuardianBuildDefaults(),
        selectedSkillIds: {
          ...createGuardianBuildDefaults().selectedSkillIds,
          Utility1: 'Contemplation of Purity'
        }
      }),
    /Unknown selected skill ID/
  );
});

test('Guardian results advance to cooldown expiry before recasting', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon: 'Mace' })(
    undefined,
    ['True Strike', { type: 'wait', durationMs: 1000 }, 'Pure Strike', 'Virtue of Justice', 'Virtue of Justice']
  );

  const casts = result.steps.filter((step) => step.skillName === 'Virtue of Justice');
  assert.equal(casts[1].start - casts[0].start, 16000);
  assert.ok(result.steps.every((step) => !step.invalid));
  assert.deepEqual(result.warnings, []);
});
