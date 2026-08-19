import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { recalculate, runSimulation } from '../../../js/professions/warrior/app/app-definition.js';
import { migrateWarriorBuild, validateWarriorBuild } from '../../../js/professions/warrior/build.js';
import { warriorCatalog } from '../../../js/professions/warrior/catalog.js';
import { getActiveTraits } from '../../../js/professions/warrior/data/traits-data.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '../../../js/professions/warrior/data/ids.js';

const buildUrl = new URL('../../../Builds/warrior/b-condi-berserker-longbow-sword-torch.json', import.meta.url);

function skill(id) {
  return warriorCatalog.skillsById.get(id);
}

test('Condition Berserker skill data uses configured values and packet timing', () => {
  const quicknessCastTimes = {
    [ID.DUAL_SHOT]: 840,
    [ID.FAN_OF_FIRE]: 560,
    [ID.ARCING_ARROW]: 560,
    [ID.PIN_DOWN]: 680,
    [ID.SMOLDERING_ARROW]: 160,
    [ID.COMBUSTIVE_SHOT]: 520,
    [ID.SCORCHED_EARTH]: 360,
    [ID.SAVAGE_LEAP]: 1000,
    [ID.BLAZE_BREAKER]: 480,
    [ID.FLAMES_OF_WAR]: 520,
    [ID.REND]: 960,
    [ID.FLAMING_FLURRY]: 1600,
    [ID.SEVER_ARTERY]: 360,
    [ID.GASH]: 520,
    [ID.HAMSTRING]: 400,
    [ID.BLOOD_RECKONING]: 280,
    [ID.SHATTERING_BLOW]: 520,
    [ID.SUNDERING_LEAP]: 920,
    [ID.HEAD_BUTT]: 800
  };

  for (const [id, castTime] of Object.entries(quicknessCastTimes)) {
    assert.equal(skill(Number(id)).quicknessCastTimeMs, castTime);
    assert.equal(castTime % 40, 0);
  }

  const dualShot = skill(ID.DUAL_SHOT);

  assert.deepEqual(
    dualShot.effects[0].ticks.map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [560, 0.525],
      [600, 0.525]
    ]
  );
  assert.equal(dualShot.comboFinishers[0].ownerId, 'warrior');
  assert.equal(dualShot.comboFinishers[0].finisherType, 'Projectile');
  assert.equal(dualShot.comboFinishers[0].chance, 0.2);
  assert.equal(dualShot.comboFinishers[0].ambiguousFieldSelection, 'oldest');

  const fan = skill(ID.FAN_OF_FIRE);

  assert.equal(fan.cooldown, 5);
  assert.deepEqual(
    fan.effects.map(({ type, coefficient, hits, stacks, duration, atMs }) => ({
      type,
      coefficient,
      hits,
      stacks,
      duration,
      atMs
    })),
    [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 3,
        stacks: undefined,
        duration: undefined,
        atMs: 240
      },
      {
        type: 'condition',
        coefficient: undefined,
        hits: undefined,
        stacks: 3,
        duration: 3,
        atMs: 240
      }
    ]
  );

  const arcingArrow = skill(ID.ARCING_ARROW);

  assert.equal(arcingArrow.ammo, 2);
  assert.equal(arcingArrow.ammoRecharge, 8);
  assert.equal(arcingArrow.ammoCastLockout, 1);
  assert.equal(arcingArrow.comboFinishers[0].finisherType, 'Blast');
  assert.deepEqual(
    arcingArrow.effects.map(({ type, coefficient, hits, condition, stacks, duration, atMs }) => ({
      type,
      coefficient,
      hits,
      condition,
      stacks,
      duration,
      atMs
    })),
    [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        condition: undefined,
        stacks: undefined,
        duration: undefined,
        atMs: 600
      },
      {
        type: 'condition',
        coefficient: undefined,
        hits: undefined,
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        atMs: 600
      }
    ]
  );

  const smolderingArrow = skill(ID.SMOLDERING_ARROW);

  assert.equal(smolderingArrow.ammo, 3);
  assert.equal(smolderingArrow.ammoRecharge, 16);
  assert.equal(smolderingArrow.ammoCastLockout, 0.5);
  assert.equal(smolderingArrow.effects[0].coefficient, 0.2);
  assert.equal(
    smolderingArrow.effects.some((effect) => effect.type === 'blind' && effect.metadata.duration === 5),
    true
  );
  assert.equal(smolderingArrow.comboFinishers[0].finisherType, 'Projectile');
  assert.equal(smolderingArrow.comboFinishers[0].chance, 1);

  const pinDown = skill(ID.PIN_DOWN);

  assert.equal(pinDown.cooldown, 20);
  assert.equal(pinDown.effects[0].coefficient, 0.44);
  assert.equal(pinDown.effects[1].stacks, 6);
  assert.equal(pinDown.effects[1].duration, 12);
  assert.equal(pinDown.effects[2].condition, 'Immobilized');
  assert.equal(pinDown.effects[2].duration, 3);
  assert.equal(pinDown.comboFinishers[0].finisherType, 'Projectile');

  const combustiveShot = skill(ID.COMBUSTIVE_SHOT);

  assert.equal(combustiveShot.cooldown, 8);
  assert.equal(combustiveShot.comboFields[0].ownerId, 'warrior');
  assert.equal(combustiveShot.comboFields[0].fieldType, 'Fire');
  assert.equal(combustiveShot.comboFields[0].duration, 3);
  assert.equal(combustiveShot.comboFields[0].startAnchor, 'castEnd');
  assert.deepEqual(combustiveShot.burstFieldDurations, [3, 6, 9]);
  assert.deepEqual(combustiveShot.effects, []);

  const scorchedEarth = skill(ID.SCORCHED_EARTH);

  assert.equal(scorchedEarth.cooldown, 5);
  assert.equal(scorchedEarth.skillWeapon, 'Longbow');
  assert.equal(scorchedEarth.comboFields[0].fieldType, 'Fire');
  assert.equal(scorchedEarth.comboFields[0].duration, 4);
  assert.deepEqual(
    scorchedEarth.effects[0].ticks.map(({ atMs, coefficient }) => [atMs, coefficient]),
    [
      [320, 0.5],
      [2320, 0.5],
      [4320, 0.5]
    ]
  );

  const savageLeap = skill(ID.SAVAGE_LEAP);
  const savageBleeding = savageLeap.effects.find(
    (effect) => effect.type === 'condition' && effect.condition === 'Bleeding'
  );

  assert.equal(savageBleeding.stacks, 3);
  assert.equal(savageBleeding.duration, 5);
  assert.deepEqual(
    scorchedEarth.effects[1].ticks.map(({ atMs, stacks, duration }) => [atMs, stacks, duration]),
    [
      [320, 1, 3],
      [2320, 1, 3],
      [4320, 1, 3]
    ]
  );

  const blazeBreaker = skill(ID.BLAZE_BREAKER);

  assert.equal(blazeBreaker.cooldown, 12);
  assert.equal(blazeBreaker.comboFinishers[0].finisherType, 'Blast');
  assert.equal(blazeBreaker.comboFinishers[0].chance, 1);
  assert.equal(blazeBreaker.waves, 5);
  assert.equal(blazeBreaker.totalCoefficient, 2);
  assert.equal(blazeBreaker.maximumHitsPerTarget, 1);
  assert.deepEqual(
    blazeBreaker.effects.map(({ type, coefficient, hits, condition, stacks, duration, atMs }) => ({
      type,
      coefficient,
      hits,
      condition,
      stacks,
      duration,
      atMs
    })),
    [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        condition: undefined,
        stacks: undefined,
        duration: undefined,
        atMs: 400
      },
      {
        type: 'condition',
        coefficient: undefined,
        hits: undefined,
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        atMs: 400
      },
      {
        type: 'condition',
        coefficient: undefined,
        hits: undefined,
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        atMs: 400
      }
    ]
  );

  const flamesOfWar = skill(ID.FLAMES_OF_WAR);

  assert.equal(flamesOfWar.cooldown, 20);
  assert.equal(flamesOfWar.comboFields[0].fieldType, 'Fire');
  assert.equal(flamesOfWar.comboFields[0].duration, 5);
  assert.deepEqual(flamesOfWar.effects[0], {
    type: 'strike',
    coefficient: 1,
    hits: 1,
    atMs: 5480,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    persistsAfterInterrupt: true
  });
  assert.deepEqual(
    flamesOfWar.effects[1].ticks.map(({ atMs, stacks, duration }) => [atMs, stacks, duration]),
    [
      [480, 1, 2],
      [1480, 1, 2],
      [2480, 1, 2],
      [3480, 1, 2],
      [4480, 1, 2],
      [5480, 2, 6]
    ]
  );

  const flamingFlurry = skill(ID.FLAMING_FLURRY);

  assert.equal(flamingFlurry.skillWeapon, 'Sword');
  assert.deepEqual(
    flamingFlurry.effects[1].ticks.map(({ duration }) => duration),
    [3.5, 3.5, 3.5, 3.5, 3.5, 3.5]
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

    recalculate(app);
    const result = runSimulation(app);

    assert.deepEqual(result.warnings, []);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.COMBUSTIVE_SHOT);

    assert.equal(action.burstTier, tier);
    assert.equal(action.comboFields[0].duration, tier * 3);
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'damage' && event.activationId === action.activationId)
        .map((event) => [Math.round((event.at - action.at) * 1000), event.coefficient]),
      expectedOffsets.map((offset) => [offset, 0.5])
    );
    assert.deepEqual(
      result.events
        .filter((event) => event.type === 'condition' && event.activationId === action.activationId)
        .map((event) => [Math.round((event.at - action.at) * 1000), event.stacks, event.duration]),
      expectedOffsets.map((offset) => [offset, 1, 5])
    );
  }
});

test('a delayed primal-burst critical hit immediately detonates its new fire aura', async () => {
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

  recalculate(app);
  const result = runSimulation(app);
  const scorchedAction = result.events.find((event) => event.type === 'action' && event.skillId === ID.SCORCHED_EARTH);
  const kingProc = result.procSteps.find((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires');

  assert.equal(kingProc.start, Math.round(scorchedAction.at * 1000) + 2320);
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

  recalculate(app);
  const result = runSimulation(app);
  const kingProc = result.procSteps.find((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires');

  assert.deepEqual(result.warnings, []);
  assert.equal(result.duration, 0.52);
  assert.equal(result.endState.time, 520);
  assert.equal(result.deathTime, null);
  assert.equal(
    result.events.every((event) => event.at <= result.duration),
    true
  );
  assert.equal(
    result.resolvedEvents.every((event) => event.at <= result.duration),
    true
  );
  assert.equal(kingProc, undefined);
});
