/** Immediate buff reactions settle before tied strikes without promoting unrelated or delayed work. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { GW2_RESOLVER_PHASE } from '#gw2/platform/resolver/event-phase.js';
import { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';

test('an early buff chain settles before a tied strike after ordinary work has started', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 1 }));
  coordinator.queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary);
  const hit = coordinator.packets.enqueue({ type: 'damage', at: 1, priority: -5 });
  const fury = coordinator.packets.enqueue({ type: 'buff', kind: 'fury', at: 1, priority: -6 });
  assert.equal(coordinator.queue.dequeue(), fury);
  const might = coordinator.withCause(fury, () => coordinator.packets.enqueue({ type: 'buff', kind: 'might', at: 1 }));
  assert.equal(coordinator.queue.dequeue(), might);
  const vigor = coordinator.withCause(might, () => coordinator.packets.enqueue({ type: 'buff', kind: 'vigor', at: 1 }));
  assert.equal(coordinator.queue.dequeue(), vigor);
  assert.equal(coordinator.queue.dequeue(), hit);
  assert.equal(might.parentEventOrder, fury.eventOrder);
  assert.equal(vigor.parentEventOrder, might.eventOrder);
});

test('buff priority does not promote damage, conditions, tasks, or delayed grants', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 1 }));
  coordinator.queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary);
  const hit = coordinator.packets.enqueue({ type: 'damage', at: 1 });
  const fury = coordinator.packets.enqueue({ type: 'buff', kind: 'fury', at: 1, priority: -1 });
  assert.equal(coordinator.queue.dequeue(), fury);
  const futureHit = coordinator.packets.enqueue({ type: 'damage', at: 2, priority: 0 });
  // A delayed reaction must retain its own priority against other future grants.
  const futureGrant = coordinator.packets.enqueue({ type: 'buff', at: 2, kind: 'might', priority: -0.5 });
  coordinator.withCause(fury, () => {
    coordinator.packets.enqueue({ type: 'damage', at: 1 });
    coordinator.packets.enqueue({ type: 'condition', at: 1 });
    coordinator.packets.enqueue({ type: 'buff', at: 2, kind: 'vigor' });
  });
  const taskGrant = coordinator.withCause(
    fury,
    () => coordinator.packets.enqueue({ type: 'buff', at: 1, kind: 'might' }),
    true
  );
  assert.equal(coordinator.queue.dequeue(), hit);
  assert.equal(coordinator.queue.dequeue().type, 'damage');
  assert.equal(coordinator.queue.dequeue().type, 'condition');
  assert.equal(coordinator.queue.dequeue(), taskGrant);
  assert.equal(coordinator.queue.dequeue(), futureGrant);
  const delayed = coordinator.queue.dequeue();
  assert.equal(delayed.kind, 'vigor');
  assert.equal(delayed.priority ?? 0, 0);
  assert.equal(coordinator.queue.dequeue(), futureHit);
});

test('a hit-triggered buff follows its hit and does not inherit strike priority', () => {
  const coordinator = createExecutionCoordinator(() => ({ time: 1 }));
  const hit = coordinator.packets.enqueue({ type: 'damage', at: 1, priority: -1 });
  const sibling = coordinator.packets.enqueue({ type: 'damage', at: 1 });
  assert.equal(coordinator.queue.dequeue(), hit);
  const reward = coordinator.withCause(hit, () => coordinator.packets.enqueue({ type: 'buff', at: 1, kind: 'might' }));
  assert.equal(coordinator.queue.dequeue(), reward);
  assert.equal(reward.priority ?? 0, 0);
  assert.equal(coordinator.queue.dequeue(), sibling);
});
