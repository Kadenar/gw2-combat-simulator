import assert from 'node:assert/strict';
import test from 'node:test';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const attribution = { source: 'Trait', sourceId: 42, actorType: 'player', skillId: 42, skillName: 'Fixture trait' };
const strike = { ...attribution, type: 'damage', at: 1, coefficient: 1, skillWeapon: 'Sword' };

// Reporting consumes no combat identity, including announcements scheduled before later combat packets.
test('announcements preserve combat order and sampled damage in detailed and score output', () => {
  const run = (announcements, output = 'detailed') => {
    const references = [];
    const profession = defineTestProfession({
      id: 'emission-fixture',
      name: 'Emission fixture',
      hooks: {
        initialize(runtime) {
          if (announcements)
            for (const at of [0, 0.5, 1])
              runtime.effects.emit({
                kind: 'announcement',
                log: true,
                attribution,
                announcement: { type: 'trait', name: 'Fixture trait', at }
              });
          for (const at of [1, 2]) references.push(runtime.effects.emit({ kind: 'packet', event: { ...strike, at } }));
        }
      }
    });
    const result = simulateGw2({
      profession,
      output,
      rotation: [{ type: 'wait', durationMs: 2100 }],
      config: { randomness: { mode: 'stochastic', seed: 17 } }
    });
    return { result, references };
  };

  const baseline = run(false),
    detailed = run(true),
    score = run(true, 'score');
  assert.equal(detailed.result.totalDamage, baseline.result.totalDamage);
  assert.equal(score.result.totalDamage, baseline.result.totalDamage);
  assert.deepEqual(detailed.references, baseline.references);
  assert.deepEqual(score.references, baseline.references);
  assert.equal(detailed.result.events.filter((e) => e.type === 'proc').length, 3);
  assert.ok(detailed.references.every(Object.isFrozen));
});

// Profiles and computed packets share duration, identity, and queue ordering rather than separate execution paths.
test('profile and computed grants use one submission contract', () => {
  const references = [];
  const profession = defineTestProfession({
    id: 'profile-fixture',
    name: 'Profile fixture',
    hooks: {
      initialize(runtime) {
        references.push(
          ...runtime.effects.emit({
            kind: 'profile',
            at: 1,
            profile: { id: 42, name: 'Fixture', effects: [{ type: 'boon', boon: 'Fury', duration: 4, stacks: 1 }] },
            attribution
          })
        );
        references.push(
          runtime.effects.emit({
            kind: 'packet',
            event: { ...attribution, type: 'buff', at: 1, kind: 'fury', duration: 4, stacks: 1 }
          })
        );
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 1100 }],
    config: { stats: { concentration: 750 } }
  });
  const grants = result.events.filter((e) => e.type === 'buff');
  assert.deepEqual(
    grants.map((e) => [e.eventOrder, e.duration, e.sourceId]),
    references.map((e) => [e.eventOrder, 6, 42])
  );
  assert.deepEqual(
    references.map((e) => e.duration),
    [4, 4]
  );
});

// A settled condition is visible to its caller, while queued reactions remain pending until their heap turn.
test('reaction settlement preserves nested condition visibility', () => {
  const trace = [];
  resolveTestGw2Events({
    events: [{ ...strike, at: 0 }],
    endTime: 1,
    professionReactions: {
      'damage.resolved'(runtime, event) {
        runtime.effects.emit({
          kind: 'packet',
          cause: event,
          settlement: 'reaction',
          event: { ...attribution, type: 'condition', at: 0, condition: 'Poisoned', duration: 2, stacks: 1 }
        });
        assert.equal(runtime.combat.targetHasCondition('Poisoned', 0, runtime), true);
        assert.equal(runtime.combat.targetHasCondition('Weakness', 0, runtime), false);
        trace.push('caller');
        assert.throws(
          () => runtime.effects.emit({ kind: 'packet', settlement: 'reaction', event: { ...strike, at: 0 } }),
          /Reaction settlement/
        );
      },
      'condition.applied'(runtime, event) {
        trace.push(event.condition);
        if (event.condition === 'Poisoned')
          runtime.effects.emit({
            kind: 'packet',
            cause: event,
            event: { ...attribution, type: 'condition', at: 0, condition: 'Weakness', duration: 2, stacks: 1 }
          });
      }
    }
  });
  assert.deepEqual(trace, ['Poisoned', 'caller', 'Weakness']);
});

// Owned current-time announcements remain pending just like their grants, and keep the cast as attribution only.
test('same-time owner cancellation removes visible announcements and their grants', () => {
  let announcement;
  const profession = defineTestProfession({
    id: 'owned-announcement',
    name: 'Owned announcement',
    hooks: {
      initialize(runtime) {
        const owner = { id: 'trait-owner', generation: 0 };
        const cast = { activationId: 'cast-fixture', skillId: 42 };
        announcement = runtime.effects.emit({
          kind: 'announcement',
          log: true,
          owner,
          cast,
          attribution,
          announcement: { type: 'trait', name: 'Cancelled activation', at: runtime.time }
        });
        runtime.effects.emit({
          kind: 'packet',
          owner,
          cast,
          event: { ...attribution, type: 'buff', at: runtime.time, kind: 'might', stacks: 1, duration: 1 }
        });
        runtime.cancelOwner(owner);
      }
    }
  });
  const result = simulateGw2({ profession, rotation: [{ type: 'wait', durationMs: 100 }] });
  assert.equal(announcement.activationId, 'cast-fixture');
  assert.equal(
    result.events.some((event) => event.sourceId === 42),
    false
  );
  assert.equal(
    result.procSteps.some((proc) => proc.skill === 'Cancelled activation'),
    false
  );
});

// Caller-owned nested objects and read-only receipts must not retain mutable aliases into the heap.
test('queued effects snapshot nested payloads and return deeply frozen receipts', () => {
  let receipt;
  const input = {
    ...attribution,
    type: 'buff',
    at: 1,
    kind: 'fury',
    duration: 3,
    stacks: 1,
    audience: { recipients: 'party', maximumRecipients: 2 }
  };
  const profession = defineTestProfession({
    id: 'receipt-fixture',
    name: 'Receipt fixture',
    hooks: {
      initialize(runtime) {
        receipt = runtime.effects.emit({ kind: 'packet', event: input });
        input.audience.maximumRecipients = 5;
        assert.ok(Object.isFrozen(receipt.audience));
        assert.throws(() => {
          receipt.audience.maximumRecipients = 4;
        }, TypeError);
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 1100 }],
    config: { allies: { count: 4, strikesPerSecond: 0 } }
  });
  assert.equal(result.events.find((event) => event.type === 'buff').resolvedAudience.recipientCount, 2);
  assert.equal(receipt.audience.maximumRecipients, 2);
});
