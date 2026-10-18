import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  buffApplicationStacks,
  buffMatchesAudience,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

// Minimal casts protect recipient ownership, live expiry, and one-time duration scaling independently of rotations.
function simulate({ might = 0, concentration = 0, count = 4, grants = [] } = {}) {
  let playerMight;
  let playerFury;
  const result = runElementalist(
    [
      { type: 'wait', durationMs: 2000 },
      { type: 'cast', skillId: ID.HEAT_SYNC },
      { type: 'wait', durationMs: 1000 }
    ],
    {
      specialization: 'Tempest',
      initialAttunement: 'Fire',
      weapons: ['Scepter', 'Warhorn'],
      selectedTraitIds: [],
      boons: { might },
      attributeInputs: baseAttributeInputs({ concentration }),
      allies: { count }
    },
    {
      initialize(runtime) {
        for (const grant of grants)
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 0,
              actorType: 'player',
              source: 'Fixture',
              sourceId: 42,
              skillId: 42,
              skillName: 'Fixture',
              stacks: 1,
              fixedDuration: true,
              ...grant
            }
          });
      },
      probes: [
        [
          3,
          (runtime) => {
            playerMight = buffApplicationStacks(runtime.boons.get('might') ?? [], 'might', 3, 25);
            playerFury = remainingDurationStackSeconds(runtime.boons.get('fury') ?? [], 3, {
              maximum: 30,
              includes: (application) => buffMatchesAudience(application, RECIPIENT.SELF)
            });
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const events = result.resolvedEvents.filter((event) => event.type === 'buff' && event.skillId === ID.HEAT_SYNC);
  return { events, playerMight, playerFury };
}

test('Heat Sync grants itself Might and Fury and shares those boons without duplicating self grants', () => {
  for (const might of [0, 25])
    for (const count of [0, 4]) {
      const { events, playerMight, playerFury } = simulate({ might, count, concentration: 750 });
      const self = events.filter((event) => event.resolvedAudience.includesSelf);
      const shared = events.filter((event) => !event.resolvedAudience.includesSelf);
      assert.deepEqual(
        self.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
        [
          { kind: 'fury', stacks: 1, duration: 15 },
          { kind: 'might', stacks: 3, duration: 15 }
        ]
      );
      assert.deepEqual(
        shared.map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
        self.map(({ kind, stacks, duration }) => ({ kind, stacks, duration }))
      );
      for (const grant of shared) {
        assert.equal(grant.audience.affectsSelf, false);
        assert.equal(grant.resolvedAudience.alliedPlayerCount, count);
      }

      assert.equal(playerMight, 3);
      assert.equal(playerFury, 15 - (3 - self[0].at));
    }
});

test('Heat Sync preserves distinct live Might expiries and pooled Fury while excluding other recipients and expired grants', () => {
  const { events, playerMight, playerFury } = simulate({
    might: 25,
    grants: [
      { kind: 'might', stacks: 2, duration: 8 },
      { kind: 'might', stacks: 4, duration: 20 },
      { kind: 'might', stacks: 6, duration: 1 },
      { kind: 'might', stacks: 10, duration: 30, audience: { recipients: 'party', affectsSelf: false } },
      { kind: 'fury', duration: 8 },
      { kind: 'fury', duration: 6 },
      { kind: 'fury', duration: 30, audience: { recipients: 'party', affectsSelf: false } }
    ]
  });
  const shared = events.filter((event) => !event.resolvedAudience.includesSelf);
  const might = shared.filter((event) => event.kind === 'might');
  assert.deepEqual(
    might.map((event) => [event.stacks, event.duration]),
    [
      [4, 20 - might[0].at],
      [3, 10],
      [2, canonicalTime(8 - might[0].at)]
    ]
  );
  const fury = shared.find((event) => event.kind === 'fury');
  assert.equal(fury.duration, 24 - fury.at);
  assert.equal(playerMight, 9);
  assert.equal(playerFury, 21);
});

test('Heat Sync copies at most 25 Might stacks with their retained durations', () => {
  const { events } = simulate({ grants: [{ kind: 'might', stacks: 24, duration: 20 }] });
  const shared = events.filter((event) => event.kind === 'might' && !event.resolvedAudience.includesSelf);
  assert.deepEqual(
    shared.map((event) => [event.stacks, event.duration]),
    [
      [24, 20 - shared[0].at],
      [1, 10]
    ]
  );
});
