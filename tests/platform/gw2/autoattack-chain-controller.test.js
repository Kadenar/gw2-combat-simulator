import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduler } from '../../../js/games/gw2/platform/engine/execution/scheduler.js';
import {
  defineNativeModule,
  defineNativeProfession
} from '../../../js/games/gw2/integrations/patches/authoring/profession.js';
import {
  replaceAutoattackChains,
  resetAutoattackChains
} from '../../../js/games/gw2/platform/skills/autoattack-chains.js';

const skill = (id, name, extra = {}) => ({
  id,
  name,
  implemented: true,
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
          interruptCommitMs: 500
        }),
        skill(8, 'Utility', { type: 'Utility' })
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

test('another weapon resets pending roots while utilities preserve them', () => {
  const profession = chainProfession();
  const preserved = createScheduler({ profession }).run(['Root A', 'Utility', 'Second A']);
  const reset = createScheduler({ profession }).run(['Root A', 'Interrupting Weapon', 'Second A']);

  assert.deepEqual(preserved.warnings, []);
  assert.deepEqual(chainState(preserved), { 1: 3 });
  assert.match(reset.warnings[0], /cast Root A first/);
  assert.deepEqual(chainState(reset), {});
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
