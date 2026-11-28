import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildChartSeries } from '#gw2/app/results/charts/time-series-model.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createScrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { kineticAccelerators } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Scrapper contracts cover trait procs, combo boons, and gyro fields.
const baseConfig = Object.freeze({
  selectedSkillIds: [5857, 5805, 6161, 5933, 5868],
  selectedMorphSkillIds: [76568, 76959, 76693],
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createObservedProfessionSimulator(engineerProfession, baseConfig);

// Keep the heal, its toolbelt, and Med Kit's combined capped grant distinct.
test('Speed of Synergy distinguishes healing skills from healing toolbelts', () => {
  for (const [heal, skill, duration] of [
    ['Healing Turret', 'Healing Turret', 7],
    ['Medic Gyro', 'Reconstruction Field', 5],
    ['Med Kit', 'Med Kit', null],
    ['Med Kit', 'Bandage Self', 10]
  ]) {
    const result = simulate('Scrapper', [skill], {
      selectedSkillIds: [engineerCatalog.skills.find((candidate) => candidate.name === heal).id],
      selectedTraitIds: [TRAIT.SPEED_OF_SYNERGY]
    });
    assert.deepEqual(result.warnings, [], skill);
    const grants = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.SPEED_OF_SYNERGY);
    assert.deepEqual(
      grants.map((event) => event.duration),
      duration == null ? [] : [duration],
      skill
    );
  }
});

test('Function Gyro aliases share Ex Machina charges and canonical trait effects', () => {
  // Mixed canonical and compatibility IDs must consume one trait-granted ammo pool.
  for (const skillId of [56921, 72103, 72114]) {
    const result = simulate('Scrapper', [56920, skillId], {
      selectedTraitIds: [TRAIT.EX_MACHINA, TRAIT.SYSTEM_SHOCKER]
    });

    assert.deepEqual(result.warnings, []);
    assert.deepEqual([...observedRuntime(result).cooldownController.ammoSkillIds()], [56920]);
    assert.equal(observedRuntime(result).cooldownController.readAmmo(56920).maximum, 2);
    assert.equal(observedRuntime(result).cooldownController.readAmmo(56920).charges, 0);
    assert.equal(result.events.filter((event) => event.type === 'control' && event.controlKind === 'daze').length, 2);

    const untraited = simulate('Scrapper', [skillId]);
    assert.deepEqual(untraited.warnings, []);
    assert.equal([...observedRuntime(untraited).cooldownController.ammoSkillIds()].length, 0);
  }
});

test('Scrapper traits apply gyro control, superspeed, boons, and charges', () => {
  const result = simulate(
    'Scrapper',
    ['Med Kit', 'Bandage Self', 'Function Gyro', 'Function Gyro', { type: 'wait', durationMs: 2100 }],
    {
      selectedSkillIds: [5802, 5805, 6161, 5933, 5868],
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
    result.events.filter((event) => event.type === 'buff' && event.name === 'Speed of Synergy - superspeed').length,
    1
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Speed of Synergy - superspeed' && event.duration === 10
    )
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Gyroscopic Acceleration - superspeed' && event.duration === 5
    )
  );
  assert.equal(result.events.filter((event) => event.type === 'control' && event.controlKind === 'daze').length, 2);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'stability' && event.duration === 3));
  assert.ok(result.procSteps.filter((step) => step.skill === 'Mass Momentum').length >= 3);
  assert.ok(result.procSteps.some((step) => step.skill === 'Applied Force'));
  assert.equal(result.planningState.ammoBySkillId[56920].maximum, 2);

  const reconstructionField = simulate('Scrapper', ['Reconstruction Field'], {
    selectedSkillIds: [30357, 5805, 6161, 5933, 5868],
    selectedTraitIds: [TRAIT.SPEED_OF_SYNERGY]
  });

  // Ordinary healing toolbelts grant five seconds; only Med Kit also receives the healing-skill grant.
  assert.ok(
    reconstructionField.events.some((event) => event.name === 'Speed of Synergy - superspeed' && event.duration === 5)
  );

  const base = simulate('Scrapper', ['Puncturing Jab'], {
    target: { conditions: {} }
  });
  const moving = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.OBJECT_IN_MOTION],
    boons: {
      stability: true,
      swiftness: true
    },
    target: { conditions: {} }
  });

  assertFlooredDamageMultiplier(
    moving.resolvedEvents.find((event) => event.type === 'damage').damage,
    base.resolvedEvents.find((event) => event.type === 'damage').damage,
    1.05 ** 2
  );

  const appliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.APPLIED_FORCE],
    boons: { might: 25 },
    attributeInputs: baseAttributeInputs({ power: 2000 }),
    target: { conditions: {} }
  });
  const withoutAppliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    boons: { might: 25 },
    attributeInputs: baseAttributeInputs({ power: 2000 }),
    target: { conditions: {} }
  });

  assertFlooredDamageMultiplier(
    appliedForce.resolvedEvents.find((event) => event.type === 'damage').damage,
    withoutAppliedForce.resolvedEvents.find((event) => event.type === 'damage').damage,
    3500 / 2750
  );
});

test('Sharpshooter derives bleeding damage from Power including Applied Force', () => {
  // Applied Force increases the Power supplied by Might before Sharpshooter calculates bleeding damage.
  const bleeding = (might, appliedForce) => {
    const result = simulate('Scrapper', ['Puncturing Jab', { type: 'wait', durationMs: 2000 }], {
      selectedTraitIds: [TRAIT.SHARPSHOOTER, ...(appliedForce ? [TRAIT.APPLIED_FORCE] : [])],
      boons: { might },
      target: { conditions: {} }
    });
    const bleed = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Puncturing Jab' && event.condition === 'Bleeding'
    );
    assert.deepEqual(result.warnings, []);
    return bleed.damage;
  };

  assert.equal(bleeding(0, true), bleeding(0, false));
  assert.ok(bleeding(10, true) > bleeding(10, false));
});

test('Kinetic Accelerators emits party quickness and might from successful combos', () => {
  const config = {
    selectedSkillIds: [30357, 5805, 6161, 5933, 5868],
    selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
    boons: { quickness: false },
    attributeInputs: baseAttributeInputs({ power: 2000, concentration: 0 })
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
  // Each surviving combo owns one set of resolver grants; predictions are absent from final output.
  const quickness = result.resolvedEvents.find(
    (event) => event.type === 'buff' && event.name === 'Kinetic Accelerators - quickness'
  );
  const might = result.resolvedEvents.find(
    (event) => event.type === 'buff' && event.name === 'Kinetic Accelerators - might'
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.KINETIC_ACCELERATORS)
      .length,
    2
  );

  assert.equal(quickness.audience.recipients, 'party');
  assert.equal(quickness.duration, 3.52);
  assert.equal(might.audience.recipients, 'party');
  // Concentration scales the base duration at the actual boon application.
  assert.ok(Math.abs(might.duration - Math.round(10 * (1 + 260 / 1500) * 1000) / 1000) < 1e-9);
  assert.equal(might.stacks, 3);
  const chart = buildChartSeries(result, 40);

  assert.equal(chart.effectUnits.quickness, 's');
  assert.equal(chart.effects.quickness[0].v, 3.52);
  assert.ok(chart.effects.quickness.some((point) => point.v > 0));

  const acceleratedHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );
  const baseHit = withoutTrait.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );

  assertFlooredDamageMultiplier(acceleratedHit.damage, baseHit.damage, 2090 / 2000);
});

test('Kinetic Accelerators grants boons for a resolver-created Orbital Command Strike combo', () => {
  // The fifth rocket creates its finisher only during resolution, with no scheduled boon prediction.
  const rotation = [];
  for (let index = 0; index < 4; index++) rotation.push('Fragmentation Shot', { type: 'wait', durationMs: 3100 });
  rotation.push('Medic Gyro', 'Fragmentation Shot', { type: 'wait', durationMs: 2500 });
  const result = simulate('Scrapper', rotation, {
    selectedSkillIds: [30357, 5805, 6161, 5933, 5868],
    selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS, TRAIT.AIM_ASSISTED_ROCKET],
    boons: { might: 0, quickness: false }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'combo' && event.skillName === 'Orbital Command Strike')
      .length,
    1
  );
  const boons = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.KINETIC_ACCELERATORS
  );
  assert.deepEqual(boons.map((event) => event.kind).sort(), ['might', 'quickness']);
  assert.ok(boons.every((event) => event.resolvedAudience.includesSelf && event.audience.recipients === 'party'));
});

test('Kinetic Accelerators grants setup boons from precombat combos', () => {
  const result = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 2000 }, '__combat_start', 'Positive Strike'],
    {
      selectedSkillIds: [30357, 5805, 6161, 5933, 5868],
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === 'buff' && event.sourceId === TRAIT.KINETIC_ACCELERATORS && event.at < result.combatStartTime
    ),
    true
  );
});

test('Kinetic Accelerators applies its strict ICD only to whirl finishers', () => {
  const { events: boons, effects } = captureEffectEmissions();
  const context = {
    effects,
    procs: createProcRegistry(() => context),
    helpers: engineerCatalog,
    config: {
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
      attributeInputs: baseAttributeInputs({ concentration: 0 })
    },
    profession: { core: {}, specialization: { kind: 'Scrapper', state: createScrapperState() } },
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
    finisherType
  });

  // Invoke the canonical compiled producer so selection precedes cooldown admission.
  context.queries = context;
  const observe = compileProfessionRules({
    traitTriggers: kineticAccelerators.triggers.map((trigger) => ({ ...trigger, trait: kineticAccelerators.id }))
  }).reactions['combo.resolved'];

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
  assert.ok(boons.every((event) => event.schedulerBoonPrediction == null));
});
