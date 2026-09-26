import { runtimeFor } from '#tests/helpers/live-runtime.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Weapon skills retain their Clarity, packet, and follow-up behavior across Mesmer specializations.
test('The Prestige blasts the active field with its delayed burning explosion', () => {
  const result = simulateMesmer(
    ['Chaos Storm', 'Swap Weapons', 'The Prestige', { type: 'wait', durationMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      weaponSet2Primary: 'Scepter',
      weaponSet2Secondary: 'Torch'
    })
  );
  assert.deepEqual(result.warnings, []);
  const burning = result.events.find(
    (event) => event.type === 'condition' && event.skillId === ID.THE_PRESTIGE && event.condition === 'Burning'
  );
  const blasts = result.events.filter((event) => event.type === 'combo_finisher' && event.skillId === ID.THE_PRESTIGE);
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].finisherType, 'Blast');
  assert.equal(blasts[0].at, burning.at);
});

test('Mental Collapse resets Mind the Gap cooldown', () => {
  const result = simulateMesmer(
    ['Mind the Gap', 'Mental Collapse', 'Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps.length, 3);
  assert.ok(Math.abs(result.steps[2].start - result.steps[1].end) <= 1);
  const resetOnly = simulateMesmer(
    ['Mind the Gap', 'Mental Collapse'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(resetOnly.planningState.cooldowns['Mind the Gap'], undefined);
});

// A shatter on the impact frame consumes existing clones before the attack's deferred clone arrives.
test('Mind the Gap preserves its deferred clone when shattering on its impact frame', () => {
  const result = simulateMesmer(
    ['Mind the Gap', { name: 'Mind Wrack', offset: 480 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 3,
      selectedTraitIds: [TRAIT.DUNE_CLOAK]
    })
  );
  assert.equal(result.planningState.profession.resource, 1);
  assert.deepEqual(result.warnings, []);
});

test('Mind the Gap grants 15 seconds of Clarity and displays it as a skill proc', () => {
  const result = simulateMesmer(
    ['Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.planningState.profession.clarityRemaining, 15000);
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.skill === 'Clarity' &&
        proc.type === 'skill_proc' &&
        proc.sourceSkill === 'Mind the Gap' &&
        proc.icon.includes('Clarity.png')
    )
  );
});

test('Mesmer spear skills 3, 4, and 5 consume Clarity', () => {
  for (const consumer of ['Imaginary Inversion', 'Phantasmal Lancer', 'Mental Collapse']) {
    const result = simulateMesmer(
      ['Mind the Gap', consumer],
      defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: ''
      })
    );

    assert.equal(result.planningState.profession.clarityRemaining, 0, consumer);
  }
});

test('Clarity makes Phantasmal Lancer summon and attack with a second phantasm', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialResource: 0
  });
  const normal = simulateMesmer(['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }], config);
  const empowered = simulateMesmer(['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 3000 }], config);

  assert.equal(
    normal.events.find((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Lancer')
      ?.count,
    1
  );
  assert.equal(
    empowered.events.find((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Lancer')
      ?.count,
    2
  );
  assert.equal(
    normal.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
    ).length,
    1
  );
  assert.equal(
    empowered.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
    ).length,
    2
  );
  const coefficientBySource = (result) =>
    Object.fromEntries(
      ['Player', 'Phantasm'].map((source) => [
        source,
        result.resolvedEvents
          .filter(
            (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === source
          )
          .reduce((sum, event) => sum + event.coefficient, 0)
      ])
    );

  assert.deepEqual(coefficientBySource(normal), {
    Player: 1,
    Phantasm: 0.6
  });
  assert.deepEqual(coefficientBySource(empowered), {
    Player: 1,
    Phantasm: 1.2
  });
});

test('Flying Cutter and Unstable Bladestorm remain available outside Virtuoso', () => {
  const result = simulateMesmer(
    ['Flying Cutter', 'Unstable Bladestorm'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Dagger',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.name),
    ['Flying Cutter', 'Unstable Bladestorm']
  );
  assert.equal(result.warnings.length, 0);
});

test('Flying Cutter tracks three hits for five seconds and Bladecall strikes six times', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.JAGGED_MIND],
    stats: {
      ...defaults.stats,
      precision: 3100
    }
  });
  const consecutive = simulateMesmer(
    ['Flying Cutter', 'Flying Cutter', 'Flying Cutter', { name: '__wait', waitMs: 1500 }],
    config
  );
  const burst = consecutive.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst');

  assert.equal(burst.length, 3);
  assert.ok(
    burst.every(
      (event) =>
        event.skillName === 'Cutter Burst' &&
        event.parentSkillName === 'Flying Cutter' &&
        event.sourceId === ID.CUTTER_BURST &&
        event.skillId === ID.CUTTER_BURST
    )
  );
  assert.ok(Math.abs(burst.reduce((sum, event) => sum + event.coefficient, 0) - 0.6) < 1e-12);
  const skillRows = skillBreakdownRows(consecutive);
  const flyingCutterRow = skillRows.find((row) => row.name === 'Flying Cutter');
  const cutterBurstRow = skillRows.find((row) => row.name === 'Cutter Burst');

  assert.ok(flyingCutterRow.strike > 0);
  assert.ok(cutterBurstRow.strike > 0);
  assert.ok(flyingCutterRow.condition > 0);
  assert.ok(cutterBurstRow.condition > 0);
  assert.equal(flyingCutterRow.hits, 3);
  assert.equal(cutterBurstRow.hits, 3);
  assert.equal(flyingCutterRow.casts, 3);
  assert.equal(cutterBurstRow.casts, 0);
  assert.equal(cutterBurstRow.parentSkill, 'Flying Cutter');
  const triggerAt = consecutive.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter' && event.name !== 'Cutter Burst')
    .at(-1).at;

  assert.deepEqual(
    burst.map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.2, 0.24, 0.4]
  );
  assert.deepEqual(
    consecutive.resolvedEvents
      .filter((event) => event.type === 'condition' && event.name === 'Cutter Burst — Jagged Mind')
      .map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.2, 0.24, 0.4]
  );

  const expired = simulateMesmer(
    ['Flying Cutter', { name: '__wait', waitMs: 5001 }, 'Flying Cutter', 'Flying Cutter'],
    config
  );

  assert.equal(
    expired.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst').length,
    0
  );

  const bladecall = simulateMesmer(['Bladecall', { name: '__wait', waitMs: 3000 }], config);
  const bladecallHits = bladecall.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Bladecall'
  );

  assert.equal(bladecallHits.length, 6);
  assert.ok(Math.abs(bladecallHits.reduce((sum, event) => sum + event.coefficient, 0) - 1.5) < 1e-12);
  assert.deepEqual(
    bladecallHits.map((event) => Number(event.at.toFixed(3))),
    [0.2, 0.2, 0.2, 2.72, 2.72, 2.76]
  );
  assert.deepEqual(
    bladecall.resolvedEvents
      .filter(
        (event) => event.type === 'condition' && event.skillName === 'Bladecall' && event.sourceId === TRAIT.JAGGED_MIND
      )
      .map((event) => Number(event.at.toFixed(3))),
    [0.2, 0.2, 0.2, 2.72, 2.72, 2.76]
  );
});

test('Phantasmal Duelist uses eight timed unload and bleeding packets', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [],
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const times = (source) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === source)
      .map((event) => Number(event.at.toFixed(3)));

  assert.deepEqual(times('Player'), [0.36, 0.36, 0.4]);
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === 'Player'
      )
      .map((event) => event.coefficient),
    [0.33, 0.33, 0.33]
  );
  assert.deepEqual(times('Phantasm'), [1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8]);
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === 'Phantasm'
      )
      .every((event) => Math.abs(event.coefficient - 0.115) < 1e-12)
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Phantasmal Duelist' && event.condition === 'Bleeding'
      )
      .map((event) => Number(event.at.toFixed(3))),
    [1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8]
  );
});

test('Clarity makes only an empowered Mental Collapse a control skill', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  });
  const normal = simulateMesmer(['Mental Collapse'], config);
  const empowered = simulateMesmer(['Mind the Gap', 'Mental Collapse'], config);
  const activeNearExpiry = simulateMesmer(
    ['Mind the Gap', { name: '__wait', waitMs: 14999 }, 'Mental Collapse'],
    config
  );
  const expired = simulateMesmer(['Mind the Gap', { name: '__wait', waitMs: 15000 }, 'Mental Collapse'], config);
  const hasMentalCollapseControl = (result) =>
    result.events.some((event) => event.type === 'control' && event.skillName === 'Mental Collapse');

  assert.equal(hasMentalCollapseControl(normal), false);
  assert.equal(hasMentalCollapseControl(empowered), true);
  assert.equal(hasMentalCollapseControl(activeNearExpiry), true);
  assert.equal(hasMentalCollapseControl(expired), false);
});

test('Illusionary Counter arms one Counterspell without generating clones itself', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const counter = simulateMesmer(['Illusionary Counter'], config);

  assert.equal(counter.steps[0].end, 120);
  assert.equal(counter.steps[0].interrupted, true);

  assert.equal(
    counter.breakdown.some((entry) => entry.name === 'Illusionary Counter'),
    false
  );
  assert.equal(counter.planningState.profession.resource, 0);
  assert.ok(counter.planningState.profession.availableFlips[ID.COUNTERSPELL]);
  assert.equal(
    counter.resolvedEvents.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Illusionary Counter' && event.condition === 'Torment'
    ),
    false
  );

  const unavailable = simulateMesmer(['Counterspell'], config);

  assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0);
  assert.match(unavailable.warnings[0], /Illusionary Counter is not active/);

  const flipped = simulateMesmer(['Illusionary Counter', 'Counterspell', 'Counterspell'], config);

  assert.equal(flipped.steps.filter((step) => !step.invalid).length, 2);
  assert.equal(flipped.steps[1].start, 120);
  assert.equal(flipped.planningState.profession.resource, 1);
  assert.equal(flipped.planningState.profession.availableFlips[ID.COUNTERSPELL], undefined);
  assert.ok(flipped.breakdown.some((entry) => entry.sourceSkill === 'Counterspell'));

  const interrupted = simulateMesmer(
    ['Illusionary Counter', { name: 'Counterspell', interruptMs: 360 }, 'Swap Weapons'],
    config
  );
  const counterspell = interrupted.steps.find((step) => step.skill === 'Counterspell');

  assert.equal(counterspell.end - counterspell.start, 360);
  assert.equal(interrupted.steps.find((step) => step.skill === 'Swap Weapons').start, counterspell.end);
  assert.equal(interrupted.planningState.profession.resource, 1);
  assert.ok(
    interrupted.resolvedEvents.some(
      (event) => event.type === 'condition' && event.skillName === 'Counterspell' && event.condition === 'Confusion'
    )
  );
});

test('requested weapon flips require and consume their parent sequence skill', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: '',
    secondaryWeapon: '',
    weaponSet2Primary: '',
    weaponSet2Secondary: ''
  });
  const pairs = [
    ['Singularity Shot', 'Dimensional Aperture'],
    ['Inspiring Imagery', 'Abstraction'],
    ['Temporal Curtain', 'Into the Void'],
    ['Illusionary Riposte', 'Counter Blade'],
    ['Illusionary Leap', 'Swap']
  ];

  for (const [parent, flip] of pairs) {
    const unavailable = simulateMesmer([flip], config);

    assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0, flip);
    assert.match(unavailable.warnings[0], new RegExp(parent), flip);

    const result = simulateMesmer([parent, flip, flip], config);

    assert.deepEqual(
      result.steps.filter((step) => !step.invalid).map((step) => step.skill),
      [parent, flip],
      flip
    );
    assert.equal(
      result.planningState.profession.availableFlips[mesmerCatalog.skillsByName.get(flip).id],
      undefined,
      flip
    );
  }
});

test('Illusionary Riposte defaults to a 120ms interrupt before Counter Blade', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Illusionary Riposte', 'Counter Blade'], config);

  assert.equal(result.steps[0].end, 120);
  assert.equal(result.steps[0].interrupted, true);

  assert.equal(result.steps[1].start, 120);
});

test('Into the Void waits for its one-second post-curtain delay', () => {
  const result = simulateMesmer(
    ['Temporal Curtain', 'Into the Void'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: '',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[1].start, 1000);
});

test('Dimensional Aperture adds 50% to Singularity Shot recharge', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: '',
    secondaryWeapon: ''
  });
  const base = simulateMesmer(['Singularity Shot'], config);
  const aperture = simulateMesmer(['Singularity Shot', 'Dimensional Aperture'], config);

  assert.equal(base.planningState.cooldowns['Singularity Shot'].readyAt, 16360);
  assert.equal(aperture.planningState.cooldowns['Singularity Shot'].readyAt, 24360);
});

// The image's natural expiry and early detonation must remain mutually exclusive.
test('Inspiring Imagery grants boons at field expiry and closes Abstraction', () => {
  const result = simulateMesmer(
    ['Inspiring Imagery', { name: '__wait', waitMs: 2000 }, 'Abstraction'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Rifle',
      secondaryWeapon: '',
      boons: { quickness: false, alacrity: false },
      stats: { concentration: 0 }
    })
  );
  const cast = result.steps[0];
  const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === ID.INSPIRING_IMAGERY);
  const boons = result.events.filter((event) => event.type === 'buff' && event.skillId === ID.INSPIRING_IMAGERY);

  assert.equal(field.at, cast.end / 1000);
  assert.equal(field.fieldType, 'Ethereal');
  assert.equal(field.expiresAt - field.at, 2);
  assert.deepEqual(
    boons.map((event) => [event.at, event.kind, event.stacks, event.duration]),
    [
      [field.expiresAt, 'might', 12, 9],
      [field.expiresAt, 'fury', 1, 9]
    ]
  );
  assert.equal(result.planningState.cooldowns['Inspiring Imagery'].readyAt, Math.ceil((cast.end + 12000) / 40) * 40);
  assert.equal(result.steps.at(-1).invalid, true);
  assert.match(result.warnings[0], /Inspiring Imagery is not active/);
});

test('Abstraction replaces boons with damage and conditions and blasts only its image', () => {
  for (const waitMs of [0, 1700]) {
    const result = simulateMesmer(
      ['Feedback', 'Inspiring Imagery', { name: '__wait', waitMs }, 'Abstraction', { name: '__wait', waitMs: 3000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Rifle',
        secondaryWeapon: '',
        boons: { quickness: false, alacrity: false },
        stats: { concentration: 0, expertise: 0 },
        target: { conditions: {} }
      })
    );
    const cast = result.steps.find((step) => step.skill === 'Abstraction');
    const events = result.events.filter((event) => event.skillId === ID.ABSTRACTION);
    const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === ID.INSPIRING_IMAGERY);
    assert.equal(cast.invalid, undefined);
    assert.equal(events.find((event) => event.type === 'damage').coefficient, 1.81);
    assert.deepEqual(
      events.filter((event) => event.type === 'condition').map((event) => [event.condition, event.duration]),
      [
        ['Weakness', 5],
        ['Blinded', 5]
      ]
    );
    assert.equal(
      result.events.some((event) => event.type === 'buff' && event.skillId === ID.INSPIRING_IMAGERY),
      false
    );
    assert.equal(runtimeFor(result).combo.fields.get(field.fieldId).expiresAt, cast.start / 1000);
    const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillId === ID.ABSTRACTION);
    assert.equal(combo.fieldId, field.fieldId);
    assert.equal(combo.finisherType, 'Blast');
    assert.deepEqual(result.warnings, []);
  }
});

test('cancelled Inspiring Imagery creates neither a field nor boons', () => {
  const result = simulateMesmer(
    [
      { name: 'Inspiring Imagery', interruptMs: 100 },
      { name: '__wait', waitMs: 3000 }
    ],
    defaultSimulationConfig({ specialization: 'Core', primaryWeapon: 'Rifle', secondaryWeapon: '' })
  );
  assert.equal(
    result.events.some(
      (event) => event.skillId === ID.INSPIRING_IMAGERY && ['combo_field', 'buff'].includes(event.type)
    ),
    false
  );
  assert.equal(result.planningState.profession.availableFlips[ID.ABSTRACTION], undefined);
});

test('The Prestige has a 40ms quickness activation and explodes 3s later', () => {
  const result = simulateMesmer(
    ['The Prestige', { name: '__wait', waitMs: 3100 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const cast = result.steps.find((step) => step.skill === 'The Prestige');
  const strike = result.events.find((event) => event.type === 'damage' && event.skillName === 'The Prestige');
  const burning = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'The Prestige' && event.condition === 'Burning'
  );

  assert.equal(cast.end - cast.start, 40);
  assert.equal(strike.at * 1000 - cast.start, 3000);
  assert.equal(burning.at, strike.at);
});
