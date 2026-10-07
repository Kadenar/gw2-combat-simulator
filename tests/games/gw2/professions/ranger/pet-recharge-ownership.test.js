import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';

// Feed real received boons into the runtime so autonomous cooldowns exercise the same history as manual commands.
const grantAlacrity = (runtime, duration) =>
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      kind: 'alacrity',
      at: runtime.time,
      duration,
      stacks: 1,
      source: 'fixture',
      sourceId: 'fixture',
      actorType: 'player',
      audience: { recipients: 'party' }
    }
  });

// Readiness must account for earned work; AI recovery may delay an attack but cannot spend unfinished recharge.
for (const [label, grantAt, duration] of [
  ['no Alacrity', 0, 0],
  ['Alacrity expires during recharge', 0, 10],
  ['Alacrity covers the recharge', 0, 30],
  ['Alacrity arrives during recharge', 8, 30]
]) {
  test(`autonomous pet recharge preserves earned work: ${label}`, () => {
    let sample;
    const result = runRanger(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 30000 }],
      { selectedPet: 'Carrion Devourer', allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
      {
        initialize(runtime) {
          if (duration && !grantAt) grantAlacrity(runtime, duration);
        },
        timeline: grantAt ? [{ at: grantAt, run: (runtime) => grantAlacrity(runtime, duration) }] : [],
        probes: [
          [
            10,
            (runtime) => {
              const progress = runtime.profession.core.petAutoRecharges[ID.PET_TAIL_LASH];
              assert.equal(progress.companionId, rangerPetCompanionId(runtime));
              sample = {
                ...progress,
                readyAt: runtime.cooldownController.project(runtime.helpers.skillsById.get(ID.PET_TAIL_LASH), progress)
              };
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(sample.work, 20);
    const expected = !duration
      ? sample.startedAt + sample.work
      : grantAt
        ? grantAt + (sample.work - (grantAt - sample.startedAt)) / 1.25
        : duration === 10
          ? sample.startedAt + sample.work - (duration - sample.startedAt) * 0.25
          : sample.startedAt + sample.work / 1.25;
    assert.ok(Math.abs(sample.readyAt - expected) < 1e-9);
    const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
    const repeat = actions.find((event) => event.skillId === ID.PET_TAIL_LASH && event.at > sample.startedAt);
    assert.ok(repeat);
    assert.ok(repeat.at >= gw2CooldownReadyAt(expected), 'Autonomous attacks cannot spend unfinished recharge.');
    assert.equal(
      actions.some((event) => event.at >= gw2CooldownReadyAt(expected) && event.at < repeat.at),
      false,
      'The next free AI decision must recognize the newly ready special.'
    );
  });
}

// Retiring a pet ends its boon window; a replacement or returning incarnation cannot rewrite that earned work.
test('autonomous recharge retains its original companion across retirement and swap-back', () => {
  const samples = [];
  const sample = (runtime) => {
    const progress = runtime.profession.core.petAutoRecharges[ID.PET_TAIL_LASH];
    samples.push({
      ...progress,
      current: rangerPetCompanionId(runtime),
      readyAt: runtime.cooldownController.project(runtime.helpers.skillsById.get(ID.PET_TAIL_LASH), progress)
    });
  };

  const result = runRanger(
    [
      { type: 'combat-start' },
      { type: 'wait', durationMs: 6000 },
      'Swap Pets',
      { type: 'wait', durationMs: 20000 },
      'Swap Pets',
      { type: 'wait', durationMs: 1000 }
    ],
    {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Tiger',
      allies: { count: 0 },
      sharePlayerBoonsWithSummons: true
    },
    {
      initialize: (runtime) => grantAlacrity(runtime, 30),
      timeline: [8, 26.1].map((at) => ({ at, run: (runtime) => grantAlacrity(runtime, 30) })),
      probes: [
        [5, sample],
        [8, sample],
        [26.2, sample]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const [beforeSwap, retired, returned] = samples;
  assert.equal(retired.companionId, beforeSwap.companionId);
  assert.equal(returned.companionId, beforeSwap.companionId);
  assert.notEqual(returned.current, returned.companionId);
  assert.equal(returned.readyAt, retired.readyAt);
  assert.ok(retired.readyAt > beforeSwap.readyAt);
  assert.ok(Math.abs(retired.readyAt - (retired.startedAt + retired.work - (6 - retired.startedAt) * 0.25)) < 1e-9);
});

// Tiger's autonomous policy remains immune even when that exact companion receives Alacrity.
test('Tiger autonomous recharge keeps its Alacrity immunity', () => {
  const samples = [];
  for (const duration of [0, 30]) {
    const result = runRanger(
      [{ type: 'combat-start' }, { type: 'wait', durationMs: 12000 }],
      { selectedPet: 'Tiger', allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
      {
        initialize(runtime) {
          if (duration) grantAlacrity(runtime, duration);
        },
        probes: [[1, (runtime) => samples.push({ ...runtime.profession.core.petAutoRecharges[ID.FELINE_BITE] })]]
      }
    );
    assert.deepEqual(result.warnings, []);
    const progress = samples.at(-1);
    assert.equal(progress.ignoresAlacrity, true);
    const repeat = result.events.find(
      (event) => event.type === 'action' && event.skillId === ID.FELINE_BITE && event.at > progress.startedAt
    );
    assert.ok(repeat);
    assert.ok(repeat.at >= gw2CooldownReadyAt(progress.startedAt + progress.work));
  }

  assert.deepEqual(samples[0], samples[1]);
});

// Returning to the same pet creates a new boon recipient without clearing its existing skill cooldown.
test('swap-back grants cannot accelerate recharge earned by the previous pet incarnation', () => {
  const samples = [];
  const sample = (runtime) => {
    const skill = runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD);
    const progress = runtime.cooldownController.rechargeFor(skill.id);
    samples.push({
      current: rangerPetCompanionId(runtime),
      owner: progress.companionId,
      readyAt: runtime.cooldownController.project(skill, progress),
      baseReadyAt: progress.startedAt + progress.work
    });
  };

  const result = runRanger(
    [
      { type: 'combat-start' },
      'Poisonous Cloud',
      { type: 'wait', durationMs: 2000 },
      'Swap Pets',
      { type: 'wait', durationMs: 20000 },
      'Swap Pets',
      { type: 'wait', durationMs: 1000 },
      'Poisonous Cloud',
      { type: 'wait', durationMs: 40000 }
    ],
    {
      selectedPet: 'Carrion Devourer',
      selectedPet2: 'Tiger',
      allies: { count: 0 },
      sharePlayerBoonsWithSummons: true
    },
    {
      timeline: [
        {
          at: 25,
          run(runtime) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'buff',
                kind: 'alacrity',
                at: runtime.time,
                duration: 30,
                stacks: 1,
                source: 'fixture',
                sourceId: 'fixture',
                actorType: 'player',
                audience: { recipients: 'party' }
              }
            });
          }
        }
      ],
      probes: [
        [5, sample],
        [
          25,
          (runtime) => {
            sample(runtime);
            assert.equal(
              runtime.mechanics.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                actor: 'companion',
                companionId: rangerPetCompanionId(runtime)
              }),
              1
            );
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(samples.length, 2);
  assert.notEqual(samples[0].current, samples[1].current);
  assert.equal(samples[0].owner, samples[1].owner);
  assert.notEqual(samples[1].owner, samples[1].current);
  assert.equal(samples[0].readyAt, samples[1].readyAt);
  assert.equal(samples[1].readyAt, samples[1].baseReadyAt);
});

// Compare real commanded recharges after a pet swap; only the addressed incarnation may accelerate them.
test('replacement pet recharge ignores outgoing, expired and player-only Alacrity', () => {
  const observations = new Map();
  for (const [label, duration, sharing, grantAt] of [
    ['none', 0, true, 0],
    ['outgoing', 30, true, 0],
    ['expired', 1, true, 0],
    ['player', 30, false, 0],
    ['incoming', 30, true, 3]
  ]) {
    const grant = (runtime) => {
      if (duration)
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            kind: 'alacrity',
            at: runtime.time,
            duration,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player',
            audience: { recipients: 'party' }
          }
        });
    };

    let sample;
    const result = runRanger(
      [
        { type: 'combat-start' },
        { type: 'wait', durationMs: 2000 },
        'Swap Pets',
        { type: 'wait', durationMs: 1000 },
        'Poisonous Cloud',
        'Poisonous Cloud',
        // Keep observation open until the pet lane executes the queued repeat command.
        { type: 'wait', durationMs: 40000 }
      ],
      {
        selectedPet: 'Tiger',
        selectedPet2: 'Carrion Devourer',
        boons: {},
        allies: { count: 0 },
        sharePlayerBoonsWithSummons: sharing
      },
      {
        initialize(runtime) {
          if (!grantAt) grant(runtime);
        },
        timeline: grantAt ? [{ at: grantAt, run: grant }] : [],
        probes: [
          [
            5,
            (runtime) => {
              const skill = runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD);
              const progress = runtime.profession.core.petCommandRecharges[skill.id];
              assert.equal(progress.companionId, rangerPetCompanionId(runtime));
              assert.equal(runtime.cooldownController.rechargeFor(skill.id).companionId, progress.companionId);
              sample = {
                readyAt: runtime.cooldownController.project(skill, progress),
                baseReadyAt: progress.startedAt + progress.work
              };
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const commands = result.events.filter((event) => event.type === 'action' && event.skillId === ID.POISONOUS_CLOUD);
    observations.set(label, { ...sample, nextCommandAt: commands[1].at });
  }

  const baseline = observations.get('none');
  assert.equal(baseline.readyAt, baseline.baseReadyAt);
  for (const label of ['outgoing', 'expired', 'player']) assert.deepEqual(observations.get(label), baseline);
  assert.ok(observations.get('incoming').readyAt < baseline.readyAt);
  assert.ok(observations.get('incoming').nextCommandAt < baseline.nextCommandAt);
});
