import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';

// Autoattack chains preserve their progression, resource effects, and interruption rules.
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
  assert.equal(result.endState.profession.resource, 0);
});

test('Ether Clone creates a clone below cap and inflicts torment at cap', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const belowCap = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], { ...config, initialResource: 2 });

  assert.equal(belowCap.steps[2].end - belowCap.steps[2].start, 840);
  assert.equal(belowCap.endState.profession.resource, 3);
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

  assert.equal(atCap.endState.profession.resource, 3);
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

test('Ether Clone resolves its at-cap outcome from clone count at projectile time', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 3
  });
  const resultAt = (offset) =>
    simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone', { name: 'Split Second', offset }], config);
  const freedBeforePacket = resultAt(439);
  const freedAfterPacket = resultAt(441);
  const hasCloneGain = (result) =>
    result.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone');
  const hasMaximumTorment = (result) =>
    result.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    );

  assert.equal(freedBeforePacket.endState.profession.resource, 1);
  assert.equal(hasCloneGain(freedBeforePacket), true);
  assert.equal(hasMaximumTorment(freedBeforePacket), false);
  assert.equal(freedAfterPacket.endState.profession.resource, 0);
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
  assert.match(locked.warnings[0], /cast Ether Bolt first/);

  const skippedStep = simulateMesmer(['Ether Bolt', 'Ether Clone'], config);

  assert.deepEqual(
    skippedStep.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Ether Bolt']
  );
  assert.equal(skippedStep.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BLAST);
  assert.match(skippedStep.warnings[0], /cast Ether Blast first/);

  const completed = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], config);

  assert.equal(completed.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
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
  assert.equal(result.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_CLONE);
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
  assert.equal(preserved.endState.profession.autoattackChains[ID.LACERATING_CHOP], ID.MIRROR_STRIKES);

  const interrupted = simulateMesmer(['Lacerating Chop', 'Lingering Thoughts', 'Ethereal Chop'], config);

  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Lacerating Chop', 'Lingering Thoughts']
  );
  assert.equal(interrupted.endState.profession.autoattackChains[ID.LACERATING_CHOP], ID.LACERATING_CHOP);
  assert.match(interrupted.warnings[0], /cast Lacerating Chop first/);
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
  assert.equal(interrupted.endState.profession.autoattackChains[ID.MIND_SLASH], ID.MIND_SLASH);

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
  assert.equal(swapped.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
});

test('short utility casts preserve spear autoattack-chain progress', () => {
  const result = simulateMesmer(
    ['Psycut', 'Well of Eternity', 'Psystrike'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedSkills: ['Well of Eternity']
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
      selectedSkills: ['Well of Calamity']
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

test('split autoattacks preserve each full-chain cadence', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    initialResource: 0,
    primaryWeapon: '',
    secondaryWeapon: '',
    weaponSet2Primary: '',
    weaponSet2Secondary: '',
    boons: {
      ...defaultSimulationConfig().boons,
      quickness: false
    }
  });
  const chains = [
    [['Mind Slash', 'Mind Gash', 'Mind Spike'], 2580],
    [['Ether Bolt', 'Ether Blast', 'Ether Clone'], 2700],
    [['Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes'], 2520],
    [['Psycut', 'Psystrike', 'Mind Pierce'], 2220]
  ];

  for (const [skills, expectedTime] of chains) {
    assert.equal(simulateMesmer(skills, config).endState.time, expectedTime);
  }
});

test('clone attack tasks rearm on dispatch and ignore destroyed clones', () => {
  // Capture the production scheduling callback so only dispatched tasks emit attacks and advance cadence.
  const state = { clones: [] };
  const damage = [];
  const conditions = [];
  const tasks = [];
  const scheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: {
      Sword: {
        coefficient: 1,
        hits: 1,
        interval: 2,
        weaponStrength: 20,
        conditions: [{ name: 'Bleeding', duration: 1, stacks: 1 }]
      }
    },
    addDamage: (...args) => damage.push(args),
    addCondition: (...args) => conditions.push(args),
    scheduleTask: (clone, at) => tasks.push({ cloneId: clone.id, at })
  });

  state.clones.push(
    scheduler.initializeClone({
      id: 1,
      createdAt: 1,
      weapon: 'Sword'
    })
  );

  assert.deepEqual(tasks, [{ cloneId: 1, at: 3 }]);
  assert.equal(damage.length, 0);
  const first = tasks.shift();
  scheduler.handleTask(first.cloneId, first.at);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.deepEqual(tasks, [{ cloneId: 1, at: 5 }]);
  state.clones.length = 0;
  const next = tasks.shift();
  scheduler.handleTask(next.cloneId, next.at);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.deepEqual(tasks, []);
});
