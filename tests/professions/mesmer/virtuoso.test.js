import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Virtuoso packets and trait reactions preserve blade generation, spending, and timing.
test('Deadly Blades activates only after a completed Virtuoso Bladesong', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.DEADLY_BLADES],
    initialResource: 1
  });
  const completed = simulateMesmer(['Bladesong Harmony'], config);
  const interrupted = simulateMesmer([{ name: 'Bladesong Harmony', interruptMs: 100 }], config);
  const action = completed.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const buff = completed.events.find((event) => event.type === 'buff' && event.kind === 'deadly-blades');

  assert.ok(buff);
  assert.equal(buff.duration, 7);
  assert.ok(Math.abs(buff.at - action.fullEndsAt - 0.0001) < 1e-12);
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

  assert.equal(fullShatter.endState.profession.resource, 2);
  assert.equal(partialShatter.endState.profession.resource, 0);
  assert.equal(interruptedShatter.endState.profession.resource, 5);
  assert.equal(refund.amount, 2);
  assert.ok(Math.abs(refund.at - action.fullEndsAt - 0.0002) < 1e-12);
});

test("Phantasmal Blade lands one second after Phantasmal Lancer's phantasm hit", () => {
  const result = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0
    })
  );
  const blade = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade'
  );
  const phantasm = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
  );

  assert.equal(Number((blade.at - phantasm.at).toFixed(3)), 1);
});

test('Virtuoso bladesongs use configured projectile packet trains', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    selectedTraitIds: [TRAIT.JAGGED_MIND],
    stats: {
      ...defaults.stats,
      precision: 3100
    },
    initialResource: 5
  });
  const packets = (result, skillName, type = 'damage') =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === type &&
          event.skillName === skillName &&
          (type !== 'condition' || event.condition === 'Bleeding')
      )
      .map((event) => Number(event.at.toFixed(3)));

  const harmony = simulateMesmer(['Bladesong Harmony', { name: '__wait', waitMs: 2000 }], config);

  assert.deepEqual(packets(harmony, 'Bladesong Harmony'), [0.69, 0.848, 1.007, 1.174, 1.324]);
  assert.deepEqual(packets(harmony, 'Bladesong Harmony', 'condition'), [0.69, 0.848, 1.007, 1.174, 1.324]);

  const sorrow = simulateMesmer(['Bladesong Sorrow', { name: '__wait', waitMs: 2000 }], config);

  assert.deepEqual(packets(sorrow, 'Bladesong Sorrow'), [0.922, 0.997, 1.081, 1.155, 1.155]);
  assert.deepEqual(packets(sorrow, 'Bladesong Sorrow', 'condition'), [0.922, 0.997, 1.081, 1.155, 1.155]);
  assert.deepEqual(
    sorrow.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Bladesong Sorrow' && event.condition === 'Confusion'
      )
      .map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155]
  );
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

  assert.deepEqual(
    confusion.map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155]
  );
  assert.ok(confusion.every((event) => event.stacks === 2 && event.duration === 4));
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
      hits.every((event) => event.shatterTraitEligible === true),
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
      boosted.every((event) => event.shatterTraitEligible === true),
      skillName
    );
    assert.ok(
      boosted.every((event, index) => Math.abs(event.damage / baseline[index].damage - 1.25) < 1e-12),
      skillName
    );
  }
});

test('Bladeturn Requiem starts one second later and scales by 0.5 per blade', () => {
  const result = simulateMesmer(
    ['Bladeturn Requiem', { name: '__wait', waitMs: 6000 }],
    defaultSimulationConfig({ initialResource: 5 })
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Bladeturn Requiem'
  );

  assert.deepEqual(
    hits.map((event) => Number(event.at.toFixed(3))),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [0.5, 0.5, 0.5, 0.5, 0.5]
  );
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
  assert.ok(Math.abs(conversions[0].at - 3.6801) < 0.00001);
  assert.ok(Math.abs(conversions[1].at - 4.0001) < 0.00001);
});

test('Rain of Swords pulses after its cast with fixed damage and vulnerability timing', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(['Rain of Swords', 'Rain of Swords'], {
    ...defaults,
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    selectedSkills: ['Rain of Swords'],
    boons: {
      ...defaults.boons,
      alacrity: false
    },
    target: {
      ...defaults.target,
      conditions: {
        ...defaults.target.conditions,
        Vulnerability: 0
      }
    }
  });
  const firstCastEnd = result.steps[0].end / 1000;
  const firstActivation = result.events.find((event) => event.type === 'action' && event.name === 'Rain of Swords');
  const firstActivationDamage = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.skillName === 'Rain of Swords' &&
      event.activationId === firstActivation.activationId
  );
  const firstActivationVulnerability = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Rain of Swords' &&
      event.condition === 'Vulnerability' &&
      event.activationId === firstActivation.activationId
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 680);
  assert.equal(result.steps[1].start, 25_680);
  assert.deepEqual(
    firstActivationDamage.map((event) => [Math.round((event.at - firstCastEnd) * 1000), event.coefficient]),
    [
      [840, 1.2],
      [1840, 1.2],
      [2840, 1.2],
      [3840, 1.2],
      [4840, 1.2]
    ]
  );
  assert.deepEqual(
    firstActivationVulnerability.map((event) => [
      Math.round((event.at - firstCastEnd) * 1000),
      event.stacks,
      event.duration
    ]),
    [
      [840, 3, 10],
      [1840, 3, 10],
      [2840, 3, 10],
      [3840, 3, 10],
      [4840, 3, 10]
    ]
  );
});

test('Virtuoso cast-end blade spends retain timeline metadata', () => {
  const rotation = [
    'Phantasmal Disenchanter',
    'Imaginary Inversion',
    { name: 'Bladeturn Requiem', offset: 100 },
    'Mind the Gap',
    'Phantasmal Lancer',
    'Power Spike',
    'Thousand Cuts',
    'Mental Collapse',
    'Mind the Gap',
    'Swap Weapons',
    'Phantasmal Berserker',
    'Signet of the Ether',
    'Phantasmal Berserker',
    'Mind Stab',
    'Mirror Blade',
    'Bladesong Harmony',
    'Rain of Swords',
    'Phantasmal Disenchanter',
    'Bladesong Sorrow'
  ];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.INFINITE_FORGE],
      selectedSkills: [
        'Signet of the Ether',
        'Phantasmal Disenchanter',
        'Rain of Swords',
        'Mantra of Pain',
        'Thousand Cuts'
      ],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      weaponSet2Primary: 'Spear',
      weaponSet2Secondary: '',
      startingWeaponSet: 2,
      initialResource: 5
    })
  );
  const harmony = result.events.find((event) => event.type === 'marker' && event.name === 'Bladesong Harmony');
  const harmonyAction = result.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const harmonySpend = result.events.find(
    (event) =>
      event.type === 'resource' && event.reason === 'profession mechanic' && event.sourceSkill === 'Bladesong Harmony'
  );
  const timelineSpends = shatterResourceSpends(result);

  assert.equal(result.warnings.length, 0);
  assert.equal(harmony.detail, '5 blades spent');
  assert.equal(harmonySpend.amount, -5);
  assert.equal(harmonySpend.sourceSkill, 'Bladesong Harmony');
  assert.equal(harmonySpend.rotationIndex, 15);
  assert.ok(Math.abs(harmonySpend.at - harmonyAction.fullEndsAt) < 0.00001);
  assert.deepEqual(timelineSpends.get(15), {
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

  assert.equal(withoutJaggedMind.endState.profession.resource, 0);
  assert.equal(withoutJaggedMind.conditionDamage, 0);
  assert.equal(withJaggedMind.endState.profession.resource, 1);
  assert.ok(withJaggedMind.conditionDamage > 0);
});

function assertEventTimes(actual, expected, message) {
  assert.equal(actual.length, expected.length, `${message} event count`);
  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) < 1e-12,
      `${message} event ${index + 1}: ${actual[index]} !== ${expected[index]}`
    );
  }
}

test('Phantasmal Swordsman follows its packet, bleed, and blade timeline', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Phantasmal Swordsman', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG, TRAIT.JAGGED_MIND, TRAIT.SHARPER_IMAGES, TRAIT.PHANTASMAL_BLADES],
      stats: {
        ...defaults.stats,
        precision: 4000
      }
    })
  );
  const swordsmanDamage = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Swordsman'
  );
  const phantasmDamage = swordsmanDamage.filter((event) => event.source === 'Phantasm').map((event) => event.at);
  const bleeding = result.resolvedEvents
    .filter((event) => event.type === 'condition' && event.condition === 'Bleeding')
    .map((event) => event.at);
  const phantasmalBlade = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade'
  );
  const bladeGains = result.events.filter((event) => event.type === 'resource' && event.amount > 0);

  assert.equal(result.steps[0].fullCastMs, 880);
  assert.ok(Math.abs(swordsmanDamage[0].at - 0.759) < 1e-12);
  assertEventTimes(
    phantasmDamage,
    [1.725, 2.201, 2.242, 2.525, 2.559, 2.8, 2.842, 3.126, 3.159],
    'Phantasmal Swordsman damage'
  );
  assert.ok(Math.abs(phantasmalBlade.at - 4.373) < 1e-12);
  assertEventTimes(
    bleeding,
    [1.725, 2.201, 2.242, 2.525, 2.559, 2.8, 2.842, 3.126, 3.159, 4.373],
    'Phantasmal Swordsman bleeding'
  );
  assertEventTimes(
    bladeGains.map((event) => event.at),
    [2.5591, 4.2901, 4.3731],
    'Phantasmal Swordsman blade gain'
  );
  assert.deepEqual(
    bladeGains.map((event) => event.reason),
    ['Bloodsong', 'Phantasmal Swordsman phantasm conversion', 'Bloodsong']
  );
});

test('Thousand Cuts spreads ten packets and triggers Bloodsong', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Thousand Cuts', { name: '__wait', waitMs: 6000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG, TRAIT.JAGGED_MIND],
      stats: {
        ...defaults.stats,
        precision: 4000
      }
    })
  );
  const damageTimes = result.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Thousand Cuts')
    .map((event) => event.at);
  const bleedTimes = result.resolvedEvents
    .filter(
      (event) => event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Thousand Cuts'
    )
    .map((event) => event.at);
  const expected = [0, 0.517, 1.033, 1.55, 2.067, 2.6, 3.117, 3.633, 4.15, 4.667];
  const bloodsongTimes = result.events
    .filter((event) => event.type === 'resource' && event.reason === 'Bloodsong')
    .map((event) => event.at);

  assertEventTimes(damageTimes, expected, 'Thousand Cuts damage');
  assertEventTimes(bleedTimes, expected, 'Thousand Cuts bleeding');
  assertEventTimes(bloodsongTimes, [expected[4] + 0.0001, expected[9] + 0.0001], 'Thousand Cuts Bloodsong');
  assert.equal(result.endState.profession.resource, 2);
});

test('Unstable Bladestorm anchors paired packets to cast start', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Unstable Bladestorm', { name: '__wait', waitMs: 6000 }],
    defaultSimulationConfig({
      initialResource: 0,
      selectedTraitIds: [TRAIT.BLOODSONG, TRAIT.JAGGED_MIND],
      stats: {
        ...defaults.stats,
        precision: 4000
      }
    })
  );
  const expected = [1.16, 1.2, 2.16, 2.2, 3.16, 3.2, 4.16, 4.2];
  const damageTimes = result.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Unstable Bladestorm')
    .map((event) => event.at);
  const bleedTimes = result.resolvedEvents
    .filter(
      (event) =>
        event.type === 'condition' && event.condition === 'Bleeding' && event.skillName === 'Unstable Bladestorm'
    )
    .map((event) => event.at);
  const bloodsong = result.events.find((event) => event.type === 'resource' && event.reason === 'Bloodsong');

  assert.equal(result.steps[0].fullCastMs, 440);
  assertEventTimes(damageTimes, expected, 'Unstable Bladestorm damage');
  assertEventTimes(bleedTimes, expected, 'Unstable Bladestorm bleeding');
  assert.ok(Math.abs(bloodsong.at - 3.1601) < 1e-12);
  assert.equal(result.endState.profession.resource, 1);
});

test('Mesmer critical traits consume seeded hit outcomes in stochastic mode', () => {
  const defaults = defaultSimulationConfig();
  const rotation = [];

  for (let index = 0; index < 6; index += 1) {
    rotation.push('Flying Cutter');

    if (index < 5) rotation.push({ name: '__wait', waitMs: 5100 });
  }

  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.JAGGED_MIND, TRAIT.DEADLY_BLADES],
    stats: {
      ...defaults.stats,
      precision: 1945
    },
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
  const hits = stochastic.events.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');
  const criticals = hits.filter((event) => event.didCrit).length;
  const jaggedMind = stochastic.events.filter(
    (event) => event.type === 'condition' && event.name.includes('Jagged Mind')
  );
  const deadlyBlades = stochastic.events.filter(
    (event) =>
      event.type === 'condition' && event.condition === 'Vulnerability' && event.sourceSkill === 'Flying Cutter'
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

  assert.equal(expectedJaggedMind.length, hits.length);
  assert.ok(expectedJaggedMind.every((event) => event.stacks === 0.5));
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
        stats: {
          ...defaults.stats,
          precision: 4000
        },
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
      stats: {
        ...defaults.stats,
        precision: 4000
      },
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
  assert.ok(Math.abs(bloodsong.at - geomancy.at - 0.0001) < 1e-12);
  assert.equal(harmony.invalid, undefined);
});
