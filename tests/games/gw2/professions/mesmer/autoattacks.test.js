import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';

// Autoattack chains preserve their progression, resource effects, and interruption rules.
test('sword and spear autos apply their authored debuffs with or without Aristocracy', () => {
  // Actual conditions must exist without a relic; equipping Aristocracy consumes those same applications.
  for (const [weapon, rotation, expected] of [
    [
      'Sword',
      ['Mind Slash', 'Mind Gash'],
      [
        ['Mind Slash', 'Vulnerability', 1, 5],
        ['Mind Gash', 'Vulnerability', 1, 5]
      ]
    ],
    ['Spear', ['Psycut', 'Psystrike', 'Mind Pierce'], [['Mind Pierce', 'Weakness', 1, 2]]]
  ]) {
    for (const relic of ['', 'Aristocracy']) {
      const result = simulateMesmer(
        rotation,
        defaultSimulationConfig({
          specialization: 'Core',
          initialResource: 0,
          primaryWeapon: weapon,
          secondaryWeapon: '',
          relic
        })
      );
      assert.deepEqual(result.warnings, []);
      const conditions = result.events.filter((event) => event.type === 'condition');
      assert.deepEqual(
        conditions.map((event) => [event.skillName, event.condition, event.stacks, event.duration]),
        expected
      );
      for (const condition of conditions) {
        assert.equal(condition.actorType, 'player');
      }

      assert.equal(result.procSteps.filter((proc) => proc.skill === 'Relic of Aristocracy').length, relic ? 1 : 0);
    }
  }
});

test('Ether Bolt and Ether Blast do not generate clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Ether Bolt', 'Ether Blast'], config);

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Ether Bolt', 'Ether Blast']
  );
  assert.equal(result.planningState.profession.resource, 0);
});

test('Ether Clone creates a clone below cap and inflicts torment at cap', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const belowCap = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], { ...config, initialResource: 2 });
  assert.equal(belowCap.planningState.profession.resource, 3);
  const cloneGain = belowCap.events.find((event) => event.type === 'resource' && event.reason === 'Ether Clone');
  assert.ok(cloneGain);
  assert.equal(Math.round(cloneGain.at * 1000 - belowCap.steps[2].start), 440);
  assert.equal(
    belowCap.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    ),
    false
  );

  const atCap = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], {
    ...config,
    initialResource: 3
  });

  assert.equal(atCap.planningState.profession.resource, 3);
  assert.equal(
    atCap.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone'),
    false
  );
  const maximumCloneTorment = atCap.events.find(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Ether Clone' &&
      event.condition === 'Torment' &&
      event.duration === 9
  );
  assert.ok(maximumCloneTorment);
  assert.equal(Math.round(maximumCloneTorment.at * 1000 - atCap.steps[2].start), 440);
});

// Troubadour replaces a capped note reward with torment, while reaching the cap still grants only the note.
test('Ether Clone uses the note cap for Troubadour replacement torment', () => {
  for (const initialResource of [2, 3]) {
    const result = simulateMesmer(
      ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        primaryWeapon: 'Scepter',
        secondaryWeapon: 'Torch',
        initialResource
      })
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.notes.value, 3);
    const replacement = result.events.find(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    );
    assert.equal(Boolean(replacement), initialResource === 3);

    if (replacement) {
      assert.equal(replacement.duration, 9);
      assert.equal(replacement.stacks, 1);
    }

    assert.equal(
      result.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone'),
      initialResource === 2
    );
  }
});

test('Ether Clone resolves its at-cap outcome from clone count at projectile time', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 3
  });
  const resultAt = (offset) =>
    simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone', { name: 'Split Second', offset }], config);
  const freedBeforePacket = resultAt(400);
  const freedAfterPacket = resultAt(441);
  const hasCloneGain = (result) =>
    result.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone');
  const hasMaximumTorment = (result) =>
    result.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    );

  assert.equal(freedBeforePacket.planningState.profession.resource, 1);
  assert.equal(hasCloneGain(freedBeforePacket), true);
  assert.equal(hasMaximumTorment(freedBeforePacket), false);
  assert.equal(freedAfterPacket.planningState.profession.resource, 0);
  assert.equal(hasCloneGain(freedAfterPacket), false);
  assert.equal(hasMaximumTorment(freedAfterPacket), true);
});

test('autoattack chain steps unlock only after the preceding attack', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const locked = simulateMesmer(['Ether Blast', 'Ether Clone'], config);

  assert.equal(locked.steps.filter((step) => !step.invalid).length, 0);
  assert.match(locked.warnings[0].message, /cast Ether Bolt first/);

  const skippedStep = simulateMesmer(['Ether Bolt', 'Ether Clone'], config);

  assert.deepEqual(
    skippedStep.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Ether Bolt']
  );
  assert.equal(skippedStep.planningState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BLAST);
  assert.match(skippedStep.warnings[0].message, /cast Ether Blast first/);

  const completed = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], config);

  assert.equal(completed.planningState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
});

test('Scepter weapon skills preserve Ether Bolt chain progress', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Ether Bolt', 'Confusing Images', 'Ether Blast'], config);

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Ether Bolt', 'Confusing Images', 'Ether Blast']
  );
  assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_CLONE);
});

// Every skill category leaves either pending scepter step available, including long utility and healing casts.
test('scepter chains continue through intervening skills of every category', () => {
  for (const [specialization, skillId] of [
    ['Core', ID.SIGNET_OF_THE_ETHER],
    ['Core', ID.MANTRA_OF_PAIN],
    ['Core', ID.TIME_WARP],
    ['Chronomancer', ID.WELL_OF_CALAMITY],
    ['Troubadour', ID.TALE_OF_THE_SECOND_SCION],
    ['Core', ID.MIND_WRACK],
    ['Chronomancer', ID.SPLIT_SECOND],
    ['Virtuoso', ID.BLADESONG_HARMONY],
    ['Troubadour', ID.LIVELY_LUTE],
    ['Troubadour', ID.LIVELY_LUTE_ALTERNATE],
    ['Troubadour', ID.FLUSTERING_FLUTE],
    ['Troubadour', ID.DEAFENING_DRUM],
    ['Troubadour', ID.HARMONIOUS_HARP],
    ['Troubadour', ID.HARMONIOUS_HARP_ALTERNATE],
    ['Troubadour', ID.CRESCENDO]
  ]) {
    const config = defaultSimulationConfig({ specialization, initialResource: 3, primaryWeapon: 'Scepter' });
    const intervening = { type: 'cast', skillId };
    for (const [rotation, expected] of [
      [['Ether Bolt', intervening, 'Ether Blast'], ID.ETHER_CLONE],
      [['Ether Bolt', 'Ether Blast', intervening, 'Ether Clone'], ID.ETHER_BOLT]
    ]) {
      const result = simulateMesmer(rotation, config);
      assert.deepEqual(result.warnings, [], `${specialization}: ${skillId}`);
      assert.ok(result.steps.every((step) => !step.invalid));
      assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], expected);
    }
  }
});

// The measured 2.8-second approximation gates both planning state and the next accepted autoattack.
test('scepter chain expiry resets the pending step at the deadline', () => {
  const config = defaultSimulationConfig({ specialization: 'Core', primaryWeapon: 'Scepter', initialResource: 0 });
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  for (const [rotation, expected] of [
    [['Ether Bolt', wait(2799)], ID.ETHER_BLAST],
    [['Ether Bolt', wait(2800)], ID.ETHER_BOLT],
    [['Ether Bolt', 'Ether Blast', wait(2800)], ID.ETHER_BOLT],
    [['Ether Bolt', wait(2760), 'Ether Blast'], ID.ETHER_CLONE],
    [['Ether Bolt', wait(2800), 'Ether Bolt'], ID.ETHER_BLAST]
  ]) {
    const result = simulateMesmer(rotation, config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], expected);
  }

  const expired = simulateMesmer(['Ether Bolt', wait(2800), 'Ether Blast'], config);
  assert.match(expired.warnings[0].message, /cast Ether Bolt first/);
});

test('only scepter chain advancement refreshes its expiry', () => {
  const config = defaultSimulationConfig({ specialization: 'Core', primaryWeapon: 'Scepter', initialResource: 0 });
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  // A utility crossing the deadline cannot retain or renew the old chain; a new auto invalidates its old timer.
  for (const [rotation, expected] of [
    [['Ether Bolt', wait(2500), 'Signet of the Ether'], ID.ETHER_BOLT],
    [['Ether Bolt', wait(2000), 'Ether Blast', wait(800)], ID.ETHER_CLONE],
    [['Ether Bolt', 'Ether Blast', 'Ether Clone', 'Ether Bolt', wait(2000)], ID.ETHER_BLAST]
  ]) {
    const result = simulateMesmer(rotation, config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], expected);
  }
});

// Manual and automatic Continuum exits must leave the original scepter deadline running.
test('Continuum Split and Shift do not extend scepter chain expiry', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    initialResource: 0
  });
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  for (const [exit, elapsed] of [
    [[wait(1000), 'Continuum Shift'], 1000],
    [[wait(1500)], 1500]
  ]) {
    const prefix = ['Ether Bolt', wait(1000), 'Continuum Split', ...exit];
    for (const [delay, expected] of [
      [1799 - elapsed, ID.ETHER_BLAST],
      [1800 - elapsed, ID.ETHER_BOLT]
    ]) {
      const result = simulateMesmer([...prefix, wait(delay)], config);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.planningState.profession.continuumActive, false);
      assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], expected);
    }
  }
});

// Rewinding a checkpoint cannot resurrect expired progress or undo autos completed inside the window.
test('Continuum Shift preserves live scepter progression and its latest expiry', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    initialResource: 3
  });
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  for (const [rotation, expected] of [
    [['Ether Bolt', 'Continuum Split', wait(3000), 'Continuum Shift'], ID.ETHER_BOLT],
    [['Ether Bolt', 'Continuum Split', 'Ether Blast', 'Ether Clone', 'Continuum Shift'], ID.ETHER_BOLT],
    [['Ether Bolt', 'Continuum Split', wait(2000), 'Ether Blast', 'Continuum Shift', wait(2799)], ID.ETHER_CLONE],
    [['Ether Bolt', 'Continuum Split', wait(2000), 'Ether Blast', 'Continuum Shift', wait(2800)], ID.ETHER_BOLT],
    [['Continuum Split', 'Ether Bolt', 'Continuum Shift'], ID.ETHER_BLAST]
  ]) {
    const result = simulateMesmer(rotation, config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.autoattackChains[ID.ETHER_BOLT], expected);
  }
});

test('Imaginary Axes preserves the axe auto chain but other skills reset it', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    initialResource: 0,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Pistol'
  });
  const preserved = simulateMesmer(
    ['Lacerating Chop', 'Dodge / Mirage Cloak', 'Imaginary Axes', 'Ethereal Chop'],
    config
  );

  assert.deepEqual(
    preserved.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Lacerating Chop', 'Dodge / Mirage Cloak', 'Imaginary Axes', 'Ethereal Chop']
  );
  assert.equal(preserved.planningState.profession.autoattackChains[ID.LACERATING_CHOP], ID.MIRROR_STRIKES);

  const interrupted = simulateMesmer(['Lacerating Chop', 'Lingering Thoughts', 'Ethereal Chop'], config);

  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Lacerating Chop', 'Lingering Thoughts']
  );
  assert.equal(interrupted.planningState.profession.autoattackChains[ID.LACERATING_CHOP], ID.LACERATING_CHOP);
  assert.match(interrupted.warnings[0].message, /cast Lacerating Chop first/);
});

test('other auto chains reset on weapon skills and every chain resets on swap', () => {
  const swordConfig = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const interrupted = simulateMesmer(['Mind Slash', 'Blurred Frenzy', 'Mind Gash'], swordConfig);

  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Mind Slash', 'Blurred Frenzy']
  );
  assert.equal(interrupted.planningState.profession.autoattackChains[ID.MIND_SLASH], ID.MIND_SLASH);

  const scepterConfig = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const swapped = simulateMesmer(['Ether Bolt', 'Swap Weapons', 'Ether Blast'], scepterConfig);

  assert.deepEqual(
    swapped.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Ether Bolt', 'Swap Weapons']
  );
  assert.equal(swapped.planningState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
});

test('short utility casts preserve spear autoattack-chain progress', () => {
  const result = simulateMesmer(
    ['Psycut', 'Well of Eternity', 'Psystrike'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedSkillIds: [30305]
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Well of Eternity', 'Psystrike']
  );
});

test('an interrupted Troubadour instrument still resets the spear autoattack chain', () => {
  const result = simulateMesmer(
    ['Psycut', { type: 'cast', skillId: ID.HARMONIOUS_HARP_ALTERNATE, interruptAfterMs: 480 }, 'Psycut'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Harmonious Harp', 'Psycut']
  );
});

test('an interrupted spear autoattack leaves the same chain step active', () => {
  const result = simulateMesmer(
    ['Psycut', { type: 'cast', skillId: ID.PSYSTRIKE, interruptAfterMs: 132 }, 'Psystrike'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Psystrike', 'Psystrike']
  );
  assert.equal(result.steps[1].interrupted, true);
});

test('a long utility cast resets ordinary spear autoattack-chain progress', () => {
  const result = simulateMesmer(
    ['Psycut', 'Well of Calamity', 'Psycut'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedSkillIds: [30525]
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Well of Calamity', 'Psycut']
  );
});

test('sword, scepter, axe, and spear auto chains cast as separate attacks', () => {
  const chain = [
    'Mind Slash',
    'Mind Gash',
    'Mind Spike',
    'Ether Bolt',
    'Ether Blast',
    'Ether Clone',
    'Lacerating Chop',
    'Ethereal Chop',
    'Mirror Strikes',
    'Psycut',
    'Psystrike',
    'Mind Pierce'
  ];
  const result = simulateMesmer(
    chain,
    defaultSimulationConfig({
      specialization: 'Mirage',
      initialResource: 0,
      primaryWeapon: '',
      secondaryWeapon: '',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    })
  );

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    chain
  );
  assert.equal(result.casts.length, chain.length);
});

test('clone attack selection returns the next cadence and ignores destroyed clones', () => {
  // Capture the production scheduling callback so only dispatched tasks emit attacks and advance cadence.
  const state = {
    config: { primaryWeapon: 'Sword' },
    activeWeaponSet: 1,
    helpers: { skillsById: new Map(), skillsByName: new Map() },
    profession: { core: { clones: [] } }
  };
  const damage = [];
  const conditions = [];
  const tasks = [];
  state.effects = captureEffectEmissions({
    submit: (event) => {
      (event.type === 'damage' ? damage : conditions).push(event);
      return event;
    }
  }).effects;
  const scheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: {
      Sword: {
        id: 123,
        coefficient: 1,
        hits: 1,
        interval: 2,
        weaponStrength: 20,
        conditions: [{ type: 'condition', condition: 'Bleeding', duration: 1, stacks: 1 }]
      }
    },
    scheduleTask: (clone, at) => tasks.push({ cloneId: clone.id, at })
  });

  state.profession.core.clones.push(
    scheduler.initializeClone({
      id: 1,
      createdAt: 1,
      weapon: 'Sword'
    })
  );

  assert.deepEqual(tasks, [{ cloneId: 1, at: 3 }]);
  assert.equal(damage.length, 0);
  const first = tasks.shift();
  const nextAt = scheduler.handleTask(first.cloneId, first.at);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.equal(nextAt, 5);
  state.profession.core.clones.length = 0;
  assert.equal(scheduler.handleTask(first.cloneId, nextAt), null);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.deepEqual(tasks, []);
});
