import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeGw2Combat, simulateGw2 } from '#gw2/platform/index.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { optimizeRotation } from '#gw2/app/optimizer/rotation/search.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { getRotationItems } from '#gw2/app/import-export/files.js';

const config = {
  specialization: 'Luminary',
  primaryWeapon: 'Spear',
  secondaryWeapon: '',
  weaponSet2Primary: 'Greatsword',
  weaponSet2Secondary: '',
  selectedSkills: ['Litany of Wrath', 'Sword of Justice', 'Purging Flames', 'Piercing Stance', 'Daring Advance'],
  selectedTraitIds: [],
  stats: { power: 2000, precision: 1600, ferocity: 500, conditionDamage: 1000 },
  target: { armor: 2597, health: Number.MAX_SAFE_INTEGER, conditions: { Vulnerability: 25 } },
  randomness: { mode: 'stochastic', seed: 11 }
};
const create = (overrides = {}, durationMs = 8000) =>
  initializeGw2Combat({ profession: guardianProfession, config: { ...config, ...overrides }, durationMs });
const id = (name) => guardianProfession.catalog.skillsByName.get(name).id;
const legal = (session, name) =>
  session.actions().find((action) => action.type === 'cast' && action.skillId === id(name));
const cast = (session, name) => {
  for (let index = 0; index < 1000; index++) {
    const action = legal(session, name);
    if (action) {
      session.apply(action);
      return;
    }

    const wait = session.actions().find((action) => action.type === 'wait');
    assert.ok(wait, `No opportunity to cast ${name}`);
    session.apply(wait);
  }

  assert.fail(`Could not cast ${name}`);
};

const finish = (session) => {
  if (!session.done) session.apply({ type: 'wait', durationMs: 8000 - session.time * 1000 });
};

// Minimal rotations exercise continuation contracts, without numerical expectations from a saved benchmark.
test('incremental execution and importer replay agree, including concurrent virtues and the full window', () => {
  const session = create();
  cast(session, 'Helio Rush');
  cast(session, 'Radiant Justice');
  cast(session, 'Solar Storm');
  cast(session, 'Sword of Justice');
  finish(session);
  const imported = normalizeRotation(
    getRotationItems(JSON.parse(JSON.stringify({ rotation: [{ type: 'combat-start' }, ...session.rotation()] }))),
    guardianProfession.catalog,
    { strict: true }
  );
  const replay = simulateGw2({ profession: guardianProfession, config, rotation: imported });
  assert.equal(session.score().totalDamage, replay.totalDamage);
  assert.equal(session.score().rotationEndTime, replay.rotationEndTime);
  assert.equal(replay.observationEndTime, 8);
  assert.deepEqual(replay.warnings, []);
  assert.equal(session.observe().activeWeaponSet, replay.planningState.activeWeaponSet);
});

test('snapshot restores an in-flight forge equip, private cast facts, delayed packets and RNG positions', () => {
  const session = create();
  cast(session, 'Enter Radiant Forge');
  cast(session, 'Dazzling Hammer');
  const checkpointTime = session.time;
  const checkpoint = session.snapshot();
  const branch = checkpoint.resume();
  cast(session, 'Radiant Justice');
  cast(branch, 'Radiant Justice');
  finish(session);
  finish(branch);
  assert.equal(branch.score().totalDamage, session.score().totalDamage);
  assert.equal(branch.observe().profession.radiantWeapon, session.observe().profession.radiantWeapon);
  assert.ok(branch.observe().profession.radiantWeaponsUsed.hammer);
  const replay = simulateGw2({
    profession: guardianProfession,
    config,
    rotation: branch.rotation(),
    combatStartTime: 0,
    observationPolicy: { kind: 'absolute', endTimeMs: 8000 }
  });
  assert.equal(branch.score().totalDamage, replay.totalDamage);
  assert.deepEqual(replay.warnings, []);
  assert.equal(checkpoint.resume().time, checkpointTime);
});

test('branches isolate summons, conditions, cooldowns, observations and subsequent parent mutations', () => {
  const session = create();
  cast(session, 'Sword of Justice');
  cast(session, 'Purging Flames');
  session.apply({ type: 'wait', durationMs: 1000 });
  const checkpoint = session.snapshot();
  const branch = checkpoint.resume();
  const control = checkpoint.resume();
  const before = session.score().totalDamage;
  cast(branch, 'Piercing Stance');
  finish(branch);
  assert.equal(session.score().totalDamage, before);
  const observation = control.observe();
  observation.profession.virtueReadyAt.justice = 1e9;
  finish(session);
  finish(control);
  assert.equal(session.score().totalDamage, control.score().totalDamage);
  assert.deepEqual(session.actions(), control.actions());
  assert.notEqual(control.observe().profession.virtueReadyAt.justice, 1e9);
});

test('legal actions enforce loadout, chain, cooldown and transition boundaries', () => {
  const session = create();
  assert.equal(legal(session, 'Bane Signet'), undefined);
  assert.equal(legal(session, 'Virtue of Justice'), undefined);
  assert.throws(() => session.apply({ type: 'cooldown-reset' }), /not legal/);
  assert.throws(() => session.apply({ type: 'wait', durationMs: 0 }), /Wait must advance/);
  assert.throws(() => session.apply({ type: 'wait', durationMs: 8001 }), /Wait must advance/);
  cast(session, 'Radiant Justice');
  assert.equal(legal(session, 'Radiant Justice'), undefined);
  cast(session, 'Swap Weapons');
  assert.equal(session.observe().activeWeaponSet, 2);
  assert.equal(legal(session, 'Helio Rush'), undefined);
  cast(session, 'Enter Radiant Forge');
  assert.equal(legal(session, 'Strike'), undefined);
  assert.equal(legal(session, 'Enter Radiant Forge'), undefined);
});

test('accepted commands are detached from caller objects and independent of property order', () => {
  const session = create();
  const skillId = id('Helio Rush');
  const command = { skillId, type: 'cast' };
  session.apply(command);
  command.skillId = id('Radiant Justice');
  command.offTarget = true;
  finish(session);
  assert.equal(session.rotation()[0].skillId, skillId);
  const replay = simulateGw2({
    profession: guardianProfession,
    config,
    rotation: session.rotation(),
    combatStartTime: 0
  });
  assert.equal(session.score().totalDamage, replay.totalDamage);
});

test('resource affordability and recharge survive restoration', () => {
  const session = create({ specialization: 'Firebrand', initialTomePages: 0, selectedSkills: [] }, 20000);
  cast(session, 'Tome of Justice');
  assert.equal(legal(session, 'Chapter 4: Scorched Aftermath'), undefined);
  const branch = session.clone();
  session.apply({ type: 'wait', durationMs: 10000 });
  branch.apply({ type: 'wait', durationMs: 10000 });
  assert.deepEqual(branch.observe().profession.tomePages, session.observe().profession.tomePages);
  assert.deepEqual(branch.actions(), session.actions());
});

test('eligible delayed work at the endpoint matches full replay and excludes later work', () => {
  for (const durationMs of [4000, 4001, 7000]) {
    const session = create({}, durationMs);
    cast(session, 'Purging Flames');
    const snapshot = session.snapshot();
    session.apply({ type: 'wait', durationMs: durationMs - session.time * 1000 });
    const replay = simulateGw2({
      profession: guardianProfession,
      config,
      rotation: session.rotation(),
      combatStartTime: 0,
      observationPolicy: { kind: 'absolute', endTimeMs: durationMs },
      output: 'score'
    });
    const restored = snapshot.resume();
    restored.apply({ type: 'wait', durationMs: durationMs - restored.time * 1000 });
    assert.equal(session.score().totalDamage, replay.totalDamage);
    assert.equal(restored.score().totalDamage, replay.totalDamage);
    assert.equal(restored.time, durationMs / 1000);
    assert.equal(restored.actions().length, 0);
    assert.throws(() => restored.apply({ type: 'cast', skillId: id('Radiant Justice') }), /endpoint/);
  }
});

test('fixed evaluation budgets reproduce the chosen rotation and multi-seed scores', () => {
  const options = {
    profession: guardianProfession,
    config,
    durationMs: 4000,
    budget: 8,
    beamWidth: 2,
    searchSeed: 7,
    combatSeeds: [11, 12],
    validationSeeds: [101, 102]
  };
  const logs = [];
  const first = optimizeRotation({ ...options, onLog: (message, verbose) => logs.push({ message, verbose }) });
  const second = optimizeRotation(options);
  assert.deepEqual(first.rotation, second.rotation);
  assert.deepEqual(first.score, second.score);
  assert.equal(first.performance.evaluatedCandidates, 8);
  assert.equal(first.performance.replaySimulations, second.performance.replaySimulations);
  assert.ok(first.score.trainingDamage >= first.baseline.damage);
  assert.equal(first.objective.dpsDenominatorSeconds, 4);
  for (const sample of first.score.heldOut) assert.deepEqual(sample.warnings, []);
  for (const phase of ['baseline', 'beam', 'refinement', 'validation'])
    assert.ok(logs.some((entry) => entry.message.startsWith(`[${phase}`)));
  assert.ok(logs.some((entry) => entry.verbose && entry.message.includes('cast ')));
  assert.ok(logs.some((entry) => entry.verbose && entry.message.includes('wait ')));
});

test('zero-time action loops must yield to an advancing decision', () => {
  // A repeatable instant action isolates the session safety contract from profession cooldown tuning.
  const native = guardianProfession.runtimeFor(config);
  const skill = { id: 'test.repeat', name: 'Repeat', type: 'Action', castTimeMs: 0, cooldown: 0, effects: [] };
  const profession = {
    ...guardianProfession,
    runtimeFor: () => ({
      ...native,
      catalog: {
        ...native.catalog,
        skills: [skill],
        skillsById: new Map([...native.catalog.skillsById, [skill.id, skill]])
      }
    })
  };
  const session = initializeGw2Combat({ profession, config, durationMs: 2000 });
  for (let count = 0; count < 32; count++) session.apply({ type: 'cast', skillId: skill.id });
  assert.equal(session.time, 0);
  assert.ok(session.actions().every((action) => action.type === 'wait'));
  assert.throws(() => session.apply({ type: 'cast', skillId: skill.id }), /not legal/);
  session.apply(session.actions()[0]);
  assert.ok(session.time > 0);
  assert.ok(session.actions().some((action) => action.type === 'cast'));
});

// Target stopping uses training seeds only; final held-out checks cannot influence the discovered actions.
test('scalar targets stop strictly above the threshold and respect the evaluation cap', () => {
  const options = {
    profession: guardianProfession,
    config,
    durationMs: 4000,
    budget: 8,
    beamWidth: 2,
    searchSeed: 7,
    combatSeeds: [11, 12],
    validationSeeds: [101, 102]
  };
  const easy = optimizeRotation({ ...options, targetDps: 1 });
  assert.equal(easy.performance.evaluatedCandidates, 1);
  assert.equal(easy.performance.stopReason, 'training-target-exceeded');
  assert.equal(easy.goal.status, 'validated-target-exceeded');
  const equal = optimizeRotation({
    ...options,
    targetDps: Math.min(...easy.score.samples.map((sample) => sample.damage)) / 4
  });
  assert.ok(equal.performance.evaluatedCandidates > 1, 'Matching the target is not beating it');
  const hard = optimizeRotation({ ...options, targetDps: 1e9 });
  const differentValidation = optimizeRotation({ ...options, targetDps: 1e9, validationSeeds: [201, 202] });
  assert.equal(hard.performance.evaluatedCandidates, options.budget);
  assert.equal(hard.performance.stopReason, 'budget-exhausted');
  assert.equal(hard.goal.status, 'target-not-validated');
  assert.ok(hard.goal.trainingGapDps > 0);
  assert.deepEqual(hard.rotation, differentValidation.rotation);
  assert.deepEqual(hard.score.samples, differentValidation.score.samples);
  for (const targetDps of [0, -1, NaN, Infinity])
    assert.throws(() => optimizeRotation({ ...options, targetDps }), /Target DPS/);
});

test('snapshot input and seeded search validation reject unsupported or ambiguous requests', () => {
  assert.throws(() => create({}, 0), /duration/);
  const options = {
    profession: guardianProfession,
    config,
    durationMs: 4000,
    budget: 4,
    beamWidth: 1,
    searchSeed: 1,
    combatSeeds: [11, 12],
    validationSeeds: [11, 102]
  };
  assert.throws(() => optimizeRotation(options), /disjoint/);
});
