import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { resolveGw2Timeline } from '#gw2/platform/resolver/resolve-timeline.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { createFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import {
  advanceTomeState,
  guardianTomeEventHandlers,
  reactToAshesHit
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes.js';
import { reactToFirebrandBuffTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';

// Isolate charge lifetimes from unrelated page regeneration, target damage, and trait procs.
function ashesContext() {
  const state = createFirebrandState();
  const events = [];
  return {
    state: { profession: { core: {}, specialization: { kind: 'Firebrand', state } } },
    config: { specialization: 'Firebrand', selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE] },
    catalog: guardianCatalog,
    events,
    queue: { enqueue: (event) => events.push(event) },
    applyCondition: (event) => events.push(event),
    recordProc() {}
  };
}

test('Ashes application requires a canonical grant and detaches resolver spending from the event', () => {
  const context = ashesContext();
  const apply = guardianTomeEventHandlers['guardian.ashes-granted'];
  assert.throws(() => apply(context, { at: 1 }), /requires a charge grant/);
  const ashes = { charges: 2, expiresAt: 10, readyAt: 3 };
  apply(context, { at: 1, ashes, ashesBurnDuration: 2 });
  const state = context.state.profession.specialization.state;
  assert.deepEqual(state.ashes, ashes);
  state.ashes.charges -= 1;
  assert.equal(ashes.charges, 2);
  assert.throws(() => apply(context, { at: 1, ashes: { charges: -1, expiresAt: 10 } }), /non-negative/);
});

test('Ashes grant, buff history, expiry event, and planning state share the effect-clock deadline', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      { type: 'wait', durationMs: 1 },
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      { type: 'wait', durationMs: 11000 }
    ],
    config: { specialization: 'Firebrand' }
  });
  assert.deepEqual(result.warnings, []);
  const grant = result.events.find((event) => event.type === 'guardian.ashes-granted');
  const expiry = result.events.find((event) => event.type === 'guardian.ashes-expired');
  const [buff] = boonApplicationsAt(result.events, 'ashes-of-the-just', grant.at);
  const application = result.events.find((event) => event.type === 'buff' && event.kind === 'ashes-of-the-just');
  assert.ok(buff.expiresAt > grant.at + application.duration, 'off-grid application must reach the next effect tick');
  assert.equal(grant.ashes.expiresAt, buff.expiresAt);
  assert.equal(expiry.at, buff.expiresAt);
  assert.equal(result.planningState.profession.ashes.expiresAt, buff.expiresAt);
  assert.equal(result.planningState.profession.ashes.charges, 0);
  assert.equal(result.combatState.profession.ashes.charges, 0);
});

test('Ashes stays consumable through expiry, then resolver cleanup removes the remaining charges', () => {
  for (const at of [10.599999, 10.6, 10.600001]) {
    for (const operation of ['hit', 'scheduler', 'resolver']) {
      const context = ashesContext();
      const state = context.state.profession.specialization.state;
      state.ashes = { charges: 1, expiresAt: 10.6 };
      if (operation === 'hit') {
        reactToAshesHit(context, { at, actorType: 'player', coefficient: 1, skillName: 'Strike' }, { hitContext: {} });
        assert.equal(context.events.length, at <= 10.6 ? 1 : 0, `${operation} at ${at}`);
      } else {
        if (operation === 'scheduler') advanceTomeState(context, at);
        else guardianTomeEventHandlers['guardian.ashes-expired'](context, { at });
        const stillActive = operation === 'scheduler' ? at <= 10.6 : at < 10.6;
        assert.equal(state.ashes.charges, Number(stillActive), `${operation} at ${at}`);
      }
    }
  }
});

test('Quickfire refresh preserves live charges and their trigger timer, but cannot revive expired charges', () => {
  for (const at of [10.599999, 10.6]) {
    const context = ashesContext();
    const state = context.state.profession.specialization.state;
    state.ashes = { charges: 2, expiresAt: 10.6, readyAt: 11 };
    reactToFirebrandBuffTraits(context, {
      type: 'buff',
      kind: 'quickness',
      at,
      resolvedAudience: { includesSelf: true, alliedPlayerCount: 0 }
    });
    assert.equal(state.ashes.charges, at < 10.6 ? 3 : 1);
    assert.equal(state.ashes.readyAt, at < 10.6 ? 11 : 0);
    assert.equal(state.ashes.expiresAt, 20.6);
    assert.equal(context.events[0].at, state.ashes.expiresAt);
    guardianTomeEventHandlers['guardian.ashes-expired'](context, { at: 10.6 });
    assert.equal(state.ashes.charges, at < 10.6 ? 3 : 1, 'stale expiry cannot clear the refreshed grant');
  }
});

test('Quickfire allies use the tick-aligned lifetime and can proc exactly at expiry', () => {
  for (const [at, expectedProcs] of [
    [0.001, 1],
    [0, 1]
  ]) {
    const context = ashesContext();
    context.config.allies = { count: 1, strikesPerSecond: 0.1 };
    reactToFirebrandBuffTraits(context, {
      type: 'buff',
      kind: 'quickness',
      at,
      resolvedAudience: { includesSelf: false, alliedPlayerCount: 1 }
    });
    assert.equal(context.events.length, expectedProcs, `grant at ${at}`);
  }
});

// Replay real grant/expiry events with an isolated strike to test queue ordering, not just the hit guard.
test('tome and Quickfire Ashes allow an expiry-time strike before cleanup regardless of emission order', () => {
  const scheduled = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Epilogue: Ashes of the Just', { type: 'wait', durationMs: 11000 }],
    config: { specialization: 'Firebrand' }
  });
  const tomeEvents = scheduled.events.filter((event) =>
    ['guardian.ashes-granted', 'guardian.ashes-expired'].includes(event.type)
  );
  const quickfireContext = ashesContext();
  reactToFirebrandBuffTraits(quickfireContext, {
    type: 'buff',
    kind: 'quickness',
    at: 0,
    resolvedAudience: { includesSelf: true, alliedPlayerCount: 0 }
  });
  const quickfireExpiry = quickfireContext.events[0];
  const quickfireEvents = [
    {
      ...tomeEvents[0],
      at: 0,
      ashes: { charges: 1, expiresAt: quickfireExpiry.at }
    },
    quickfireExpiry
  ];
  for (const events of [tomeEvents, quickfireEvents]) {
    const expiry = events[1].at;
    for (const offset of [-0.000001, 0, 0.000001]) {
      const strike = {
        type: 'damage',
        at: expiry + offset,
        source: 'guardian',
        sourceId: 'test-strike',
        actorType: 'player',
        skillName: 'Boundary strike',
        coefficient: 1,
        weaponStrength: 1000,
        hits: 1,
        canCrit: false
      };
      for (const ordered of [
        [...events, strike],
        [strike, ...events]
      ]) {
        const result = resolveGw2Timeline({
          profession: guardianProfession.resolveRuntime({ specialization: 'Firebrand' }),
          config: { specialization: 'Firebrand' },
          traits: new Set(),
          stream: buildScheduledEventStream({ events: ordered, rotationEndTime: expiry + 1 })
        });
        const burns = result.resolvedEvents.filter(
          (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
        );
        assert.equal(burns.length, offset <= 0 ? 1 : 0, `strike offset ${offset}`);
        assert.equal(result.combatState.profession.specialization.state.ashes.charges, 0);
      }
    }
  }
});
