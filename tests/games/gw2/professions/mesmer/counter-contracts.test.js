import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { bloodsong } from '#gw2/professions/mesmer/specializations/virtuoso/traits/index.js';

// Compile the producer so selection precedes counter changes in these minimal fixtures.
const bloodsongReaction = compileProfessionRules({
  traitTriggers: bloodsong.triggers.map((rule) => ({ ...rule, trait: bloodsong.id }))
}).reactions['condition.applied'];

// Observe the real deferred resource boundary, including progress changed by a nested reaction during a reward.
test('Bloodsong resets every fifth application before rewarding, including at full blades', () => {
  const state = virtuosoState.create();
  state.blades.value = 5;
  const observations = [];
  const react = bloodsongReaction;
  let nested = false;
  const runtime = {
    helpers: mesmerCatalog,
    config: {},
    time: 1,
    traits: new Set([TRAIT.BLOODSONG]),
    profession: { specialization: { kind: 'Virtuoso', state } },
    schedule(task, at, reward) {
      observations.push([task, at, reward.count, reward.reason, state.bloodsongProgress]);
      if (!nested) {
        nested = true;
        react(runtime, { condition: 'Bleeding', stacks: 1 });
      }
    }
  };
  react(runtime, { condition: 'Torment', stacks: 50 });
  assert.equal(state.bloodsongProgress, 0);
  for (let index = 0; index < 4; index++) react(runtime, { condition: 'Bleeding', stacks: 1 });
  assert.equal(state.bloodsongProgress, 4);
  assert.equal(observations.length, 0);
  react(runtime, { condition: 'Bleeding', stacks: 1, source: 'Sigil', actorType: 'effect' });
  assert.equal(state.bloodsongProgress, 1);
  assert.equal(observations[0][4], 0);
  for (let index = 0; index < 4; index++) react(runtime, { condition: 'Bleeding', stacks: 1 });
  assert.equal(observations.length, 2);
  assert.deepEqual(
    observations.map((row) => row.slice(0, 4)),
    [
      ['mesmer.resource-gain', 1, 1, 'Bloodsong'],
      ['mesmer.resource-gain', 1, 1, 'Bloodsong']
    ]
  );
  assert.equal(state.bloodsongProgress, 0);
  assert.equal(observations[1][4], 0);
  assert.equal(state.blades.value, 5);
});

// Disabled thresholds retain accepted Bleeding credit, whereas deselecting the trait prevents accumulation.
test('Bloodsong accumulates without rewards for nonpositive thresholds', () => {
  for (const threshold of [0, -1]) {
    const state = virtuosoState.create();
    const runtime = {
      helpers: applyBalanceProfilePatch(mesmerCatalog, {
        balanceProfiles: { [TRAIT.BLOODSONG]: { fields: { threshold: { from: 5, to: threshold } } } }
      }),
      traits: new Set([TRAIT.BLOODSONG]),
      profession: { specialization: { kind: 'Virtuoso', state } },
      schedule: () => assert.fail('Disabled threshold must not queue a reward')
    };
    bloodsongReaction(runtime, { condition: 'Bleeding', stacks: 1 });
    assert.equal(state.bloodsongProgress, 1);
    runtime.traits.clear();
    bloodsongReaction(runtime, { condition: 'Bleeding', stacks: 1 });
    assert.equal(state.bloodsongProgress, 1);
  }
});
