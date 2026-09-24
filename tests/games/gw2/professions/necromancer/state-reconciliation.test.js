import assert from 'node:assert/strict';
import test from 'node:test';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { createReaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import { createScourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { createRitualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { handleNecromancerStateEvent } from '#gw2/professions/necromancer/core/mechanics/event-handlers.js';
import {
  handleNecromancerPainfulBond,
  handleNecromancerWeaponSpell
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/event-handlers.js';
import { ritualistResolverEventReactions } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-effects.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { restoreNecromancerStateSlice } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';
import {
  emitNecromancerStateSnapshot,
  projectNecromancerPlanningState
} from '#gw2/professions/necromancer/family-state.js';
import { createHarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { necromancerCoreResolverEventHandlers } from '#gw2/professions/necromancer/core/mechanics/reactions.js';

// A pool update must preserve resolver-owned traits and specialization state, and detach its retained value.
test('life-force observations update only the pool', () => {
  const core = createNecromancerCoreState();
  const harbinger = createHarbingerState({ initialBlight: 12 });
  core.activeShroud = 'harbinger';
  harbinger.meltdownUntil = 10;
  const profession = { core, specialization: { kind: 'Harbinger', state: harbinger } };
  const before = structuredClone(profession);
  const event = { type: 'necromancer.life-force', at: 1, state: { lifeForce: { ...core.lifeForce, value: 42 } } };
  necromancerCoreResolverEventHandlers['necromancer.life-force']({ profession }, event);
  before.core.lifeForce.value = 42;
  assert.deepEqual(profession, before);
  core.lifeForce.value = 0;
  assert.equal(event.state.lifeForce.value, 42);
});

test('state restoration copies primitives directly while detaching objects and rejecting uncloneable values', (t) => {
  // Preserve exact primitive values without clone calls, including undefined keys and signed zero.
  const clone = t.mock.method(globalThis, 'structuredClone');
  const snapshot = { number: NaN, zero: -0, text: 'state', flag: false, empty: null, unset: undefined, big: 1n };
  const state = Object.fromEntries(Object.keys(snapshot).map((key) => [key, 'old']));
  restoreNecromancerStateSlice(state, snapshot);
  assert.deepEqual(state, snapshot);
  assert.equal(clone.mock.callCount(), 0);
  state.nested = {};
  snapshot.nested = { values: [1] };
  restoreNecromancerStateSlice(state, snapshot);
  assert.equal(clone.mock.callCount(), 1);
  state.nested.values.push(2);
  assert.deepEqual(snapshot.nested.values, [1]);
  for (const value of [Symbol('invalid'), () => {}]) {
    assert.throws(() => restoreNecromancerStateSlice({ value: null }, { value }), { name: 'DataCloneError' });
  }
});

test('Necromancer snapshot candidates normalize resources without mutating live state', () => {
  // Harbinger normalization must remain local even when emission no longer clones its input in advance.
  const core = createNecromancerCoreState();
  const harbinger = createHarbingerState();
  core.lifeForce.value = 150;
  harbinger.blightExpiries = Array.from({ length: 27 }, (_, index) => index);
  const profession = { core, specialization: { kind: 'Harbinger', state: harbinger } };
  const events = [];
  const context = {
    state: { profession },
    events,
    emit: (event) => {
      events.push(event);
      return event;
    }
  };
  const event = emitNecromancerStateSnapshot(context, 0, 'update');
  assert.equal(event.state.lifeForce.value, 100);
  assert.equal(event.state.blight, 25);
  assert.deepEqual(event.state.blightExpiries, harbinger.blightExpiries.slice(-25));
  assert.equal(emitNecromancerStateSnapshot(context, 0, 'update'), null);
  const planning = projectNecromancerPlanningState({ schedulerState: { profession } });
  planning.blightExpiries.push(99);
  core.activeMinions.fixture = 1;
  assert.deepEqual(event.state.activeMinions, {});
  assert.equal(core.lifeForce.value, 150);
  assert.equal(harbinger.blight, 0);
  assert.equal(harbinger.blightExpiries.length, 27);
  assert.equal(event.state.blightExpiries.length, 25);
});

test('restoration retains unchanged detached flat values but repairs mutations and shared references', (t) => {
  // Compare live values rather than the prior snapshot: resolver mutations must still be overwritten.
  const snapshot = { list: [NaN, -0, null], record: { count: 2, until: Infinity } };
  const state = structuredClone(snapshot);
  const retained = { ...state };
  const clone = t.mock.method(globalThis, 'structuredClone');
  restoreNecromancerStateSlice(state, snapshot);
  assert.equal(clone.mock.callCount(), 0);
  assert.equal(state.list, retained.list);
  assert.equal(state.record, retained.record);
  state.list[1] = 0;
  state.record.count = 3;
  restoreNecromancerStateSlice(state, snapshot);
  assert.deepEqual(state, snapshot);
  assert.equal(clone.mock.callCount(), 2);
  state.list.push(4);
  state.record.count = 5;
  assert.deepEqual(snapshot.list, [NaN, -0, null]);
  assert.equal(snapshot.record.count, 2);

  // Even equal inputs must detach when the root or a nested child aliases the snapshot.
  const shared = { values: [1] };
  const aliased = { root: snapshot.record, nested: { child: shared }, map: new Map([['a', 1]]) };
  const source = { root: snapshot.record, nested: { child: shared }, map: new Map([['a', 1]]) };
  restoreNecromancerStateSlice(aliased, source);
  aliased.root.count = 9;
  aliased.nested.child.values.push(2);
  aliased.map.set('b', 2);
  assert.equal(source.root.count, 2);
  assert.deepEqual(shared.values, [1]);
  assert.deepEqual(source.map, new Map([['a', 1]]));
  for (const invalid of [Symbol('invalid'), () => {}]) {
    assert.throws(() => restoreNecromancerStateSlice({ value: { invalid } }, { value: { invalid } }), {
      name: 'DataCloneError'
    });
  }

  const sparse = { value: [undefined, undefined] };
  restoreNecromancerStateSlice(sparse, { value: Array(2) });
  assert.equal(sparse.value.length, 2);
  assert.equal(Object.hasOwn(sparse.value, 0), false);
});

test('Core and Reaper snapshots retain resolver clocks and carapace multiplicities', () => {
  // Scheduler snapshots update resources and Victory while leaving Nova progress and resolver effects intact.
  const core = createNecromancerCoreState();
  const reaper = createReaperState();
  const context = { profession: { core, specialization: { kind: 'Reaper', state: reaper } } };
  const snapshot = structuredClone({
    ...core,
    ...reaper,
    lifeForce: { value: 42, maximum: 100, updatedAt: 0, rate: 0 },
    chillingVictoryReadyAt: 7,
    carapaceExpiries: [10, 10, 20]
  });
  delete snapshot.availableFlips;
  snapshot.unknownField = true;
  core.targetChilledUntil = 12;
  core.traitProcReadyAt = { proc: 8 };
  core.carapaceExpiries = [10, 20, 20];
  reaper.chillingNovaProgress = 0.75;
  reaper.chillingNovaReadyAt = 9;

  for (const at of [1, 2]) {
    handleNecromancerStateEvent(context, { at, state: snapshot });
    assert.equal(core.lifeForce.value, 42);
    assert.equal(core.targetChilledUntil, 12);
    assert.deepEqual(core.traitProcReadyAt, { proc: 8 });
    assert.deepEqual(core.carapaceExpiries, [10, 10, 20, 20]);
    assert.equal(reaper.chillingNovaProgress, 0.75);
    assert.equal(reaper.chillingNovaReadyAt, 9);
    assert.equal(reaper.chillingVictoryReadyAt, 7);
  }

  assert.equal(Object.hasOwn(core, 'availableFlips'), false);
  assert.equal(Object.hasOwn(core, 'unknownField'), false);
  assert.equal(Object.hasOwn(reaper, 'lifeForce'), false);
  assert.deepEqual(snapshot.carapaceExpiries, [10, 10, 20]);
});

test('Scourge restores detached shade state without rewinding Demonic Lore', () => {
  // Shades and Nourishing Ashes come from the scheduler; Demonic Lore advances only in resolution.
  const core = createNecromancerCoreState();
  const scourge = createScourgeState();
  const context = { profession: { core, specialization: { kind: 'Scourge', state: scourge } } };
  const snapshot = { ...core, ...scourge, shades: [10], nourishingAshesReadyAt: 5 };
  scourge.demonicLoreReadyAt = 8;
  handleNecromancerStateEvent(context, { at: 1, state: snapshot });
  assert.equal(scourge.demonicLoreReadyAt, 8);
  assert.equal(scourge.nourishingAshesReadyAt, 5);
  scourge.shades.push(20);
  assert.deepEqual(snapshot.shades, [10]);
  assert.equal(Object.hasOwn(core, 'shades'), false);
});

test('Ritualist snapshots preserve Bond cadence and independent weapon-spell spending', () => {
  // Interleave real resolver grants and spending with stale scheduler snapshots.
  const core = createNecromancerCoreState();
  const ritualist = createRitualistState();
  const queued = [];
  const context = {
    profession: { core, specialization: { kind: 'Ritualist', state: ritualist } },
    catalog: necromancerCatalog,
    queue: { enqueue: (event) => queued.push(event) }
  };
  const snapshot = structuredClone({ ...core, ...ritualist });
  handleNecromancerPainfulBond(context, { at: 0, mode: 'apply', duration: 2 });
  const anchor = ritualist.painfulBondPulseAnchorAt;
  handleNecromancerWeaponSpell(context, {
    at: 0,
    spell: 'splinter',
    duration: 10,
    playerStacks: 3,
    allyStacks: 2,
    resolvedAudience: { companionIds: ['spirit:1'] }
  });
  handleNecromancerStateEvent(context, { at: 0.5, state: snapshot });
  handleNecromancerPainfulBond(context, { at: 1, mode: 'apply', duration: 3 });
  ritualistResolverEventReactions.damage(context, { at: 1, actorType: 'player', coefficient: 1 });
  ritualistResolverEventReactions.damage(context, {
    at: 1,
    actorType: 'summon',
    summonOwner: 'spirit:1',
    coefficient: 1
  });
  const spell = ritualist.weaponSpells.splinter;
  handleNecromancerStateEvent(context, { at: 1.5, state: snapshot });
  assert.equal(ritualist.painfulBondUntil, 5);
  assert.equal(ritualist.painfulBondPulseAnchorAt, anchor);
  assert.equal(queued.filter((event) => event.type === 'necromancer.painful-bond-pulse').length, 1);
  assert.equal(ritualist.weaponSpells.splinter, spell);
  assert.equal(spell.recipients.player.charges, 2);
  assert.equal(spell.recipients['spirit:1'].charges, 1);
  assert.deepEqual(snapshot.weaponSpells, {});
  // Per-recipient grants enforce exact expiry without a spell-level deadline.
  const beforeExpiryHits = queued.length;
  ritualistResolverEventReactions.damage(context, { at: 10, actorType: 'player', coefficient: 1 });
  ritualistResolverEventReactions.damage(context, {
    at: 10,
    actorType: 'summon',
    summonOwner: 'spirit:1',
    coefficient: 1
  });
  assert.equal(queued.length, beforeExpiryHits);
  assert.equal(spell.recipients.player.charges, 2);
  assert.equal(spell.recipients['spirit:1'].charges, 1);
});
