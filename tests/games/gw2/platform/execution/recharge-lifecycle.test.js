import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { gw2RechargeIntervals } from '#gw2/platform/combat/recharge.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';

const magazine = { id: 1, name: 'Magazine', ammo: 3, cooldown: 5 };
const ordinary = { id: 2, name: 'Ordinary', cooldown: 10 };
const preserved = { id: 3, name: 'Preserved', cooldown: 20 };
function fixture() {
  const state = { time: 0 };
  const catalog = new Map([magazine, ordinary, preserved, { ...magazine, id: 9 }].map((skill) => [skill.id, skill]));
  const controller = createCooldownController({
    clock: state,
    skillFor: (id) => catalog.get(id),
    rechargeDuration: (skill) => skill.cooldown
  });
  return { state, controller };
}

// A reset clears every skill-owned timer and reconstructs ammunition from a fresh, full pool.
test('recharge reset clears all deadlines, progress, ammo queues, and use lockouts', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  controller.startRecharge(preserved, 0);
  controller.spendAmmo(magazine, 0);
  controller.setAmmoLockout(magazine, 10, 0);
  state.time = 2;
  controller.resetAll();
  assert.equal(controller.readyAt(ordinary.id), undefined);
  assert.equal(controller.rechargeFor(ordinary.id), undefined);
  assert.equal(controller.readyAt(preserved.id), undefined);
  assert.equal(controller.rechargeFor(preserved.id), undefined);
  assert.equal(controller.readAmmo(magazine.id), undefined);
  const freshAmmo = controller.refreshAmmo(magazine, state.time);
  assert.equal(freshAmmo.charges, 3);
  assert.equal(freshAmmo.nextRechargeAt, null);
  assert.equal(controller.isOnCooldown(magazine.id), false);
});

// Magazine reservation consumes charges now without advancing existing pools to a future completion anchor.
test('reserved magazine rounds recharge serially from their future anchor', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  assert.equal(controller.reserveAmmo(magazine, 2, { workAnchorAt: 4, work: 5 }), 2);
  assert.equal(controller.readAmmo(1).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 3).charges, 1);
  controller.spendAmmo(magazine, 4, 5);
  assert.equal(controller.refreshAmmo(magazine, 9).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 14).charges, 2);
});

// Checkpoint ownership includes earned work, queued rounds and independent exclusions, without aliasing live stores.
test('recharge checkpoints restore relative work and preserve explicitly excluded live cooldowns', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  controller.setReadyAt(preserved.id, 20);
  controller.spendAmmo(magazine, 0);
  controller.spendAmmo(magazine, 0);
  const excluded = new Set([preserved.id, magazine.id]);
  const saved = controller.checkpoint(2, excluded, 'independent');
  assert.deepEqual(
    saved.pools[0].recharges.map(({ work }) => work),
    [3, 5]
  );
  controller.resetAll();
  controller.setReadyAt(preserved.id, 140);
  state.time = 100;
  controller.restoreCheckpoint(saved, 100, excluded, []);
  assert.equal(controller.readyAt(ordinary.id), 108);
  assert.equal(controller.readyAt(preserved.id), 140);
  assert.equal(controller.refreshAmmo(magazine, 103).charges, 2);
  assert.equal(controller.refreshAmmo(magazine, 108).charges, 3);
  assert.deepEqual(
    saved.pools[0].recharges.map(({ work }) => work),
    [3, 5]
  );
});

// Linked identities share one queue; replacement and retirement remain explicit service-owned operations.
test('linked and temporary ammo pools share charges until explicitly retired', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.linkAmmo(1, 9);
  controller.spendAmmo(magazine, 0);
  assert.equal(controller.readAmmo(9).charges, 2);
  controller.replaceAmmoCharges(magazine, 2, 2, []);
  assert.equal(controller.readAmmo(9).charges, 2);
  controller.replaceAmmoCharges(magazine, 1, 0, [{ workAnchorAt: 0, work: 5 }]);
  assert.equal(controller.refreshAmmo(magazine, 5).charges, 1);
  controller.retireAmmo(9);
  assert.equal(controller.hasAmmo(9), false);
  assert.equal(controller.hasAmmo(1), true);
});

// Retiring a magazine removes its availability; a subsequent preparation creates a fresh pool.
test('retiring a magazine also discards its cooldown deadline and use lockout', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.spendAmmo(magazine, 0);
  controller.setAmmoLockout(magazine, 2, 0);
  assert.equal(controller.hasCooldown(magazine.id), true);
  controller.retireAmmo(magazine.id);
  assert.equal(controller.hasAmmo(magazine.id), false);
  assert.equal(controller.readyAt(magazine.id), undefined);
  assert.equal(controller.rechargeFor(magazine.id), undefined);
  assert.equal(controller.ensureAmmo(magazine), true);
  assert.equal(controller.readAmmo(magazine.id).charges, 3);
  assert.equal(controller.isOnCooldown(magazine.id), false);
});

// Formula readiness keeps sub-tick precision and refreshes only the requested magazine on the live clock.
test('live readiness owns ordinary progress and ammo settlement', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0, 0.015);
  state.time = 0.01;
  assert.equal(controller.isOnCooldown(ordinary.id), true);
  state.time = 0.02;
  assert.equal(controller.isOnCooldown(ordinary.id), false);
  assert.equal(controller.readyAt(ordinary.id), 0.015);
  assert.throws(() => controller.isOnCooldown(ordinary.id, 1), /current clock/);

  const other = { ...magazine, id: 99 };
  for (let i = 0; i < 3; i++) {
    controller.spendAmmo(magazine, 0);
    controller.spendAmmo(other, 0);
  }

  state.time = 5;
  assert.equal(controller.isOnCooldown(magazine.id), false);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  assert.equal(controller.readAmmo(other.id).charges, 0);
});

// Expose interval reads so tests can distinguish cached deadlines from recomputation without timing benchmarks.
function rateFixture(skills) {
  const state = { time: 0, windows: [{ start: -Infinity, end: Infinity, active: false }] };
  const intervalReads = [];
  const catalog = new Map(skills.map((skill) => [skill.id, skill]));
  const controller = createCooldownController({
    clock: state,
    skillFor: (id) => catalog.get(id),
    rechargeDuration: (skill) => skill.cooldown,
    rechargeIntervals(skill, start, end) {
      intervalReads.push(skill.id);
      return gw2RechargeIntervals(1.25, () => state.windows, skill, start, end);
    }
  });
  return { state, intervalReads, controller };
}

// Initialization preserves elapsed and future work without paying for a detached observation's projection.
test('ammo initialization leaves recharge work untouched without reading recharge intervals', () => {
  const { state, intervalReads, controller } = rateFixture([magazine, ordinary]);
  assert.equal(controller.ensureAmmo(ordinary), false);
  assert.equal(controller.hasAmmo(ordinary.id), false);
  assert.equal(controller.ensureAmmo(magazine), true);
  controller.spendAmmo(magazine, 0, 5);
  controller.reserveAmmo(magazine, 1, { workAnchorAt: 20, work: 5 });
  const before = controller.readAmmo(magazine.id);
  state.time = 10;
  intervalReads.length = 0;
  assert.equal(controller.ensureAmmo(magazine), true);
  assert.deepEqual(intervalReads, []);
  assert.deepEqual(controller.readAmmo(magazine.id), before);
});

// Closing a prepared magazine's capacity gate rejects initialization without breaking its shared pool.
test('ammo initialization checks current capacity even for existing linked pools', () => {
  const face = { ...magazine, id: 9 };
  let maximum = 0;
  const controller = createCooldownController({
    clock: { time: 0 },
    skillFor: (id) => [magazine, face].find((skill) => skill.id === id),
    rechargeDuration: (skill) => skill.cooldown,
    maximumAmmo: () => maximum
  });
  assert.equal(controller.ensureAmmo(magazine), false);
  assert.equal(controller.hasAmmo(magazine.id), false);
  maximum = magazine.ammo;
  assert.equal(controller.ensureAmmo(magazine), true);
  controller.linkAmmo(magazine.id, face.id);
  controller.spendAmmo(magazine, 0, 5);
  const before = controller.readAmmo(magazine.id);
  maximum = 0;
  assert.equal(controller.ensureAmmo(magazine), false);
  assert.equal(controller.hasAmmo(magazine.id), true);
  assert.deepEqual(controller.readAmmo(magazine.id), before);
  maximum = magazine.ammo;
  assert.equal(controller.ensureAmmo(magazine), true);
  assert.deepEqual(controller.readAmmo(magazine.id), before);
  controller.spendAmmo(face, 0, 5);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  assert.deepEqual(controller.readAmmo(face.id), controller.readAmmo(magazine.id));
});

// Clock advances and live queries reuse fixed projections, but completed work remains available to mechanics.
test('constant-rate deadlines are cached and completed recharge progress is retained', () => {
  for (const metadata of [
    {},
    { rechargeBuffAudience: RECIPIENT.SELF },
    { rechargeIgnoresAlacrity: true },
    { rechargeBuffAudience: RECIPIENT.SUMMONS, rechargeIgnoresAlacrity: true }
  ]) {
    const skill = { ...ordinary, ...metadata };
    const { state, intervalReads, controller } = rateFixture([skill]);
    const readyAt = controller.startRecharge(skill, 0, 10);
    const progress = controller.rechargeFor(skill.id);
    intervalReads.length = 0;
    for (const at of [readyAt - 1, readyAt, readyAt + 1]) {
      state.time = at;
      controller.refresh(at);
      assert.equal(controller.isOnCooldown(skill.id), at < readyAt);
      assert.equal(controller.readyAt(skill.id), readyAt);
      assert.equal(controller.rechargeFor(skill.id), progress);
      assert.equal(controller.hasCooldown(skill.id), true);
    }

    assert.deepEqual(intervalReads, []);
  }
});

// Copy and explicit reductions publish new deadlines even when routine refresh no longer projects player work.
test('cached cooldowns reflect reductions and copied recharge immediately', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  state.time = 2;
  assert.equal(controller.reduceSkillRecharge(ordinary, 3), 3);
  assert.equal(controller.readyAt(ordinary.id), 7);
  controller.copy(ordinary.id, preserved.id);
  assert.equal(controller.readyAt(preserved.id), 7);
  assert.deepEqual(controller.rechargeFor(preserved.id), { workAnchorAt: 2, work: 5 });
  assert.notEqual(controller.rechargeFor(preserved.id), controller.rechargeFor(ordinary.id));
  state.time = 7;
  controller.refresh(7);
  assert.equal(controller.isOnCooldown(ordinary.id), false);
  assert.equal(controller.isOnCooldown(preserved.id), false);
  assert.deepEqual(controller.rechargeFor(ordinary.id), { workAnchorAt: 2, work: 5 });
});

// A received boon can change live readiness before refresh; copied summon identities follow the recipient's rate.
test('summon recharge observes received Alacrity on demand and during refresh', () => {
  const summon = { ...ordinary, id: 4, rechargeBuffAudience: RECIPIENT.SUMMONS };
  const { state, intervalReads, controller } = rateFixture([ordinary, summon]);
  controller.startRecharge(ordinary, 0, 10);
  controller.copy(ordinary.id, summon.id);
  controller.refresh(0);
  assert.equal(controller.readyAt(summon.id), 10);
  state.time = 2;
  assert.equal(controller.isOnCooldown(summon.id), true);
  state.windows = [
    { start: -Infinity, end: 2, active: false },
    { start: 2, end: 6, active: true },
    { start: 6, end: Infinity, active: false }
  ];
  intervalReads.length = 0;
  assert.equal(controller.isOnCooldown(summon.id), true);
  assert.deepEqual(intervalReads, [summon.id]);
  state.time = 9;
  assert.equal(controller.isOnCooldown(summon.id), false);
  assert.equal(controller.readyAt(summon.id), 10);
  controller.refresh(9);
  assert.equal(controller.readyAt(summon.id), 9);
  assert.deepEqual(controller.rechargeFor(summon.id), { workAnchorAt: 0, work: 10 });
});

// Restoring earned work uses the new timeline immediately, without relying on a later global refresh.
test('checkpoint restoration projects work before returning', () => {
  const summon = { ...ordinary, id: 4, rechargeBuffAudience: RECIPIENT.SUMMONS };
  const { state, controller } = rateFixture([ordinary, summon]);
  for (const skill of [ordinary, summon]) controller.startRecharge(skill, 0, 10);
  const saved = controller.checkpoint(2, new Set(), ordinary.id);
  assert.equal(saved.timers.has(ordinary.id), false);
  controller.resetAll();
  state.time = 100;
  state.windows = [
    { start: -Infinity, end: 100, active: false },
    { start: 100, end: 120, active: true },
    { start: 120, end: Infinity, active: false }
  ];
  controller.restoreCheckpoint(saved, 100, new Set(), [{ skillId: ordinary.id, readyAt: 120 }]);
  assert.equal(controller.readyAt(ordinary.id), 120);
  assert.equal(controller.rechargeFor(ordinary.id), undefined);
  assert.equal(controller.readyAt(summon.id), 106.4);
  assert.equal(controller.isOnCooldown(ordinary.id), true);
  assert.deepEqual(controller.rechargeFor(summon.id), { workAnchorAt: 100, work: 8 });
});

// A checkpoint owns one magazine snapshot even when multiple faces spend it and its original binding is retired.
test('checkpoint restoration reconnects shared faces and detaches observations', () => {
  const { state, controller } = fixture();
  const face = { ...magazine, id: 9 };
  controller.ensureAmmo(magazine);
  controller.linkAmmo(magazine.id, face.id);
  controller.spendAmmo(magazine, 0);
  const saved = controller.checkpoint(2, new Set(), ordinary.id);
  assert.equal(saved.pools.length, 1);
  assert.equal(saved.ammoBindings.get(magazine.id), saved.ammoBindings.get(face.id));
  controller.resetAll();
  state.time = 100;
  controller.restoreCheckpoint(saved, state.time, new Set(), []);
  controller.spendAmmo(face, state.time);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  const observation = controller.readAmmo(face.id);
  observation.charges = 99;
  observation.recharges[0].work = 99;
  observation.recharges.push({ work: 99, workAnchorAt: 0 });
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  assert.equal(controller.readAmmo(face.id).nextRechargeAt, 103);
  controller.retireAmmo(magazine.id);
  state.time = 103;
  controller.refresh(state.time);
  assert.equal(controller.readAmmo(face.id).charges, 2);
  assert.equal(controller.readAmmo(face.id).nextRechargeAt, 108);
  assert.equal(controller.hasAmmo(magazine.id), false);
  assert.equal(saved.pools[0].charges, 2);
  assert.deepEqual(saved.pools[0].recharges, [{ work: 3, startDelay: 0 }]);
});

// Future reservations retain both the front delay and later rounds' minimum anchors across a rewind.
test('checkpoint restores future reservation anchors without advancing live resources', () => {
  const { state, controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.reserveAmmo(magazine, 1, { workAnchorAt: 10, work: 5 });
  controller.reserveAmmo(magazine, 1, { workAnchorAt: 20, work: 5 });
  controller.startRecharge(ordinary, 10, 5);
  const saved = controller.checkpoint(2, new Set(), 'independent');
  assert.equal(state.time, 0);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  state.time = 100;
  controller.restoreCheckpoint(saved, state.time, new Set(), []);
  assert.equal(controller.readyAt(ordinary.id), 113);
  assert.equal(controller.readAmmo(magazine.id).nextRechargeAt, 113);
  assert.equal(controller.refreshAmmo(magazine, 112).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 113).charges, 2);
  assert.equal(controller.readAmmo(magazine.id).nextRechargeAt, 123);
  assert.equal(controller.refreshAmmo(magazine, 123).charges, 3);
});

// Capture settles a detached queue through completed rounds, without charging elapsed work to waiting rounds.
test('future checkpoint settles serial recovery on a detached pool', () => {
  const { state, controller } = fixture();
  for (let index = 0; index < 3; index++) controller.spendAmmo(magazine, 0);
  const saved = controller.checkpoint(12, new Set(), ordinary.id);
  assert.equal(controller.readAmmo(magazine.id).charges, 0);
  assert.equal(state.time, 0);
  assert.equal(saved.pools[0].charges, 2);
  assert.deepEqual(saved.pools[0].recharges, [{ work: 3, startDelay: 0 }]);
  state.time = 100;
  controller.restoreCheckpoint(saved, state.time, new Set(), []);
  assert.equal(controller.readAmmo(magazine.id).charges, 2);
  assert.equal(controller.readAmmo(magazine.id).nextRechargeAt, 103);
});

// Pool replacement publishes availability immediately for every binding, without overwriting ordinary work.
test('ammo availability is derived for linked faces and dominates an ordinary timer', () => {
  const { state, controller } = fixture();
  controller.startRecharge(magazine, 0, 50);
  controller.ensureAmmo(magazine);
  controller.linkAmmo(magazine.id, 9);
  assert.equal(controller.hasCooldown(magazine.id), false);
  assert.deepEqual([...controller.cooldownSkillIds()], []);
  controller.replaceAmmoCharges(magazine, 1, 0, [{ workAnchorAt: 0, work: 5 }]);
  for (const id of [magazine.id, 9]) {
    assert.equal(controller.readyAt(id), 5);
    assert.equal(controller.hasCooldown(id), true);
  }

  assert.deepEqual([...controller.cooldownSkillIds()], [magazine.id, 9]);
  controller.clear(magazine.id);
  assert.equal(controller.readyAt(magazine.id), 5);
  assert.equal(controller.readAmmo(9).charges, 0);
  state.time = 5;
  assert.equal(controller.isOnCooldown(9), false);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  assert.deepEqual([...controller.cooldownSkillIds()], []);
});

// One global refresh integrates each distinct pool once; incompatible faces cannot select a second rate policy.
test('linked magazine refresh uses its owner once and rejects conflicting policies', () => {
  const face = { ...magazine, id: 9 };
  const incompatible = { ...magazine, id: 10, rechargeIgnoresAlacrity: true };
  const { state, intervalReads, controller } = rateFixture([magazine, face, incompatible]);
  controller.spendAmmo(magazine, 0, 10);
  controller.linkAmmo(magazine.id, face.id);
  assert.throws(() => controller.linkAmmo(magazine.id, incompatible.id), /different recharge policies/);
  assert.equal(controller.hasAmmo(incompatible.id), false);
  intervalReads.length = 0;
  state.time = 1;
  controller.refresh(state.time);
  assert.deepEqual(intervalReads, [magazine.id]);
});

// Restored fixed deadlines remain wall time while work is reprojected; replacement removes the previous representation.
test('fixed and work timers remain distinct through reduction, replacement, and restore', () => {
  const { state, controller } = rateFixture([ordinary, preserved]);
  controller.startRecharge(ordinary, 0, 10);
  controller.setReadyAt(ordinary.id, 10);
  assert.equal(controller.rechargeFor(ordinary.id), undefined);
  assert.equal(controller.reduceSkillRecharge(ordinary, 2.5, 0), 2);
  controller.startRecharge(preserved, 0, 10);
  assert.equal(controller.reduceSkillRecharge(preserved, 2.5, 0), 2);
  const saved = controller.checkpoint(2, new Set(), 'independent');
  state.time = 100;
  controller.restoreCheckpoint(saved, state.time, new Set(), []);
  assert.equal(controller.readyAt(ordinary.id), 106);
  assert.equal(controller.readyAt(preserved.id), 104);
  assert.equal(controller.rechargeFor(ordinary.id), undefined);
  assert.equal(controller.rechargeFor(preserved.id).work, 5);
  controller.setReadyAt(ordinary.id, Infinity);
  controller.copy(ordinary.id, preserved.id);
  assert.equal(controller.readyAt(preserved.id), Infinity);
  assert.equal(controller.rechargeFor(preserved.id), undefined);
  controller.clear(ordinary.id);
  controller.copy(ordinary.id, preserved.id);
  assert.equal(controller.hasCooldown(preserved.id), false);
});

// Independent deadlines win over supplied snapshots, while preserved IDs cannot be independently overridden.
test('checkpoint restore gives explicit deadlines precedence and validates exclusions before mutation', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  const saved = controller.checkpoint(2, new Set(), 'independent');
  state.time = 100;
  controller.restoreCheckpoint(saved, state.time, new Set(), [{ skillId: ordinary.id, readyAt: 130 }]);
  assert.equal(controller.readyAt(ordinary.id), 130);
  assert.equal(controller.rechargeFor(ordinary.id), undefined);
  const excluded = new Set([ordinary.id]);
  assert.throws(() => controller.checkpoint(state.time, excluded, ordinary.id), /must be disjoint/);
  assert.throws(
    () => controller.restoreCheckpoint(saved, state.time, excluded, [{ skillId: ordinary.id, readyAt: 140 }]),
    /must be disjoint/
  );
  assert.equal(controller.readyAt(ordinary.id), 130);
});

// A restored pet timer keeps its captured incarnation through reductions and freezes earned work before retirement.
test('summon checkpoints retain companion ownership and retirement no longer reads discarded history', () => {
  const skill = { ...ordinary, rechargeBuffAudience: RECIPIENT.SUMMONS };
  const clock = { time: 0 };
  let retired = false;
  const owners = [];
  const controller = createCooldownController({
    clock,
    skillFor: () => skill,
    rechargeDuration: () => 10,
    rechargeIntervals(_skill, start, end, companionId) {
      assert.equal(retired, false);

      if (!companionId) throw new TypeError(`Summon recharge for skill ${skill.id} requires a companion identity.`);

      owners.push(companionId);
      return [{ start, end, rate: companionId === 'original-pet' ? 1.25 : 1 }];
    }
  });
  controller.startRecharge(skill, 0, 10, 'original-pet');
  const saved = controller.checkpoint(2, new Set(), 'independent');
  clock.time = 100;
  owners.length = 0;
  controller.restoreCheckpoint(saved, clock.time, new Set(), []);
  assert.deepEqual(owners, ['original-pet']);
  assert.equal(controller.readyAt(skill.id), 106);
  assert.equal(controller.reduceSkillRecharge(skill, 1.25, clock.time), 1);
  assert.equal(controller.rechargeFor(skill.id).companionId, 'original-pet');
  clock.time = 101;
  controller.retireCompanion('original-pet', clock.time);
  retired = true;
  assert.equal(controller.readyAt(skill.id), 106);
  assert.equal(controller.rechargeFor(skill.id), undefined);
  assert.equal(controller.isOnCooldown(skill.id), true);
  assert.equal(controller.reduceSkillRecharge(skill, 2, clock.time), 2);
  assert.equal(controller.readyAt(skill.id), 104);
});

// The production interval source requires an incarnation for work but fixed deadlines have no received-boon owner.
test('summon reduction and default work calculation satisfy the production timeline contract', () => {
  const skill = { ...ordinary, rechargeBuffAudience: RECIPIENT.SUMMONS };
  const clock = { time: 0 };
  const timeline = createGw2TimelineIndex();
  const controller = createCooldownController({
    clock,
    skillFor: () => skill,
    rechargeDuration: (selected, at, companionId) => 10 / controller.rate(selected, at, companionId),
    rechargeIntervals: timeline.rechargeIntervals
  });
  controller.setReadyAt(skill.id, 12);
  assert.equal(controller.reduceSkillRecharge(skill, 2), 2);
  assert.equal(controller.readyAt(skill.id), 10);
  assert.throws(() => controller.startRecharge(skill, 0), /requires a companion identity/);
  assert.equal(controller.readyAt(skill.id), 10);
  controller.startRecharge(skill, 0, undefined, 'original-pet');
  clock.time = 2;
  assert.equal(controller.reduceSkillRecharge(skill, 3), 3);
  assert.equal(controller.readyAt(skill.id), 7);
  assert.deepEqual(controller.rechargeFor(skill.id), { workAnchorAt: 2, work: 5, companionId: 'original-pet' });
});
