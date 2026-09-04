import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  autoattackChainSkillAvailable,
  replaceAutoattackChains,
  resetAutoattackChains
} from '#gw2/platform/skills/autoattack-chains.js';

const skill = (id, name, extra = {}) => ({
  id,
  name,
  castTimeMs: 0,
  effects: [],
  ...extra
});

function chainProfession(autoattackChains) {
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
          interruptCommitMs: 500
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
      scheduler: () => ({ autoattackChains: {} })
    }
  });

  return defineNativeProfession({
    id: 'chain-fixture',
    name: 'Chain Fixture',
    modules: [core],
    autoattackChains
  });
}

function chainState(result) {
  return result.state.profession.core.autoattackChains;
}

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
  const outOfOrder = createScheduler({ profession }).run(['Second A']);
  const afterRoot = createScheduler({ profession }).run(['Root A']);
  const afterSecond = createScheduler({ profession }).run(['Root A', 'Second A']);
  const completed = createScheduler({ profession }).run(['Root A', 'Second A', 'Third A']);

  assert.match(outOfOrder.warnings[0], /cast Root A first/);
  assert.deepEqual(chainState(afterRoot), { 1: 2 });
  assert.deepEqual(chainState(afterSecond), { 1: 3 });
  assert.deepEqual(chainState(completed), {});
});

test('only nonzero player casts with damage by cast end reset pending roots', () => {
  const profession = chainProfession();
  const instant = createScheduler({ profession }).run(['Root A', 'Instant Damage', 'Second A']);
  const nonDamaging = createScheduler({ profession }).run(['Root A', 'Non-damaging Cast', 'Second A']);
  const delayed = createScheduler({ profession }).run(['Root A', 'Delayed Damage', 'Second A']);
  const independent = createScheduler({ profession }).run(['Root A', 'Independent Damage', 'Second A']);
  const weapon = createScheduler({ profession }).run(['Root A', 'Interrupting Weapon', 'Root A']);
  const inclusive = createScheduler({ profession }).run(['Root A', 'Cast-end Damage', 'Root A']);

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
  const cancelled = createScheduler({ profession }).run([{ name: 'Root A', interruptMs: 200 }]);
  const committed = createScheduler({ profession }).run([{ name: 'Root A', interruptMs: 600 }]);

  assert.equal(cancelled.steps[0].cancelledBeforeCommit, true);
  assert.deepEqual(chainState(cancelled), {});
  assert.equal(committed.steps[0].cancelledBeforeCommit, undefined);
  assert.deepEqual(chainState(committed), { 1: 2 });
});

test('a cancelled unrelated weapon preserves pending roots by default', () => {
  const profession = chainProfession();
  const result = createScheduler({ profession }).run([
    'Root A',
    { name: 'Interrupting Weapon', interruptMs: 200 },
    'Second A'
  ]);

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
  const result = createScheduler({ profession }).run([
    'Root A',
    { name: 'Interrupting Weapon', interruptMs: 200 },
    'Root A'
  ]);

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
  const preserved = createScheduler({ profession }).run(['Root A', 'Interrupting Weapon', 'Second A']);
  const reset = createScheduler({ profession }).run(['Root B', 'Interrupting Weapon', 'Second B']);

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
