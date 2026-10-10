import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Virtuoso packets and trait reactions preserve blade generation, spending, and timing.
test('Deadly Blades activates only after a completed Virtuoso Bladesong', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.DEADLY_BLADES],
    initialResource: 1
  });
  const completed = simulateMesmer(['Bladesong Harmony'], config, { kind: 'tail', durationMs: 1 });
  const interrupted = simulateMesmer([{ name: 'Bladesong Harmony', interruptMs: 100 }], config);
  const action = completed.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const buff = completed.events.find((event) => event.type === 'buff' && event.kind === 'deadly-blades');

  assert.ok(buff);
  assert.equal(buff.duration, 7);
  assert.equal(buff.at, action.fullEndsAt);
  assert.equal(buff.priority, 5);
  assert.equal(
    interrupted.events.some((event) => event.type === 'buff' && event.kind === 'deadly-blades'),
    false
  );
});

test('Infinite Forge refunds two blades only after a completed five-blade Bladesong', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.INFINITE_FORGE]
  });
  const observeRefund = (shatter) => [shatter, { name: '__wait', waitMs: 1000 }];
  const fullShatter = simulateMesmer(observeRefund('Bladesong Harmony'), {
    ...config,
    initialResource: 5
  });
  const partialShatter = simulateMesmer(observeRefund('Bladesong Harmony'), {
    ...config,
    initialResource: 4
  });
  const interruptedShatter = simulateMesmer(observeRefund({ name: 'Bladesong Harmony', interruptMs: 100 }), {
    ...config,
    initialResource: 5
  });
  const action = fullShatter.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const refund = fullShatter.events.find(
    (event) => event.type === 'resource' && event.reason === 'Infinite Forge refund'
  );

  assert.equal(fullShatter.planningState.profession.blades.value, 2);
  assert.equal(partialShatter.planningState.profession.blades.value, 0);
  assert.equal(interruptedShatter.planningState.profession.blades.value, 5);
  assert.equal(refund.amount, 2);
  assert.equal(refund.at, action.fullEndsAt);
});

test('Cry of Pain improves every Bladesong Sorrow confusion packet', () => {
  const result = simulateMesmer(
    ['Bladesong Sorrow', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.CRY_OF_PAIN],
      initialResource: 5
    })
  );
  const confusion = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Bladesong Sorrow' && event.condition === 'Confusion'
  );
  assert.ok(confusion.every((event) => event.stacks === 1 && event.duration === 4));
  assert.equal(
    confusion.reduce((sum, event) => sum + event.stacks, 0),
    10
  );
});

test('Maim the Disillusioned follows each damaging Virtuoso bladesong hit', () => {
  const skills = ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem'];

  for (const skillName of skills) {
    const result = simulateMesmer(
      [skillName, { name: '__wait', waitMs: 5000 }],
      defaultSimulationConfig({
        selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED],
        initialResource: 5
      })
    );
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);
    const hitTimes = hits.map((event) => Number(event.at.toFixed(3)));
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === 'Torment'
    );

    assert.ok(hitTimes.length > 0, skillName);
    assert.ok(
      hits.every((event) => event.metadata?.shatterTraitEligible === true),
      skillName
    );
    assert.deepEqual(
      torment.map((event) => Number(event.at.toFixed(3))),
      hitTimes,
      skillName
    );
    assert.ok(
      torment.every((event) => event.stacks === 1 && event.duration === 6),
      skillName
    );
  }
});

test('Mental Anguish improves every damaging Virtuoso bladesong hit', () => {
  const skills = ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem'];
  const damageEvents = (result, skillName) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);

  for (const skillName of skills) {
    const rotation = [skillName, { name: '__wait', waitMs: 5000 }];
    const config = defaultSimulationConfig({ initialResource: 5 });
    const baseline = damageEvents(simulateMesmer(rotation, config), skillName);
    const boosted = damageEvents(
      simulateMesmer(rotation, { ...config, selectedTraitIds: [TRAIT.MENTAL_ANGUISH] }),
      skillName
    );

    assert.equal(boosted.length, baseline.length, skillName);
    assert.ok(
      boosted.every((event) => event.metadata?.shatterTraitEligible === true),
      skillName
    );
    boosted.forEach((event, index) => assertFlooredDamageMultiplier(event.damage, baseline[index].damage, 1.25));
  }
});

test('Bountiful Blades stocks each Berserker blade independently', () => {
  const result = simulateMesmer(
    ['Phantasmal Berserker', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const conversions = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Phantasmal Berserker phantasm conversion'
  );

  assert.deepEqual(
    conversions.map((event) => event.amount),
    [1, 1]
  );
  assert.equal(conversions[0].at, 3.68);
  assert.equal(conversions[1].at, 4);
});

test('Virtuoso cast-end blade spends retain their owning activation for the timeline', () => {
  // Delayed commitment uses the cast identity so resource badges remain attached to their originating action.
  const result = simulateMesmer(
    ['Bladesong Harmony'],
    defaultSimulationConfig({ specialization: 'Virtuoso', initialResource: 5 })
  );
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action');
  const spend = result.events.find((event) => event.type === 'resource' && event.reason === 'profession mechanic');
  assert.equal(spend.amount, -5);
  assert.equal(spend.activationId, action.activationId);
  assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001);
  assert.deepEqual(mechanicResourceSpends(result).get(0), {
    count: 5,
    resource: 'blades',
    sourceSkill: 'Bladesong Harmony'
  });
});

test('Bloodsong needs real bleeding and does not treat blade hits as bleeding', () => {
  const withoutJaggedMind = simulateMesmer(
    ['Unstable Bladestorm', { name: '__wait', waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG]
    })
  );
  const withJaggedMind = simulateMesmer(
    ['Unstable Bladestorm', { name: '__wait', waitMs: 8000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG, TRAIT.JAGGED_MIND]
    })
  );

  assert.equal(withoutJaggedMind.planningState.profession.blades.value, 0);
  assert.equal(withoutJaggedMind.conditionDamage, 0);
  assert.equal(withJaggedMind.planningState.profession.blades.value, 1);
  assert.ok(withJaggedMind.conditionDamage > 0);
});

test('Mesmer critical traits consume the same seeded hit outcomes in both modes', () => {
  const defaults = defaultSimulationConfig();
  const rotation = [];

  for (let index = 0; index < 6; index += 1) {
    rotation.push('Flying Cutter');

    if (index < 5) rotation.push({ name: '__wait', waitMs: 5100 });
  }

  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.JAGGED_MIND, TRAIT.DEADLY_BLADES],
    attributeInputs: baseAttributeInputs({
      ...defaults.attributeInputs.weaponSets[0].commonTotals,
      precision: 1945
    }),
    boons: {
      ...defaults.boons,
      fury: false
    },
    sigilSets: [
      { names: [], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });
  const run = (mode, seed = 37) =>
    simulateMesmer(rotation, {
      ...config,
      randomness: { mode, seed }
    });

  const stochastic = run('stochastic');
  const hits = stochastic.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flying Cutter'
  );
  const criticals = hits.filter((event) => event.didCrit).length;
  const jaggedMind = stochastic.events.filter(
    (event) => event.type === 'condition' && event.name.includes('Jagged Mind')
  );
  const deadlyBlades = stochastic.events.filter(
    (event) => event.type === 'condition' && event.condition === 'Vulnerability' && event.skillName === 'Flying Cutter'
  );

  assert.ok(criticals > 0 && criticals < hits.length);
  assert.equal(jaggedMind.length, criticals);
  assert.ok(jaggedMind.every((event) => event.stacks === 1));
  assert.equal(deadlyBlades.length, criticals);
  assert.ok(deadlyBlades.every((event) => event.stacks === 1));
  assert.deepEqual(
    run('stochastic').events.filter((event) => event.type === 'condition' && event.name.includes('Jagged Mind')),
    jaggedMind
  );

  const deterministic = run('deterministic');
  const expectedJaggedMind = deterministic.events.filter(
    (event) => event.type === 'condition' && event.name.includes('Jagged Mind')
  );

  assert.equal(expectedJaggedMind.length, criticals);
  assert.deepEqual(expectedJaggedMind, jaggedMind);
});

test('Earth bleeding grants a scheduler-visible Bloodsong blade', () => {
  const defaults = defaultSimulationConfig();
  const flyingCutters = [];

  for (let index = 0; index < 5; index += 1) {
    flyingCutters.push('Flying Cutter');

    if (index < 4) {
      flyingCutters.push({ name: '__wait', waitMs: 2100 });
    }
  }

  const run = (selectedTraitIds) =>
    simulateMesmer(
      [...flyingCutters, 'Bladesong Harmony'],
      defaultSimulationConfig({
        initialResource: 0,
        selectedTraitIds,
        attributeInputs: baseAttributeInputs({
          ...defaults.attributeInputs.weaponSets[0].commonTotals,
          precision: 4000
        }),
        sigilSets: [
          { names: ['Earth'], strike: 1, condition: 1 },
          { names: [], strike: 1, condition: 1 }
        ]
      })
    );
  const result = run([TRAIT.BLOODSONG]);
  const earth = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Sigil of Earth'
  );
  const bloodsong = result.events.find((event) => event.type === 'resource' && event.reason === 'Bloodsong');
  const harmony = result.steps.find((step) => step.skill === 'Bladesong Harmony');

  assert.equal(earth.length, 5);
  assert.ok(bloodsong);
  assert.equal(harmony.invalid, undefined);
  assert.ok(bloodsong.at <= harmony.start / 1000);

  const withoutBloodsong = run([]);

  assert.equal(
    withoutBloodsong.events.some((event) => event.type === 'resource' && event.reason === 'Bloodsong'),
    false
  );
  assert.equal(withoutBloodsong.steps.find((step) => step.skill === 'Bladesong Harmony')?.invalid, true);
});

test('Geomancy crosses Bloodsong after four canonical trait bleeds', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      'Twin Blade Restoration',
      { name: '__wait', waitMs: 21000 },
      'Twin Blade Restoration',
      'Swap Weapons',
      'Bladesong Harmony'
    ],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG, TRAIT.JAGGED_MIND],
      attributeInputs: baseAttributeInputs({
        ...defaults.attributeInputs.weaponSets[0].commonTotals,
        precision: 4000
      }),
      sigilSets: [
        { names: [], strike: 1, condition: 1 },
        { names: ['Geomancy'], strike: 1, condition: 1 }
      ]
    })
  );
  const geomancy = result.events.find((event) => event.type === 'condition' && event.skillName === 'Sigil of Geomancy');
  const bloodsong = result.events.find((event) => event.type === 'resource' && event.reason === 'Bloodsong');
  const harmony = result.steps.find((step) => step.skill === 'Bladesong Harmony');

  assert.ok(geomancy);
  assert.ok(bloodsong);
  // The threshold gain commits at its cause, before the next cast checks available blades.
  assert.equal(bloodsong.at, geomancy.at);
  assert.equal(harmony.invalid, undefined);
});

test('configured Virtuoso bladesongs spend blades at cast end', () => {
  for (const skillName of ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem']) {
    const result = simulateMesmer([skillName], defaultSimulationConfig({ initialResource: 5 }));
    const action = result.events.find((event) => event.type === 'action' && event.name === skillName);
    const spend = result.events.find(
      (event) => event.type === 'resource' && event.activationId === action.activationId
    );

    assert.equal(result.planningState.profession.blades.value, 0);
    assert.equal(spend.amount, -5);
    assert.equal(spend.activationId, result.steps[0].activationId);
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001, `${skillName} spent blades before cast end`);
  }
});

test('interrupting a bladesong restores its reserved blades', () => {
  const result = simulateMesmer(
    [{ name: 'Bladesong Harmony', interruptMs: 100 }],
    defaultSimulationConfig({ initialResource: 5 })
  );

  assert.equal(result.planningState.profession.blades.value, 5);
  assert.equal(
    result.events.some(
      (event) => event.type === 'resource' && event.activationId === result.steps[0].activationId && event.amount < 0
    ),
    false
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Bladesong Harmony'),
    false
  );
});
