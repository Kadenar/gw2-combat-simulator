import assert from 'node:assert/strict';
import test from 'node:test';

import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {
  selectedSkillIds: [],
  selectedTraitIds: [
    TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
    TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
    TRAIT.MECH_CORE_BARRIER_ENGINE
  ],
  boons: {},
  target: { conditions: {} }
});
const basicNames = new Set(['Hard Strike', 'Heavy Smash (Mech)', 'Twin Strike (Mech)']);
const basics = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && basicNames.has(event.name));

// A command owns the mech lane and interrupts melee-chain progress without reserving the player's lane.
test('a non-instant mech command pauses basic attacks and restarts the melee chain', () => {
  const result = simulate('Mechanist', [
    { type: 'wait', durationMs: 2000 },
    'Rolling Smash',
    'Puncturing Jab',
    { type: 'wait', durationMs: 6000 }
  ]);
  const command = result.steps.find((step) => step.skill === 'Rolling Smash');
  const player = result.steps.find((step) => step.skill === 'Puncturing Jab');
  const attacks = basics(result);
  assert.equal(attacks.filter((event) => event.at < command.start / 1000).at(-1).name, 'Heavy Smash (Mech)');
  assert.ok(attacks.every((event) => event.at < command.start / 1000 || event.at >= command.end / 1000));
  assert.equal(attacks.find((event) => event.at >= command.end / 1000).name, 'Hard Strike');
  assert.ok(player.start < command.end);
  assert.deepEqual(result.warnings, []);
});

// Instant support commands do not break a melee chain that is already in progress.
test('Crisis Zone preserves the active melee-chain phase', () => {
  const result = simulate('Mechanist', [
    { type: 'wait', durationMs: 2000 },
    'Crisis Zone',
    { type: 'wait', durationMs: 3000 }
  ]);
  const command = result.steps.find((step) => step.skill === 'Crisis Zone');
  const next = basics(result).find((event) => event.at > command.start / 1000);
  assert.equal(next.name, 'Twin Strike (Mech)');
  // Twin Strike's full coefficient belongs to one critical-hit and on-hit opportunity, rather than half-strength hits.
  assert.equal(next.coefficient, 0.8);
  assert.equal(next.summonOwner, 'engineer.mech');
});

// A pending impact belongs to the attack that began it; only a command taking the mech lane can supersede it.
test('mech commands cancel pending melee impacts while instant support preserves them', () => {
  const idle = simulate('Mechanist', [{ type: 'wait', durationMs: 5000 }]);
  const run = (command) =>
    simulate('Mechanist', [{ type: 'wait', durationMs: 1100 }, command, { type: 'wait', durationMs: 5000 }]);
  const command = run('Rolling Smash');
  const support = run('Crisis Zone');
  const reservation = command.steps.find((step) => step.skill === 'Rolling Smash');
  const pending = basics(idle)[0];

  // Establish that the command intervenes during windup, rather than testing a particular calibrated timestamp.
  assert.ok(pending.at > reservation.start / 1000 && pending.at < reservation.end / 1000);
  assert.ok(basics(command).every((event) => event.at >= reservation.end / 1000));
  assert.equal(basics(command)[0].name, 'Hard Strike');
  assert.equal(basics(support)[0].name, pending.name);
  assert.equal(basics(support)[0].at, pending.at);
  assert.deepEqual(command.warnings, []);
  assert.deepEqual(support.warnings, []);
});

// Ranged windups share command ownership with melee attacks; support commands preserve the pending arm.
for (const quickness of [false, true]) {
  test(`Jade Cannons cancels a pending second arm and restarts the first arm (Quickness: ${quickness})`, () => {
    const config = {
      selectedSkillIds: [ID.SHIFT_SIGNET],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
        TRAIT.MECH_CORE_BARRIER_ENGINE
      ],
      boons: { quickness }
    };
    const shots = (result) =>
      result.resolvedEvents.filter(
        (event) =>
          event.type === 'damage' && [ID.JADE_ENERGY_SHOT, ID.JADE_ENERGY_SHOT_ID_63348].includes(event.skillId)
      );
    const idle = simulate('Mechanist', [{ type: 'wait', durationMs: 5000 }], config);
    const [first, second] = shots(idle);
    // Intervene between observed impacts so this test protects cancellation and phase ownership, not calibration.
    const interveneMs = Math.round(((first.at + second.at) / 2) * 1000);
    const run = (command) =>
      simulate(
        'Mechanist',
        [{ type: 'wait', durationMs: interveneMs }, command, { type: 'wait', durationMs: 5000 }],
        config
      );
    const commanded = run('Spark Revolver');
    const support = run('Crisis Zone');
    const reservation = commanded.steps.find((step) => step.skill === 'Spark Revolver');
    const commandedShots = shots(commanded);

    assert.equal(first.skillId, ID.JADE_ENERGY_SHOT);
    assert.equal(second.skillId, ID.JADE_ENERGY_SHOT_ID_63348);
    assert.ok(second.at > reservation.start / 1000 && second.at < reservation.end / 1000);
    assert.ok(
      commandedShots.every((event) => event.at < reservation.start / 1000 || event.at > reservation.end / 1000)
    );
    assert.equal(commandedShots.find((event) => event.at > reservation.end / 1000).skillId, ID.JADE_ENERGY_SHOT);
    assert.equal(shots(support)[1].skillId, second.skillId);
    assert.equal(shots(support)[1].at, second.at);
    assert.ok(commandedShots.every((event) => event.summonOwner === 'engineer.mech'));
    assert.deepEqual(commanded.warnings, []);
    assert.deepEqual(support.warnings, []);
  });
}
