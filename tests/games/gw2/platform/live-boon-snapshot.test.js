import assert from 'node:assert/strict';
import test from 'node:test';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';

// Record only executed grants so each query observes its exact position in same-time event ordering.
function fixture(boons = {}) {
  const runtime = { config: { boons }, boons: new Map() };
  return {
    combat: createMechanicCombatServices(runtime),
    grant(kind, at, duration, stacks, companionId) {
      recordBuffApplication(runtime.boons, {
        type: 'buff',
        kind,
        at,
        duration,
        stacks,
        resolvedAudience: {
          includesSelf: companionId === undefined,
          includesSummons: companionId !== undefined,
          companionIds: companionId === undefined ? [] : [companionId],
          alliedPlayerCount: 0,
          recipientCount: 1
        }
      });
    }
  };
}

const player = { actor: 'player' };
const pet = (companionId) => ({ actor: 'companion', companionId });

test('live boon snapshots isolate companion generations and observe only executed same-time grants', () => {
  const { combat, grant } = fixture({ might: 7 });
  grant('might', 2, 5, 3, 'old');
  const snapshot = combat.boonSnapshot('might', 2, pet('new'));
  assert.deepEqual(snapshot, { stacks: 0, duration: 0 });
  grant('might', 2, 4, 5, 'new');
  assert.deepEqual(snapshot, { stacks: 0, duration: 0 });
  assert.deepEqual(combat.boonSnapshot('might', 2, pet('new')), { stacks: 5, duration: 4 });
  assert.deepEqual(combat.boonSnapshot('might', 2, pet('old')), { stacks: 3, duration: 5 });
  assert.deepEqual(combat.boonSnapshot('might', 2, player), { stacks: 7, duration: 8 });
  assert.deepEqual(combat.boonSnapshot('might', 6, pet('new')), { stacks: 0, duration: 0 });
});

test('live boon snapshots retain pooled duration beyond individual grants and honor caps and expiry', () => {
  const { combat, grant } = fixture();
  grant('fury', 0, 2, 1, 'pet');
  grant('fury', 0, 2, 1, 'pet');
  assert.deepEqual(combat.boonSnapshot('fury', 3, pet('pet')), { stacks: 1, duration: 1 });
  assert.deepEqual(combat.boonSnapshot('fury', 4, pet('pet')), { stacks: 0, duration: 0 });
  grant('fury', 5, 50, 1, 'pet');
  assert.deepEqual(combat.boonSnapshot('fury', 5, pet('pet')), { stacks: 1, duration: 30 });
  grant('might', 5, 10, 20, 'pet');
  grant('might', 5, 10, 20, 'pet');
  assert.equal(combat.boonSnapshot('might', 5, pet('pet')).stacks, 25);
});

test('configured player pools refresh across precast and combat boundaries without granting companion boons', () => {
  const { combat, grant } = fixture({ fury: true, might: 7 });
  assert.deepEqual(combat.boonSnapshot('might', -1, player), { stacks: 7, duration: 1 });
  assert.deepEqual(combat.boonSnapshot('might', 0, player), { stacks: 7, duration: 10 });
  assert.deepEqual(combat.boonSnapshot('fury', 9, player), { stacks: 1, duration: 21 });
  grant('fury', 9, 20, 1);
  assert.deepEqual(combat.boonSnapshot('fury', 9, player), { stacks: 1, duration: 30 });
  assert.deepEqual(combat.boonSnapshot('fury', 10, player), { stacks: 1, duration: 30 });
  assert.deepEqual(combat.boonSnapshot('fury', 10, pet('pet')), { stacks: 0, duration: 0 });
});
