import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import {
  activeBoonStacks,
  activeBuffStacks,
  boonActive,
  buffActive,
  countActiveBoons
} from '#gw2/platform/combat/query/runtime-query.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';

// These grants isolate query source and recipient contracts from profession packet schedules.
function grant(kind, stacks, companionId = null) {
  return {
    type: 'buff',
    kind,
    at: 1,
    duration: 5,
    stacks,
    resolvedAudience: {
      includesSelf: companionId === null,
      includesSummons: companionId !== null,
      companionIds: companionId === null ? [] : [companionId],
      alliedPlayerCount: 0,
      recipientCount: 1
    }
  };
}

test('boon presence and stacks agree in previews without exposing scheduled grants to live queries', () => {
  const events = [grant('fury', 1), grant('might', 3)];
  const context = { time: 2, config: { boons: { might: 2 } }, timeline: createGw2TimelineIndex({ events }) };
  assert.equal(boonActive(context, 'fury'), true);
  assert.equal(activeBoonStacks(context, 'fury'), 1);
  assert.equal(activeBoonStacks(context, 'might'), 5);
  assert.equal(activeBoonStacks(context, 'might', 4), 4);
  const runtime = { boons: new Map(), buffs: new Map() };
  const live = { ...context, runtime };
  assert.equal(boonActive(live, 'fury'), false);
  assert.equal(activeBoonStacks(live, 'fury'), 0);
  assert.equal(activeBoonStacks(live, 'might'), 2);
  for (const event of events) recordBuffApplication(runtime.boons, event);
  assert.equal(boonActive(live, 'fury'), true);
  assert.equal(activeBoonStacks(live, 'might'), 5);
  for (const candidate of [context, live]) {
    assert.equal(boonActive({ ...candidate, time: 6 }, 'fury'), false);
    assert.equal(activeBoonStacks({ ...candidate, time: 6 }, 'fury'), 0);
    assert.equal(activeBoonStacks({ ...candidate, time: 6 }, 'might'), 2);
  }
});

test('boon and buff queries isolate recipients and player assumptions in live and preview modes', () => {
  const events = [
    grant('might', 2),
    grant('might', 3, 'old-pet'),
    grant('might', 7, 'new-pet'),
    grant('fury', 1, 'old-pet'),
    grant('fury', 1, 'old-pet'),
    grant('superspeed', 1),
    grant('custom', 4, 'old-pet'),
    grant('custom', 9, 'new-pet')
  ];
  const runtime = { boons: new Map(), buffs: new Map() };
  for (const event of events)
    recordBuffApplication(['might', 'fury'].includes(event.kind) ? runtime.boons : runtime.buffs, event);

  const config = { boons: { might: 5, quickness: true }, fixedBoonCount: 12 };
  const preview = { time: 2, config, timeline: createGw2TimelineIndex({ events }) };
  const oldPet = { actor: 'companion', companionId: 'old-pet' };
  const newPet = { actor: 'companion', companionId: 'new-pet' };
  for (const context of [preview, { ...preview, runtime }]) {
    assert.equal(activeBoonStacks(context, 'might'), 7);
    assert.equal(activeBoonStacks(context, 'might', 25, oldPet), 3);
    assert.equal(activeBoonStacks(context, 'might', 25, newPet), 7);
    assert.equal(activeBoonStacks(context, 'might', 2, oldPet), 2);
    assert.equal(boonActive(context, 'quickness', oldPet), false);
    assert.equal(countActiveBoons(context), 12);
    assert.equal(countActiveBoons(context, oldPet), 2);
    assert.equal(countActiveBoons(context, newPet), 1);
    assert.equal(countActiveBoons(context, { actor: 'companion', companionId: null }), 0);
    assert.equal(activeBuffStacks(context, 'custom'), 0);
    assert.equal(activeBuffStacks(context, 'custom', 25, oldPet), 4);
    assert.equal(activeBuffStacks(context, 'custom', 25, newPet), 9);
    assert.equal(buffActive(context, 'superspeed', oldPet), false);
    assert.equal(buffActive(context, 'superspeed'), true);
    assert.equal(activeBoonStacks(context, 'custom', 25, oldPet), 0);
    assert.equal(buffActive(context, 'fury', oldPet), false);
    // Duration stacking survives original packet expiry and stops at the pooled expiry.
    assert.equal(boonActive({ ...context, time: 7 }, 'fury', oldPet), true);
    assert.equal(boonActive({ ...context, time: 11 }, 'fury', oldPet), false);
  }

  const services = createMechanicCombatServices({ ...runtime, config });
  assert.equal(services.activeBoonStacks('might', 2, 25, oldPet), 3);
  assert.equal(services.activeBuffStacks('custom', 2, 25, newPet), 9);
});

test('Mesmer preview duration defaults do not replace accepted buff lifetimes', () => {
  const event = { ...grant('fencer', 2), duration: undefined };
  const preview = { time: 2, timeline: createGw2TimelineIndex({ events: [event] }) };
  assert.equal(timedStacks(preview, 'fencer', 5, 10), 2);
  assert.equal(timedStacks({ ...preview, time: 6 }, 'fencer', 5, 10), 0);
  const runtime = { boons: new Map(), buffs: new Map() };
  assert.equal(timedStacks({ ...preview, runtime }, 'fencer', 5, 10), 0);
  recordBuffApplication(runtime.buffs, { ...event, duration: 1 });
  assert.equal(timedStacks({ ...preview, runtime, time: 1 }, 'fencer', 5, 10), 2);
  assert.equal(timedStacks({ ...preview, runtime }, 'fencer', 5, 10), 0);
});
