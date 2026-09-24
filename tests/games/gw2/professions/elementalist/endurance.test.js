import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';
import {
  professionEnduranceReadyAt,
  advanceProfessionEndurance
} from '#gw2/platform/combat/resources/endurance-policy.js';

// Use explicit self/other recipients to verify that only player Vigor changes recovery.
const vigor = (at, duration, includesSelf = true) => ({
  type: 'buff',
  kind: 'vigor',
  at,
  duration,
  resolvedAudience: { includesSelf, includesSummons: !includesSelf, companionIds: [] }
});

test('Elementalist ignores cancelled Vigor grants and extensions in recovery and readiness', () => {
  // Shared replay must exclude cancelled effects while keeping self-only recovery independent of wait partitions.
  for (const cancelledType of ['buff', 'boon_extension']) {
    for (const targets of [[8], [2, 3, 4, 6, 8]]) {
      const context = {
        catalog: elementalistCatalog,
        profession: { resources: { endurance: elementalistEndurance } },
        state: { time: 0, profession: { core: { endurance: 0, enduranceUpdatedAt: 0 } } },
        config: {},
        events: [
          vigor(0, 20, false),
          vigor(2, 2),
          { ...vigor(0, 20), cancelled: true },
          { type: 'boon_extension', at: 3, duration: 2, kind: 'vigor', cancelled: cancelledType === 'boon_extension' }
        ]
      };
      const state = context.state.profession.core;
      const readyAt = cancelledType === 'buff' ? 8 : 9;
      assert.equal(professionEnduranceReadyAt(context, 50, 0), readyAt);
      for (const at of targets) advanceProfessionEndurance(context, at);
      assert.equal(state.endurance, cancelledType === 'buff' ? 50 : 45);
      assert.equal(professionEnduranceReadyAt(context, 50, 8), readyAt);
      advanceProfessionEndurance(context, readyAt);
      assert.deepEqual(state, { endurance: 50, enduranceUpdatedAt: readyAt });
    }
  }
});

test('timed Vigor recovery crosses application and expiry boundaries without rewinding', () => {
  const context = {
    catalog: elementalistCatalog,
    profession: { resources: { endurance: elementalistEndurance } },
    state: { time: 0, profession: { core: { endurance: 0, enduranceUpdatedAt: 0 } } },
    config: {},
    events: [vigor(2, 2), vigor(0, 20, false)]
  };
  const state = context.state.profession.core;

  // Two base seconds, two Vigor seconds, then two base seconds restore 35 endurance.
  advanceProfessionEndurance(context, 6);
  assert.equal(state.endurance, 35);
  advanceProfessionEndurance(context, 3);
  assert.deepEqual(state, { endurance: 35, enduranceUpdatedAt: 6 });
  Object.assign(state, { endurance: 0, enduranceUpdatedAt: 0 });
  assert.equal(professionEnduranceReadyAt(context, 20, 0), 3.36);
  assert.equal(professionEnduranceReadyAt(context, 50, 0), 9);
  Object.assign(state, { endurance: 0, enduranceUpdatedAt: 4 });
  assert.equal(professionEnduranceReadyAt(context, 50, 4), 14);
});

test('Vigor stacks duration without stacking its rate and respects the duration cap', () => {
  const context = {
    catalog: elementalistCatalog,
    profession: { resources: { endurance: elementalistEndurance } },
    state: { time: 0, profession: { core: { endurance: 0, enduranceUpdatedAt: 0 } } },
    config: {},
    events: [vigor(3, 2), vigor(2, 2)]
  };
  const state = context.state.profession.core;
  advanceProfessionEndurance(context, 8);
  assert.equal(state.endurance, 50);
  assert.equal(professionEnduranceReadyAt(context, 50, 8), 8);

  context.events = [vigor(0, 20), vigor(0, 20)];
  const afterCap = { endurance: 0, enduranceUpdatedAt: 29 };
  context.state.profession.core = afterCap;
  advanceProfessionEndurance(context, 32);
  assert.equal(afterCap.endurance, 17.5);
});

test('permanent Vigor keeps its rate through timed expiry and endurance remains capped', () => {
  const context = {
    catalog: elementalistCatalog,
    profession: { resources: { endurance: elementalistEndurance } },
    state: { time: 0, profession: { core: { endurance: 0, enduranceUpdatedAt: 0 } } },
    config: { boons: { vigor: true } },
    events: [vigor(2, 2)]
  };
  const state = context.state.profession.core;
  advanceProfessionEndurance(context, 6);
  assert.equal(state.endurance, 45);
  assert.equal(professionEnduranceReadyAt(context, 50, 6), 6.68);
  advanceProfessionEndurance(context, 30);
  assert.equal(state.endurance, 100);
});

test('Phoenix Vigor contributes to recovery and the next dodge after expiry', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Earth']],
    weapons: ['Scepter', 'Dagger'],
    assumptions: { vigor: false }
  };
  const recovery = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 6000] });
  const buff = recovery.events.find((event) => event.type === 'buff' && event.kind === 'vigor');
  const firstDodge = recovery.events.find((event) => event.type === 'action' && event.skillName === 'Dodge');
  const end = recovery.steps.at(-1).end / 1000;
  assert.deepEqual(recovery.warnings, []);
  assert.ok(end > buff.at + buff.duration);
  // The first dodge is spent at completion; subsequent regeneration includes exactly the Vigor window.
  const expected = (end - firstDodge.endsAt) * 5 + buff.duration * 2.5;
  assert.ok(Math.abs(recovery.planningState.profession.endurance - expected) < 1e-6);

  const retry = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 'Dodge'] });
  const nextDodge = retry.events.filter((event) => event.type === 'action' && event.skillName === 'Dodge').at(-1);
  assert.deepEqual(retry.warnings, []);
  const threshold = firstDodge.endsAt + (50 - buff.duration * 2.5) / 5;
  const expectedReadyAt = Math.ceil(threshold * 25) / 25;
  assert.ok(expectedReadyAt > buff.at + buff.duration);
  assert.ok(Math.abs(nextDodge.at - expectedReadyAt) < 1e-6);
});
