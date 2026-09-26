import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  autoattackChainSkillAvailable,
  replaceAutoattackChains,
  resetAutoattackChains
} from '#gw2/platform/skills/autoattack-chain-controller.js';

const skill = (id, name, extra = {}) => ({
  id,
  name,
  castTimeMs: 0,
  effects: [],
  ...extra
});

function chainProfession(autoattackChains, root = {}) {
  const core = defineNativeModule({
    id: 'Core',
    data: {
      generatedSkills: [
        skill(1, 'Root A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1',
          nextChainId: 2,
          castTimeMs: 1000,
          interruptCommitMs: 500,
          ...root
        }),
        skill(2, 'Second A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1',
          nextChainId: 3
        }),
        skill(3, 'Third A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1'
        }),
        skill(4, 'Root B', {
          type: 'Weapon',
          weapon: 'Mace',
          slot: 'Weapon_1',
          nextChainId: 5
        }),
        skill(5, 'Second B', {
          type: 'Weapon',
          weapon: 'Mace',
          slot: 'Weapon_1',
          nextChainId: 6
        }),
        skill(6, 'Third B', {
          type: 'Weapon',
          weapon: 'Mace',
          slot: 'Weapon_1'
        }),
        skill(7, 'Interrupting Weapon', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_2',
          castTimeMs: 1000,
          interruptCommitMs: 500,
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              atMs: 500,
              timingAnchor: 'castStart'
            }
          ]
        }),
        skill(8, 'Instant Damage', {
          type: 'Utility',
          effects: [{ type: 'strike', coefficient: 1 }]
        }),
        skill(9, 'Non-damaging Cast', { type: 'Utility', castTimeMs: 1000 }),
        skill(10, 'Delayed Damage', {
          type: 'Utility',
          castTimeMs: 1000,
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              atMs: 1200,
              timingAnchor: 'castStart'
            }
          ]
        }),
        skill(11, 'Cast-end Damage', {
          type: 'Utility',
          castTimeMs: 1000,
          effects: [{ type: 'strike', coefficient: 1 }]
        }),
        skill(12, 'Independent Damage', {
          type: 'Profession',
          castTimeMs: 1000,
          independentCast: true,
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              atMs: 500,
              timingAnchor: 'castStart'
            }
          ]
        })
      ]
    },
    state: {
      create: () => ({ autoattackChains: {} })
    },
    mechanics: { live: {} }
  });

  return defineNativeProfession({
    id: 'chain-fixture',
    name: 'Chain Fixture',
    modules: [core],
    autoattackChains
  });
}

function chainState(result) {
  return result.planningState.profession.autoattackChains;
}

// Live cases use canonical cast commitments even when target effects miss or reporting is disabled.
const liveConfig = { stats: { power: 1000 }, target: { armor: 1000, health: 0, conditions: {} } };
const cast = (skillId, flags = {}) => ({ type: 'cast', skillId, ...flags });
const liveChain = (rotation, profession = chainProfession().liveRuntimeFor(liveConfig), extra = {}) =>
  runGw2Runtime({ profession, config: liveConfig, rotation, ...extra });

test('live chains reject out-of-order steps and commit each completion once', () => {
  const rejected = liveChain([cast(3)]);
  assert.equal(rejected.warnings.length, 1);
  assert.deepEqual(rejected.planningState.profession.autoattackChains, {});
  const advanced = liveChain([cast(1), cast(2)]);
  assert.deepEqual(advanced.warnings, []);
  assert.deepEqual(advanced.planningState.profession.autoattackChains, { 1: 3 });
  const rotation = [cast(1), cast(2), cast(3)];
  const complete = liveChain(rotation);
  assert.deepEqual(complete.planningState.profession.autoattackChains, {});
  assert.deepEqual(complete.warnings, []);
  assert.equal(liveChain(rotation, undefined, { output: 'score' }).totalDamage, complete.totalDamage);
});

test('live chain interruptions use selected packet boundaries, including travel and cast-end ties', () => {
  for (const interrupting of [cast(7), cast(7, { offTarget: true }), cast(11)])
    assert.deepEqual(liveChain([cast(1), interrupting]).planningState.profession.autoattackChains, {});
  for (const preserving of [cast(8), cast(9), cast(10), cast(12), cast(7, { impactDelayMs: 2000 })])
    assert.deepEqual(liveChain([cast(1), preserving]).planningState.profession.autoattackChains, { 1: 2 });
  const native = chainProfession().liveRuntimeFor(liveConfig);
  const removed = { ...native, modifyEffects: (_runtime, cast, effects) => (cast.skill.id === 7 ? [] : effects) };
  assert.deepEqual(liveChain([cast(1), cast(7)], removed).planningState.profession.autoattackChains, { 1: 2 });
});

test('an interrupted packet chain advances only after a retained packet reaches its cast boundary', () => {
  const profession = chainProfession(undefined, {
    interruptMode: 'per-packet',
    effects: [{ type: 'strike', coefficient: 1, atMs: 200, timingAnchor: 'castStart' }]
  }).liveRuntimeFor(liveConfig);
  assert.deepEqual(
    liveChain([cast(1, { interruptAfterMs: 100 })], profession).planningState.profession.autoattackChains,
    {}
  );
  assert.deepEqual(
    liveChain([cast(1, { interruptAfterMs: 200 })], profession).planningState.profession.autoattackChains,
    { 1: 2 }
  );
  assert.deepEqual(
    liveChain([cast(1, { interruptAfterMs: 200, offTarget: true })], profession).planningState.profession
      .autoattackChains,
    { 1: 2 }
  );
});

test('live native composition keeps overrides scoped to their pending root', () => {
  const profession = chainProfession({
    overrides: [{ id: 'preserve-a', chainRootIds: [1], decision: 'preserve' }]
  }).liveRuntimeFor(liveConfig);
  const result = liveChain([cast(1), cast(4), cast(7)], profession);
  assert.deepEqual(result.planningState.profession.autoattackChains, { 1: 2 });
  assert.deepEqual(result.warnings, []);
});

// Palette projection accepts both legacy names and IDs without changing the captured chain state.
test('autoattack availability defaults to the root and accepts named or numeric steps', () => {
  assert.equal(autoattackChainSkillAvailable(skill(3, 'Unchained')), true);
  for (const chainRoot of [1, '1', 'Root A']) {
    const root = skill(1, 'Root A', { chainRoot });
    const next = skill(2, 'Second A', { chainRoot });
    assert.equal(autoattackChainSkillAvailable(root), true);
    assert.equal(autoattackChainSkillAvailable(next), false);
    assert.equal(autoattackChainSkillAvailable(root, { [chainRoot]: null }), true);
    for (const expected of [2, '2', 'Second A']) {
      const state = Object.freeze({ [chainRoot]: expected });
      assert.equal(autoattackChainSkillAvailable(next, state), true);
      assert.equal(autoattackChainSkillAvailable(root, state), false);
    }
  }
});

test('native professions automatically gate and advance autoattack chains', () => {
  const profession = chainProfession();
  const outOfOrder = simulateGw2({ profession, rotation: ['Second A'] });
  const afterRoot = simulateGw2({ profession, rotation: ['Root A'] });
  const afterSecond = simulateGw2({ profession, rotation: ['Root A', 'Second A'] });
  const completed = simulateGw2({ profession, rotation: ['Root A', 'Second A', 'Third A'] });

  assert.match(outOfOrder.warnings[0], /cast Root A first/);
  assert.deepEqual(chainState(afterRoot), { 1: 2 });
  assert.deepEqual(chainState(afterSecond), { 1: 3 });
  assert.deepEqual(chainState(completed), {});
});

test('only nonzero player casts with damage by cast end reset pending roots', () => {
  const profession = chainProfession();
  const instant = simulateGw2({ profession, rotation: ['Root A', 'Instant Damage', 'Second A'] });
  const nonDamaging = simulateGw2({ profession, rotation: ['Root A', 'Non-damaging Cast', 'Second A'] });
  const delayed = simulateGw2({ profession, rotation: ['Root A', 'Delayed Damage', 'Second A'] });
  const independent = simulateGw2({ profession, rotation: ['Root A', 'Independent Damage', 'Second A'] });
  const weapon = simulateGw2({ profession, rotation: ['Root A', 'Interrupting Weapon', 'Root A'] });
  const inclusive = simulateGw2({ profession, rotation: ['Root A', 'Cast-end Damage', 'Root A'] });

  assert.deepEqual(instant.warnings, []);
  assert.deepEqual(chainState(instant), { 1: 3 });
  assert.deepEqual(nonDamaging.warnings, []);
  assert.deepEqual(chainState(nonDamaging), { 1: 3 });
  assert.deepEqual(delayed.warnings, []);
  assert.deepEqual(chainState(delayed), { 1: 3 });
  assert.deepEqual(independent.warnings, []);
  assert.deepEqual(chainState(independent), { 1: 3 });
  assert.deepEqual(weapon.warnings, []);
  assert.deepEqual(chainState(weapon), { 1: 2 });
  assert.deepEqual(inclusive.warnings, []);
  assert.deepEqual(chainState(inclusive), { 1: 2 });
});

test('pre-commit cancellation does not advance but a committed interruption does', () => {
  const profession = chainProfession();
  const cancelled = simulateGw2({ profession, rotation: [{ name: 'Root A', interruptMs: 200 }] });
  const committed = simulateGw2({ profession, rotation: [{ name: 'Root A', interruptMs: 600 }] });

  assert.equal(cancelled.steps[0].cancelledBeforeCommit, true);
  assert.deepEqual(chainState(cancelled), {});
  assert.equal(committed.steps[0].cancelledBeforeCommit, undefined);
  assert.deepEqual(chainState(committed), { 1: 2 });
});

test('a cancelled unrelated weapon preserves pending roots by default', () => {
  const profession = chainProfession();
  const result = simulateGw2({
    profession,
    rotation: ['Root A', { name: 'Interrupting Weapon', interruptMs: 200 }, 'Second A']
  });

  assert.equal(result.steps[1].cancelledBeforeCommit, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(chainState(result), { 1: 3 });
});

test('an explicit per-root rule may reset on a cancelled interrupting cast', () => {
  const profession = chainProfession({
    overrides: [
      {
        id: 'fixture.cancelled-interrupt-resets-a',
        chainRootIds: [1],
        interruptingSkillIds: [7],
        decision: 'reset'
      }
    ]
  });
  const result = simulateGw2({
    profession,
    rotation: ['Root A', { name: 'Interrupting Weapon', interruptMs: 200 }, 'Root A']
  });

  assert.equal(result.steps[1].cancelledBeforeCommit, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(chainState(result), { 1: 2 });
});

test('overrides are evaluated per pending root', () => {
  const profession = chainProfession({
    overrides: [
      {
        id: 'fixture.interrupt-preserves-a',
        chainRootIds: [1],
        interruptingSkillIds: [7],
        decision: 'preserve'
      }
    ]
  });
  const preserved = simulateGw2({ profession, rotation: ['Root A', 'Interrupting Weapon', 'Second A'] });
  const reset = simulateGw2({ profession, rotation: ['Root B', 'Interrupting Weapon', 'Second B'] });

  assert.deepEqual(preserved.warnings, []);
  assert.deepEqual(chainState(preserved), { 1: 3 });
  assert.match(reset.warnings[0], /cast Root B first/);
  assert.deepEqual(chainState(reset), {});
});

test('form helpers reset and restore chain snapshots through the shared mutation boundary', () => {
  const context = {
    state: {
      profession: {
        core: { autoattackChains: { 1: 2, 4: 5 } },
        specialization: { kind: 'Core', state: {} }
      }
    }
  };

  resetAutoattackChains(context, [1]);
  assert.deepEqual(context.state.profession.core.autoattackChains, { 4: 5 });
  replaceAutoattackChains(context, { 1: 3 });
  assert.deepEqual(context.state.profession.core.autoattackChains, { 1: 3 });
});
