import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

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

  assert.equal(resetOnly.planningState.cooldowns[ID.MIND_THE_GAP], undefined);
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
  assert.equal(result.planningState.profession[STATE.RESOURCE], 1);
  assert.deepEqual(result.warnings, []);
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

    assert.equal(result.planningState.profession[STATE.CLARITY_REMAINING], 0, consumer);
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

test('Clarity makes only an empowered Mental Collapse a control skill', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  });
  const normal = simulateMesmer(['Mental Collapse'], config);
  const empowered = simulateMesmer(['Mind the Gap', 'Mental Collapse'], config);
  const activeNearExpiry = simulateMesmer(
    ['Mind the Gap', { name: '__wait', waitMs: 14960 }, 'Mental Collapse'],
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
  assert.equal(counter.steps[0].interrupted, true);

  assert.equal(
    counter.breakdown.some((entry) => entry.name === 'Illusionary Counter'),
    false
  );
  assert.equal(counter.planningState.profession[STATE.RESOURCE], 0);
  assert.ok(counter.planningState.profession[STATE.AVAILABLE_FLIPS][ID.COUNTERSPELL]);
  assert.equal(
    counter.resolvedEvents.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Illusionary Counter' && event.condition === 'Torment'
    ),
    false
  );

  const unavailable = simulateMesmer(['Counterspell'], config);

  assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0);
  assert.match(unavailable.warnings[0].message, /Illusionary Counter is not active/);

  const flipped = simulateMesmer(['Illusionary Counter', 'Counterspell', 'Counterspell'], config);

  assert.equal(flipped.steps.filter((step) => !step.invalid).length, 2);
  assert.equal(flipped.planningState.profession[STATE.RESOURCE], 1);
  assert.equal(flipped.planningState.profession[STATE.AVAILABLE_FLIPS][ID.COUNTERSPELL], undefined);
  assert.ok(flipped.breakdown.some((entry) => entry.sourceSkill === 'Counterspell'));

  const interrupted = simulateMesmer(
    ['Illusionary Counter', { name: 'Counterspell', interruptMs: 360 }, 'Swap Weapons'],
    config
  );
  assert.equal(interrupted.planningState.profession[STATE.RESOURCE], 1);
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
    assert.match(unavailable.warnings[0].message, new RegExp(parent), flip);

    const result = simulateMesmer([parent, flip, flip], config);

    assert.deepEqual(
      result.steps.filter((step) => !step.invalid).map((step) => step.skill),
      [parent, flip],
      flip
    );
    assert.equal(
      result.planningState.profession[STATE.AVAILABLE_FLIPS][
        mesmerCatalog.skills.find((candidate) => candidate.name === flip).id
      ],
      undefined,
      flip
    );
  }
});

// Both an early release and a full block window must arm the flip without inventing an incoming attack.
test('Illusionary Riposte enables Counter Blade without block rewards', () => {
  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    for (const interruptAfterMs of [undefined, mesmerCatalog.skillsById.get(ID.ILLUSIONARY_RIPOSTE).castTimeMs]) {
      const result = simulateMesmer(
        [{ type: 'cast', skillId: ID.ILLUSIONARY_RIPOSTE, interruptAfterMs }, 'Counter Blade'],
        { specialization, primaryWeapon: 'Sword', secondaryWeapon: 'Sword', initialResource: 0 }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        specialization === 'Virtuoso'
          ? result.planningState.profession[STATE.BLADES].value
          : specialization === 'Troubadour'
            ? result.planningState.profession[STATE.NOTES].value
            : result.planningState.profession[STATE.RESOURCE],
        0
      );
      assert.ok(result.steps.some((step) => step.skill === 'Counter Blade' && !step.invalid));
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.ILLUSIONARY_RIPOSTE),
        false
      );
    }
  }
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
      attributeInputs: baseAttributeInputs({ concentration: 0 })
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
  assert.equal(result.planningState.cooldowns[ID.INSPIRING_IMAGERY].readyAt, Math.ceil((cast.end + 9600) / 40) * 40);
  assert.equal(result.steps.at(-1).invalid, true);
  assert.match(result.warnings[0].message, /Inspiring Imagery is not active/);
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
        attributeInputs: baseAttributeInputs({ concentration: 0, expertise: 0 }),
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
        ['Blindness', 5]
      ]
    );
    assert.equal(
      result.events.some((event) => event.type === 'buff' && event.skillId === ID.INSPIRING_IMAGERY),
      false
    );
    assert.equal(observedRuntime(result).combo.fields.get(field.fieldId).expiresAt, cast.start / 1000);
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
  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.ABSTRACTION], undefined);
});

// The delayed explosion uses its authored cast-start offset and keeps Burning on the same impact.
test('The Prestige schedules its delayed strike and Burning together', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    initialResource: 0
  });
  const native = mesmerProfession.runtimeFor(config);
  const skill = native.catalog.skillsById.get(ID.THE_PRESTIGE);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, skill.id, {
        effects: skill.effects.map((effect) =>
          effect.type === 'strike' || effect.type === 'condition' ? { ...effect, atMs: 1200 } : effect
        )
      })
    },
    config,
    rotation: [skill.name, { type: 'wait', durationMs: 1600 }]
  });
  const cast = result.steps[0];
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === skill.id);
  const burning = result.events.find(
    (event) => event.type === 'condition' && event.skillId === skill.id && event.condition === 'Burning'
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(strike.at * 1000 - cast.start), 1200);
  assert.equal(burning.at, strike.at);
});
