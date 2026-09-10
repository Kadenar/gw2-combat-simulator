import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/scheduler/policy.js';

test('scheduler replacements invalidate already-read combat history', () => {
  // Exercise the production policy connection, including replacements followed by ordinary appends.
  let timeline;
  const profession = defineProfession({
    id: 'timeline-fixture',
    name: 'Timeline Fixture',
    catalog: createCanonicalCatalog(),
    attributeRules: {
      modifyAttributes(context, attributes) {
        timeline = context.timeline;
        return attributes;
      }
    }
  });
  const policy = createGw2SchedulerPolicy();
  const { context } = createScheduler({ profession, schedulerPolicy: policy });
  const owner = { source: 'fixture', sourceId: 'fixture.history', actorType: 'player' };
  policy.critical(context, { ...owner, type: 'damage', at: 0, coefficient: 1 });
  const buff = context.emit({ ...owner, type: 'buff', at: 0, kind: 'might', duration: 1, stacks: 1 });
  const action = context.emit({ ...owner, type: 'action', at: 0, skillId: 1, rechargeReadyAt: 1 });
  assert.equal(timeline.timedStacks('might', 0.5, 0, 25), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 0.5), true);

  context.replaceEvent(buff, { duration: 10 });
  context.replaceEvent(action, { rechargeReadyAt: 10 });
  context.emit({ ...owner, type: 'marker', at: 1 });
  assert.equal(timeline.timedStacks('might', 2, 0, 25), context.buffStacks('might', 2));
  assert.equal(timeline.timedStacks('might', 2, 0, 25), 1);
  assert.equal(timeline.skillOnCooldownAt(1, 2), true);

  const snapshot = context.emit({ ...owner, type: 'cooldown_snapshot', at: 3, cooldowns: { 1: 10 } });
  assert.equal(timeline.skillOnCooldownAt(1, 4), true);
  context.replaceEvent(snapshot, { cooldowns: {} });
  assert.equal(timeline.skillOnCooldownAt(1, 4), false);
  assert.equal(timeline.skillOnCooldownAt(1, 2), true);

  const firstSwap = context.emit({ ...owner, type: 'weapon_set', at: 2, weaponSet: 2 });
  context.emit({ ...owner, type: 'weapon_set', at: 2, weaponSet: 1 });
  assert.equal(timeline.activeWeaponSetAt(2), 1);
  context.replaceEvent(firstSwap, { at: 3 });
  assert.equal(timeline.activeWeaponSetAt(2), 1);
  assert.equal(timeline.activeWeaponSetAt(3), 2);

  // Type changes must remove old buckets and add newly indexed event types.
  const marker = context.replaceEvent(buff, { type: 'marker' });
  assert.equal(timeline.timedStacks('might', 2, 0, 25), 0);
  context.replaceEvent(marker, { type: 'buff', kind: 'fury' });
  assert.equal(timeline.timedActive('fury', 2), true);
  assert.equal(timeline.timedActive('might', 2), false);
});

function weaponSetEvent(at, causalOrder, weaponSet) {
  return {
    type: 'weapon_set',
    at,
    causalOrder,
    source: 'fixture',
    sourceId: `set-${weaponSet}`,
    weaponSet
  };
}

test('timeline indexing orders late events by timestamp and causal order', () => {
  const timeline = createGw2TimelineIndex({
    events: [weaponSetEvent(2, 3, 2), weaponSetEvent(1, 2, 1), weaponSetEvent(1, 1, 2)]
  });

  assert.equal(timeline.activeWeaponSetAt(1), 1);
  assert.equal(timeline.activeWeaponSetAt(2), 2);
});
