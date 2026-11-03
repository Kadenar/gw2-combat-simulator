import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import {
  autoattackChainSkillAvailable,
  createAutoattackChainController
} from '#gw2/platform/execution/autoattack-chains.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { cast } from '#tests/helpers/commands.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const skill = (id, name, extra = {}) => ({
  id,
  name,
  castTimeMs: 0,
  effects: [],
  ...extra
});

// Keep fixture skills fixed while varying chain definitions to exercise controller behavior.
function chainProfession(autoattackChains) {
  const core = defineNativeModule({
    id: 'Core',
    data: {
      autoattackChains: [
        [1, 2, 3],
        [4, 5, 6]
      ],
      skills: [
        skill(1, 'Root A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1',
          castTimeMs: 1000,
          interruptCommitMs: 500
        }),
        skill(2, 'Second A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1'
        }),
        skill(3, 'Third A', {
          type: 'Weapon',
          weapon: 'Sword',
          slot: 'Weapon_1'
        }),
        skill(4, 'Root B', {
          type: 'Weapon',
          weapon: 'Mace',
          slot: 'Weapon_1'
        }),
        skill(5, 'Second B', {
          type: 'Weapon',
          weapon: 'Mace',
          slot: 'Weapon_1'
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
    state: { create: () => ({}) },
    hooks: {}
  });

  return defineNativeProfession({
    id: 'chain-fixture',
    name: 'Chain Fixture',
    modules: [core],
    autoattackChains
  });
}

function chainState(result) {
  return result.planningState.profession[STATE.AUTOATTACK_CHAINS];
}

// Live cases use canonical cast commitments even when target effects miss or reporting is disabled.
const chainConfig = {
  attributeInputs: baseAttributeInputs({ power: 1000 }),
  target: { armor: 1000, health: 0, conditions: {} }
};
const runChain = (rotation, profession = chainProfession().runtimeFor(chainConfig), extra = {}) =>
  runGw2Runtime({ profession, config: chainConfig, rotation, ...extra });

test('live chains reject out-of-order steps and commit each completion once', () => {
  const rejected = runChain([cast(3)]);
  assert.equal(rejected.warnings.length, 1);
  assert.deepEqual(rejected.planningState.profession[STATE.AUTOATTACK_CHAINS], { 1: 1, 4: 4 });
  const advanced = runChain([cast(1), cast(2)]);
  assert.deepEqual(advanced.warnings, []);
  assert.deepEqual(advanced.planningState.profession[STATE.AUTOATTACK_CHAINS], { 1: 3, 4: 4 });
  const rotation = [cast(1), cast(2), cast(3)];
  const complete = runChain(rotation);
  assert.deepEqual(complete.planningState.profession[STATE.AUTOATTACK_CHAINS], { 1: 1, 4: 4 });
  assert.deepEqual(complete.warnings, []);
  assert.equal(runChain(rotation, undefined, { output: 'score' }).totalDamage, complete.totalDamage);
});

test('live chain interruptions use selected packet boundaries, including travel and cast-end ties', () => {
  for (const interrupting of [cast(7), cast(7, { offTarget: true }), cast(11)])
    assert.deepEqual(runChain([cast(1), interrupting]).planningState.profession[STATE.AUTOATTACK_CHAINS], {
      1: 1,
      4: 4
    });
  for (const preserving of [cast(8), cast(9), cast(10), cast(12), cast(7, { impactDelayMs: 2000 })])
    assert.deepEqual(runChain([cast(1), preserving]).planningState.profession[STATE.AUTOATTACK_CHAINS], { 1: 2, 4: 4 });
  const native = chainProfession().runtimeFor(chainConfig);
  const removed = { ...native, modifyEffects: (_runtime, cast, effects) => (cast.skill.id === 7 ? [] : effects) };
  assert.deepEqual(runChain([cast(1), cast(7)], removed).planningState.profession[STATE.AUTOATTACK_CHAINS], {
    1: 2,
    4: 4
  });
});

test('live native composition keeps overrides scoped to their pending root', () => {
  const profession = chainProfession({
    overrides: [{ id: 'preserve-a', chainRootIds: [1], decision: 'preserve' }]
  }).runtimeFor(chainConfig);
  const result = runChain([cast(1), cast(4), cast(7)], profession);
  assert.deepEqual(result.planningState.profession[STATE.AUTOATTACK_CHAINS], { 1: 2, 4: 4 });
  assert.deepEqual(result.warnings, []);
});

// Palette projection preserves ID types and never lets a display label select a chain step.
test('autoattack availability defaults to the root and preserves canonical IDs', () => {
  assert.equal(autoattackChainSkillAvailable(skill(3, 'Unchained')), true);
  for (const chainRoot of [1, '1']) {
    const root = skill(chainRoot, 'Root A', { chainRoot });
    const nextId = typeof chainRoot === 'string' ? '2' : 2;
    const next = skill(nextId, 'Second A', { chainRoot });
    assert.equal(autoattackChainSkillAvailable(root), true);
    assert.equal(autoattackChainSkillAvailable(next), false);
    assert.equal(autoattackChainSkillAvailable(root, { [chainRoot]: null }), true);
    for (const expected of [nextId]) {
      const state = Object.freeze({ [chainRoot]: expected });
      assert.equal(autoattackChainSkillAvailable(next, state), true);
      assert.equal(autoattackChainSkillAvailable(root, state), false);
    }

    assert.equal(autoattackChainSkillAvailable(next, { [chainRoot]: 'Second A' }), false);
  }
});

test('native professions automatically gate and advance autoattack chains', () => {
  const profession = chainProfession();
  const outOfOrder = simulateGw2({ profession, rotation: ['Second A'] });
  const afterRoot = simulateGw2({ profession, rotation: ['Root A'] });
  const afterSecond = simulateGw2({ profession, rotation: ['Root A', 'Second A'] });
  const completed = simulateGw2({ profession, rotation: ['Root A', 'Second A', 'Third A'] });

  assert.match(outOfOrder.warnings[0].message, /cast Root A first/);
  assert.deepEqual(chainState(afterRoot), { 1: 2, 4: 4 });
  assert.deepEqual(chainState(afterSecond), { 1: 3, 4: 4 });
  assert.deepEqual(chainState(completed), { 1: 1, 4: 4 });
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
  assert.deepEqual(chainState(instant), { 1: 3, 4: 4 });
  assert.deepEqual(nonDamaging.warnings, []);
  assert.deepEqual(chainState(nonDamaging), { 1: 3, 4: 4 });
  assert.deepEqual(delayed.warnings, []);
  assert.deepEqual(chainState(delayed), { 1: 3, 4: 4 });
  assert.deepEqual(independent.warnings, []);
  assert.deepEqual(chainState(independent), { 1: 3, 4: 4 });
  assert.deepEqual(weapon.warnings, []);
  assert.deepEqual(chainState(weapon), { 1: 2, 4: 4 });
  assert.deepEqual(inclusive.warnings, []);
  assert.deepEqual(chainState(inclusive), { 1: 2, 4: 4 });
});

test('a cancelled unrelated weapon preserves pending roots by default', () => {
  const profession = chainProfession();
  const result = simulateGw2({
    profession,
    rotation: ['Root A', { name: 'Interrupting Weapon', interruptMs: 200 }, 'Second A']
  });

  assert.equal(result.steps[1].cancelledBeforeCommit, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(chainState(result), { 1: 3, 4: 4 });
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
  assert.deepEqual(chainState(result), { 1: 2, 4: 4 });
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
  assert.deepEqual(chainState(preserved), { 1: 3, 4: 4 });
  assert.match(reset.warnings[0].message, /cast Root B first/);
  assert.deepEqual(chainState(reset), { 1: 1, 4: 4 });
});

// Invalid roots must fail before an unchanged ID can be mistaken for reset progress.
test('chain reads accept declared roots and reject later steps, unchained skills, and unknown IDs', () => {
  const catalog = chainProfession().catalog;
  const controller = createAutoattackChainController(catalog);
  assert.equal(controller.read(1), 1);
  controller.advance(catalog.skillsById.get(1), true, false);
  assert.equal(controller.read(1), 2);
  for (const id of [2, 3, 7, 999])
    assert.throws(() => controller.read(id), {
      name: 'RangeError',
      message: `Skill ${id} is not an autoattack chain root.`
    });
});

test('form helpers reset selected or all chains through the shared mutation boundary', () => {
  const catalog = chainProfession().catalog;
  const controller = createAutoattackChainController(catalog);
  controller.advance(catalog.skillsById.get(1), true, false);
  controller.advance(catalog.skillsById.get(4), true, false);
  controller.reset([1]);
  assert.deepEqual(controller.snapshot(), { 1: 1, 4: 5 });
  controller.reset();
  assert.deepEqual(controller.snapshot(), { 1: 1, 4: 4 });
});

// Progress belongs to execution even when a mechanic replaces its entire state or a caller edits an observation.
test('chain ownership survives profession replacement and isolates runs, snapshots, and author capabilities', () => {
  const native = chainProfession().runtimeFor(chainConfig);
  let replaced = false;
  const profession = {
    ...native,
    onCastCommit(context, cast) {
      if (cast.skill.id !== 1) return;

      assert.equal(context.autoattackController.read(1), 2);
      assert.equal('advance' in context.autoattackController, false);
      assert.equal('reset' in context.queries.autoattackController, false);
      context.profession = native.createState(chainConfig);
      assert.equal(context.autoattackController.read(1), 2);
      replaced = true;
    }
  };
  const result = observeGw2Runtime({ profession, config: chainConfig, rotation: [cast(1), cast(2)] });
  const owner = observedRuntime(result);
  assert.equal(replaced, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(owner.autoattackController.read(1), 3);
  const snapshot = owner.autoattackController.snapshot();
  snapshot[1] = 99;
  chainState(result)[1] = 99;
  assert.equal(owner.autoattackController.read(1), 3);
  assert.deepEqual(chainState(runChain([])), { 1: 1, 4: 4 });
  owner.mechanics.autoattackController.reset([1]);
  assert.equal(owner.autoattackController.read(1), 1);
});

// Real initializers must not recreate a second chain store in any profession or specialization.
for (const entry of professionRegistry) {
  test(`${entry.name} initializes owned state without an autoattack-chain store`, async () => {
    const family = await entry.loadProfession();
    for (const { id: specialization } of family.nativeDefinition.modules) {
      const config = { specialization };
      const state = family.runtimeFor(config).createState(config);
      assert.equal(Object.hasOwn(state.core, 'autoattackChains'), false, specialization);
      assert.equal(Object.hasOwn(state.specialization.state, 'autoattackChains'), false, specialization);
    }
  });
}
