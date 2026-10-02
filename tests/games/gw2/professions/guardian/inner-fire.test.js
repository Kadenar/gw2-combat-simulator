import assert from 'node:assert/strict';
import test from 'node:test';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

// Live Burning crosses the threshold, expires, and refreshes independently of the trait cooldown.
test('Inner Fire checks live Burning and grants Fury only from eligible player strikes on its ICD', () => {
  for (const selected of [false, true]) {
    const result = runGuardian(
      [{ type: 'wait', durationMs: 12000 }],
      { selectedTraitIds: selected ? [TRAIT.INNER_FIRE] : [] },
      {
        initialize: (runtime) => {
          for (const [at, stacks, duration] of [
            [0, 2, 1],
            [0.2, 1, 1],
            [11, 3, 1]
          ])
            runtime.emit({
              type: 'condition',
              at,
              stacks,
              duration,
              condition: 'Burning',
              source: 'guardian',
              sourceId: ID.ZEALOTS_FLAME,
              actorType: 'player'
            });
          for (const [at, overrides] of [
            [0.1, {}],
            [0.21, { actorType: 'summon' }],
            [0.22, { offTarget: true }],
            [0.3, {}],
            [0.4, {}],
            [10.5, {}],
            [11.1, {}]
          ])
            runtime.emit({
              type: 'damage',
              at,
              coefficient: 1,
              actorType: 'player',
              source: 'guardian',
              sourceId: ID.ORB_OF_WRATH,
              skillId: ID.ORB_OF_WRATH,
              skillName: 'Orb of Wrath',
              ...overrides
            });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const fury = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.INNER_FIRE);
    assert.deepEqual(
      fury.map((event) => [event.at, event.kind, event.duration]),
      selected
        ? [
            [0.3, 'fury', 8],
            [11.1, 'fury', 8]
          ]
        : []
    );
  }
});

// Permanent target assumptions use the same threshold, including values above three stacks.
test('Inner Fire accepts assumed Burning at and above its threshold', () => {
  for (const stacks of [2, 3, 4]) {
    const result = runGuardian(['Orb of Wrath'], {
      selectedTraitIds: [TRAIT.INNER_FIRE],
      target: { armor: 2597, conditions: { Burning: stacks } }
    });
    const fury = result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.INNER_FIRE);
    assert.deepEqual(result.warnings, []);
    assert.equal(fury.length, stacks >= 3 ? 1 : 0);
  }
});
