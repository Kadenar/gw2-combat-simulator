import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { warriorAppAdapter } from '#gw2/professions/warrior/app/app-definition.js';
import { migrateWarriorBuild } from '#gw2/professions/warrior/build/build.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

const buildUrl = new URL(
  '../../../../../data/gw2/builds/warrior/b-condi-berserker-longbow-sword-torch.json',
  import.meta.url
);

test('Warrior leaps retain fire fields that expire during travel', async () => {
  const raw = JSON.parse(await readFile(buildUrl, 'utf8'));
  // Start inside the field and land after expiration; the aura still belongs to this leap.
  for (const leap of ['Savage Leap', 'Sundering Leap']) {
    const build = migrateWarriorBuild({
      ...raw,
      startingWeaponSet: 2,
      rotation: ['Flames of War', { type: 'wait', durationMs: 4600 }, leap]
    });
    const app = { build, skillByName: warriorCatalog.skillsByName, attributeWeaponSet: 1 };
    warriorAppAdapter.recalculate(app);
    const config = warriorAppAdapter.simulationConfig(app);
    const result = runGw2Runtime({
      profession: warriorProfession.runtimeFor(config),
      config,
      rotation: app.build.rotation
    });
    const aura = result.resolvedEvents.find((event) => event.type === 'aura' && event.skillName === leap);
    assert.deepEqual(result.warnings, []);
    assert.ok(aura);
    assert.ok(aura.at > 5.52);
    if (leap === 'Sundering Leap') {
      assert.ok(result.procSteps.some((proc) => proc.skill === 'King of Fires' && proc.sourceSkill === leap));
    }
  }
});

test('Fan of Fire keeps only cast-time skills behind its retained aftercast', async () => {
  const raw = JSON.parse(await readFile(buildUrl, 'utf8'));
  const build = migrateWarriorBuild({
    ...raw,
    startingWeaponSet: 1,
    rotation: [{ name: 'Fan of Fire', interruptMs: 240 }, 'Outrage', 'Swap Weapons', 'Flames of War']
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  warriorAppAdapter.recalculate(app);
  const config = warriorAppAdapter.simulationConfig(app);
  const result = runGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: app.build.rotation
  });
  const action = (name) => result.events.find((event) => event.type === 'action' && event.skillName === name);
  const fan = action('Fan of Fire');

  assert.deepEqual(result.warnings, []);
  assert.equal(fan.endsAt, 0.24);
  assert.equal(action('Outrage').at, 0.24);
  assert.equal(action('Swap Weapons').at, 0.24);
  assert.equal(action('Flames of War').at, 0.56);
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.activationId === fan.activationId &&
          event.sourceId === ID.FAN_OF_FIRE &&
          ['damage', 'condition'].includes(event.type)
      )
      .map((event) => [event.type, event.at]),
    [
      ['damage', 0.24],
      ['damage', 0.24],
      ['damage', 0.24],
      ['condition', 0.24],
      ['condition', 0.24],
      ['condition', 0.24]
    ]
  );
});

test('Combustive Shot scales its pulses and field with adrenaline', async () => {
  const raw = JSON.parse(await readFile(buildUrl, 'utf8'));

  for (const [tier, expectedOffsets] of [
    [1, [520, 3520]],
    [2, [520, 3520, 6520]],
    [3, [520, 3520, 6520, 9520]]
  ]) {
    const build = migrateWarriorBuild({
      ...raw,
      initialResource: tier * 10,
      startingWeaponSet: 1,
      rotation: ['Combustive Shot', { name: '__wait', durationMs: expectedOffsets.at(-1) }]
    });
    const app = {
      build,
      skillByName: warriorCatalog.skillsByName,
      attributeWeaponSet: 1
    };

    warriorAppAdapter.recalculate(app);
    const config = warriorAppAdapter.simulationConfig(app);
    const result = runGw2Runtime({
      profession: warriorProfession.runtimeFor(config),
      config,
      rotation: app.build.rotation
    });

    assert.deepEqual(result.warnings, []);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.COMBUSTIVE_SHOT);

    assert.equal(
      result.events.find((event) => event.type === 'damage' && event.skillId === ID.COMBUSTIVE_SHOT).metadata
        .warriorBurstTier,
      tier
    );
    assert.equal(action.comboFields[0].duration, tier * 3);
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'damage' && event.activationId === action.activationId)
        .map((event) => [Math.round((event.at - action.at) * 1000), event.coefficient]),
      expectedOffsets.map((offset) => [offset, 0.5])
    );
    assert.deepEqual(
      result.events
        // Trait procs inherit activation provenance; this contract covers only Combustive Shot's authored packets.
        .filter(
          (event) =>
            event.type === 'condition' &&
            event.activationId === action.activationId &&
            event.sourceId === ID.COMBUSTIVE_SHOT
        )
        .map((event) => [Math.round((event.at - action.at) * 1000), event.stacks, event.duration]),
      expectedOffsets.map((offset) => [offset, 1, 5])
    );
  }
});

test('a primal-burst critical hit grants an aura that detonates no earlier than cast completion', async () => {
  const raw = JSON.parse(await readFile(buildUrl, 'utf8'));
  const build = migrateWarriorBuild({
    ...raw,
    targetHealth: 100_000_000,
    startingWeaponSet: 1,
    specializations: [
      { name: 'Strength', traits: '1-1-1' },
      { name: 'Discipline', traits: '2-3-3' },
      { name: 'Berserker', traits: '2-1-2' }
    ],
    assumptions: {
      ...raw.assumptions,
      fury: false,
      targetConditions: {}
    },
    rotation: ['__combat_start', 'Berserk', 'Scorched Earth', { name: '__wait', durationMs: 2500 }]
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  warriorAppAdapter.recalculate(app);
  const config = warriorAppAdapter.simulationConfig(app);
  const result = runGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: app.build.rotation
  });
  const criticalHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.SCORCHED_EARTH && event.didCrit
  );
  const kingProc = result.procSteps.find((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires');

  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.SCORCHED_EARTH);
  assert.equal(kingProc.start, Math.round(Math.max(action.endsAt, criticalHit.at) * 1000));
  assert.equal(kingProc.sourceSkill, 'Scorched Earth');
});

test('a final persistent Berserker packet does not extend the rotation horizon', async () => {
  const raw = JSON.parse(await readFile(buildUrl, 'utf8'));
  const build = migrateWarriorBuild({
    ...raw,
    // The later field pulses would kill this target if the resolver drained
    // beyond the final skill's cast window.
    targetHealth: 1_000,
    startingWeaponSet: 2,
    rotation: ['__combat_start', 'Flames of War']
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  warriorAppAdapter.recalculate(app);
  const config = warriorAppAdapter.simulationConfig(app);
  const result = runGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: app.build.rotation
  });
  const kingProc = result.procSteps.find((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires');

  assert.deepEqual(result.warnings, []);
  assert.equal(result.rotationEndTime, 0.52);
  assert.equal(result.planningState.atSeconds * 1000, 520);
  assert.equal(result.deathTime, null);
  assert.equal(
    result.events.every((event) => event.at <= result.rotationEndTime),
    true
  );
  assert.equal(
    result.resolvedEvents.every((event) => event.at <= result.rotationEndTime),
    true
  );
  assert.equal(kingProc, undefined);
});
