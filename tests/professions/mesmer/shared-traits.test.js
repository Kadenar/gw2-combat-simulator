import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { handleExpectedProcTask } from '#gw2/professions/mesmer/core/mechanics/illusions/execution.js';

test('delayed Mesmer hit procs retain annotations and prefer canonical critical facts', () => {
  // Canonical replacement supplies sampled facts without dropping annotations on the original scheduled hit.
  const event = Object.freeze({ type: 'damage', at: 2, eventOrder: 7, blade: true, didCrit: false });
  for (const canonical of [undefined, { type: 'damage', at: 2, eventOrder: 7, didCrit: true }]) {
    const processed = [];
    const context = {
      mesmerRuntime: { expected: { process: (candidate) => processed.push(candidate) } },
      eventByOrder(order) {
        assert.equal(order, 7);
        return canonical;
      }
    };
    handleExpectedProcTask(context, { at: 2, payload: { type: 'hit', at: 2, event, cloneId: 1 } });
    assert.equal(processed.length, 1);
    assert.equal(processed[0].cloneId, 1);
    assert.equal(processed[0].at, 2);
    assert.equal(processed[0].event.blade, true);
    assert.equal(processed[0].event.didCrit, Boolean(canonical));
    assert.equal(event.didCrit, false);
  }
});

// Shared traits retain their damage, boon, and resource contracts across Mesmer specializations.
test('Maim the Disillusioned applies torment for defensive shatters', () => {
  const cases = [
    {
      specialization: 'Virtuoso',
      skill: 'Bladesong Distortion',
      initialResource: 5,
      expectedStacks: 1
    },
    {
      specialization: 'Core',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    },
    {
      specialization: 'Chronomancer',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    },
    {
      specialization: 'Mirage',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    }
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      [testCase.skill],
      defaultSimulationConfig({
        specialization: testCase.specialization,
        selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED],
        initialResource: testCase.initialResource
      })
    );
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === testCase.skill && event.condition === 'Torment'
    );

    assert.equal(result.steps[0].start, result.steps[0].end);
    assert.equal(result.endState.profession.resource, 0);
    assert.equal(torment.length, 1);
    assert.equal(torment[0].stacks, testCase.expectedStacks);
    assert.equal(torment[0].duration, 6);
  }
});

test('supplied trait attacks execute with their exact coefficients', () => {
  const coefficient = (result, skillName) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .reduce((sum, event) => sum + event.coefficient, 0);

  const madness = simulateMesmer(
    ['Ether Feast', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.METHOD_OF_MADNESS],
      selectedSkills: ['Ether Feast']
    })
  );

  assert.ok(Math.abs(coefficient(madness, 'Lesser Chaos Storm') - 1.98) < 1e-12);

  const phantasmalBlade = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0
    })
  );

  assert.equal(coefficient(phantasmalBlade, 'Phantasmal Blade'), 0.7);
  const phantasmalBladeHit = phantasmalBlade.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade'
  );

  assert.equal(phantasmalBladeHit.source, 'Player');
  assert.equal(phantasmalBladeHit.actorType, 'player');
  assert.equal(phantasmalBladeHit.weaponStrength, 2553.5);
  const modifiedPhantasmalBlade = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0,
      sigilSets: [
        { strike: 1.1, condition: 1 },
        { strike: 1, condition: 1 }
      ]
    })
  ).resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade');

  assert.ok(Math.abs(modifiedPhantasmalBlade.damage / phantasmalBladeHit.damage - 1.1) < 1e-12);

  const syncopate = simulateMesmer(
    ['Illusionary Wave'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.SYNCOPATE]
    })
  );

  assert.equal(coefficient(syncopate, 'Syncopate'), 0.75);

  const timeBomb = simulateMesmer(
    ['Time Sink', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.TIME_BOMB],
      initialResource: 1
    })
  );

  assert.equal(coefficient(timeBomb, 'Time Bomb'), 3);
});

test("Egotism starts after the target falls below the Mesmer's health percentage", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: '',
    initialResource: 0,
    boons: {
      ...defaults.boons,
      might: 0
    },
    target: {
      ...defaults.target,
      vulnerability: 0,
      health: 3970000
    }
  });
  const rotation = ['Mind Slash', 'Mind Gash'];
  const base = simulateMesmer(rotation, config);
  const egotism = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.EGOTISM]
  });
  const strike = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === name).damage;

  assert.equal(strike(egotism, 'Mind Slash'), strike(base, 'Mind Slash'));
  assert.ok(Math.abs(strike(egotism, 'Mind Gash') / strike(base, 'Mind Gash') - 1.1) < 1e-12);
});

test('Master Fencer grants self and allied fury on critical hits with an eight-second ICD', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      'Flying Cutter',
      { name: '__wait', waitMs: 1000 },
      'Flying Cutter',
      { name: '__wait', waitMs: 9000 },
      'Flying Cutter'
    ],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false,
        quickness: false,
        alacrity: false
      },
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');
  const procs = result.events.filter((event) => event.type === 'proc' && event.name === 'Master Fencer');
  const fury = result.events.filter((event) => event.type === 'buff' && event.skillName === 'Master Fencer');

  assert.equal(hits.length, 3);
  assert.ok(hits.every((event) => event.didCrit === true));
  assert.equal(procs.length, 2);
  assert.equal(procs[0].at, hits[0].at);
  assert.equal(procs[1].at, hits[2].at);
  assert.ok(hits[1].at <= hits[0].at + 8);
  assert.ok(hits[2].at > hits[0].at + 8);
  assert.deepEqual(
    fury
      .filter((event) => event.audience?.recipients === 'self')
      .map((event) => [event.duration, event.resolvedAudience.includesSummons]),
    [
      [8, false],
      [8, false]
    ]
  );
  assert.deepEqual(
    fury
      .filter((event) => event.audience?.recipients === 'party')
      .map((event) => [event.duration, event.resolvedAudience.includesSummons]),
    [
      [4, false],
      [4, false]
    ]
  );

  const openParty = simulateMesmer(
    ['Flying Cutter'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      initialResource: 2,
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false
      },
      allies: { count: 2, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const openPartyFury = openParty.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Master Fencer' && event.audience?.recipients === 'party'
  );

  assert.equal(openPartyFury.resolvedAudience.includesSummons, true);
  assert.equal(openPartyFury.resolvedAudience.alliedPlayerCount, 2);
  assert.equal(openPartyFury.resolvedAudience.recipientCount, 4);
  assert.equal(openPartyFury.resolvedAudience.includesSelf, false);
  assert.equal(openPartyFury.resolvedAudience.companionIds.length, 2);
  assert.ok(openPartyFury.resolvedAudience.companionIds.every((id) => id.startsWith('mesmer.clone:')));

  const isolated = simulateMesmer(
    ['Flying Cutter'],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false
      },
      sharePlayerBoonsWithSummons: false,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const isolatedFury = isolated.events.filter((event) => event.type === 'buff' && event.skillName === 'Master Fencer');

  assert.equal(isolatedFury.length, 2);
  assert.equal(
    isolatedFury.find((event) => event.audience?.recipients === 'self')?.resolvedAudience.includesSummons,
    false
  );
  assert.equal(
    isolatedFury.find((event) => event.audience?.recipients === 'party')?.resolvedAudience.includesSummons,
    false
  );
});

test('Sharper Images samples illusion criticals instead of accumulating expected procs', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    selectedTraitIds: [TRAIT.SHARPER_IMAGES],
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    stats: {
      ...defaults.stats,
      precision: 1945
    },
    boons: {
      ...defaults.boons,
      fury: false
    }
  });
  const result = simulateMesmer(['Phantasmal Duelist', { name: '__wait', waitMs: 4000 }], {
    ...config,
    randomness: { mode: 'stochastic', seed: 91 }
  });
  const illusionHits = result.events.filter((event) => event.type === 'damage' && event.source === 'Phantasm');
  const criticals = illusionHits.filter((event) => event.didCrit).length;
  const sharperImages = result.events.filter(
    (event) => event.type === 'condition' && event.name.includes('Sharper Images')
  );

  assert.ok(illusionHits.length > 1);
  assert.ok(criticals > 0 && criticals < illusionHits.length);
  assert.equal(sharperImages.length, criticals);
  assert.ok(sharperImages.every((event) => event.stacks === 1));
});

test('Egotism does not increase condition damage', () => {
  const defaults = defaultSimulationConfig();
  const run = (selectedTraitIds) =>
    simulateMesmer(
      ['Phantasmal Swordsman', { name: '__wait', waitMs: 6000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: '',
        initialResource: 0,
        selectedTraitIds: [TRAIT.SHARPER_IMAGES, ...selectedTraitIds],
        target: {
          ...defaults.target,
          health: 3970000
        }
      })
    );
  const bleeding = (result) => result.conditionBreakdown.find((entry) => entry.name === 'Bleeding')?.damage || 0;

  assert.equal(bleeding(run([TRAIT.EGOTISM])), bleeding(run([])));
});

test('Sharper Images uses deterministic expected-proc accumulation', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    selectedTraitIds: [TRAIT.SHARPER_IMAGES],
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    stats: {
      ...defaultSimulationConfig().stats,
      precision: 1105
    },
    boons: {
      ...defaultSimulationConfig().boons,
      fury: false
    }
  });
  const first = simulateMesmer(['Phantasmal Duelist', { name: '__wait', waitMs: 1000 }], config);
  const second = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 16000 }, 'Phantasmal Duelist', { name: '__wait', waitMs: 1000 }],
    config
  );

  assert.equal(first.procSteps.filter((proc) => proc.skill === 'Sharper Images').length, 0);
  assert.ok(second.procSteps.some((proc) => proc.skill === 'Sharper Images' && proc.detail === '1 critical-hit proc'));
  assert.equal(
    second.resolvedEvents.find((event) => event.type === 'condition' && event.name.includes('Sharper Images'))?.source,
    'Player'
  );
});

test('Mesmer allied boons prioritize players before active clones', () => {
  const result = simulateMesmer(
    ['Mind Slash'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      initialResource: 3,
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      allies: { count: 2, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      stats: { precision: 10000 }
    })
  );
  const alliedFury = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Master Fencer' && event.audience?.recipients === 'party'
  );

  assert.ok(alliedFury);
  // The separate personal application leaves two slots for clones after the two allied players.
  assert.equal(alliedFury.resolvedAudience.includesSelf, false);
  assert.equal(alliedFury.resolvedAudience.alliedPlayerCount, 2);
  assert.deepEqual(alliedFury.resolvedAudience.companionIds, ['mesmer.clone:1', 'mesmer.clone:2']);
  assert.equal(alliedFury.resolvedAudience.recipientCount, 4);
});

test('Shatter Storm gives Split Second two ammo charges', () => {
  const result = simulateMesmer(
    ['Split Second', 'Split Second', 'Split Second'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SHATTER_STORM],
      initialResource: 3
    })
  );

  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 50);
  assert.equal(result.steps[2].start, 8000);
  assert.deepEqual(
    {
      charges: result.endState.ammo['Split Second'].charges,
      maximum: result.endState.ammo['Split Second'].maximum
    },
    { charges: 0, maximum: 2 }
  );
});

test('Shatter Storm initializes Split Second ammo before first cast', () => {
  const result = simulateMesmer(
    [],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SHATTER_STORM],
      initialResource: 0
    })
  );

  assert.deepEqual(
    {
      charges: result.endState.ammo['Split Second'].charges,
      maximum: result.endState.ammo['Split Second'].maximum
    },
    { charges: 2, maximum: 2 }
  );
});
