import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
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
    { type: 'wait', durationMs: 1800 },
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
    { type: 'wait', durationMs: 1800 },
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
