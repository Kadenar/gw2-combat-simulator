import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

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
