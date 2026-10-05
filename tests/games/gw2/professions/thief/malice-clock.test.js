import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DEADEYE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Initial and isolated-preview balances must not trigger the earned Maleficent Seven cycle.
test('malice initializes once with selected capacity and projects a detached clock', () => {
  const result = runThief(
    [],
    {
      specialization: 'Deadeye',
      initialInitiative: 0,
      selectedTraitIds: [TRAIT.MALEFICENT_SEVEN]
    },
    {
      catalog: (catalog) => withProfile(catalog, TRAIT.MALEFICENT_SEVEN, { maximumStacks: 9 })
    }
  );
  const runtime = observedRuntime(result);
  const state = runtime.profession.specialization.state;
  const projected = result.planningState.profession;
  assert.equal(state.malice.maximum, 9);
  assert.equal(state.malice.value, 0);
  assert.equal(state.malice.rate, 0);
  assert.equal(Object.hasOwn(state, 'maximumMalice'), false);
  assert.equal(Object.hasOwn(projected, 'maximumMalice'), false);
  assert.notEqual(projected.malice, state.malice);
  assert.equal(runtime.resourceController.readyAt('malice', 1), null);
  assert.equal(runtime.resourceController.value('initiative'), 0);

  const skill = runtime.helpers.skillsById.get(ID.MALICIOUS_BACKSTAB);
  deadeyeHooks.prepareDamageState(runtime.mechanics, skill, { malice: 9 });
  assert.equal(state.malice.value, 9);
  assert.equal(projected.malice.value, 0);
  assert.equal(state.maleficentSevenTriggered, false);
  assert.equal(runtime.resourceController.value('initiative'), 0);
  for (const malice of [-1, 1.5, 10])
    assert.throws(() => deadeyeHooks.prepareDamageState(runtime.mechanics, skill, { malice }), RangeError);
  const view = thiefProfession.ui
    .resourceViews({ specialization: 'Deadeye', professionState: projected })
    .find((entry) => entry.id === 'malice');
  assert.equal(view.maximum, 9);
  assert.equal(view.value, 0);
});

// A new target replaces previous progress, while a live re-mark adds and supersedes its old expiry task.
test('marks replace or add malice and ignore stale expiry generations', () => {
  const readings = [];
  const result = runThief(
    [ID.DEADEYES_MARK, { type: 'wait', durationMs: 1000 }, ID.DEADEYES_MARK, { type: 'wait', durationMs: 2500 }],
    { specialization: 'Deadeye', selectedTraitIds: [TRAIT.MALICIOUS_INTENT] },
    {
      catalog: (catalog) =>
        withSkill(withProfile(catalog, DEADEYE.resources, { durationMultiplier: 2 }), ID.DEADEYES_MARK, {
          cooldown: 0
        }),
      initialize(runtime) {
        runtime.resourceController.replace('malice', 5);
        Object.assign(runtime.profession.specialization.state, { markedTargetId: 'other-target', markExpiresAt: 10 });
      },
      timeline: [{ at: 0.5, run: (runtime) => runtime.resourceController.grant('malice', 1) }],
      probes: [0.1, 1.1, 2.1, 3.1].map((at) => [
        at,
        (runtime) =>
          readings.push([
            runtime.resourceController.value('malice'),
            runtime.profession.specialization.state.markedTargetId
          ])
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readings, [
    [2, 'primary-target'],
    [5, 'primary-target'],
    [5, 'primary-target'],
    [0, null]
  ]);
});

// Misses cannot claim the activation latch; only the first eligible hit earns the sampled critical bonus.
for (const [precision, expected] of [
  [0, 1],
  [5000, 2]
]) {
  test(`first landed initiative hit grants malice once with precision ${precision}`, () => {
    const readings = [];
    const result = runThief(
      [{ type: 'wait', durationMs: 500 }],
      {
        specialization: 'Deadeye',
        stats: { precision },
        randomness: { mode: 'stochastic', seed: 1 }
      },
      {
        initialize(runtime) {
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: 'primary-target',
            markExpiresAt: 10
          });
          for (const [at, offTarget] of [
            [0.1, true],
            [0.2, false],
            [0.3, false]
          ])
            runtime.schedule(
              'test.emit',
              at,
              thiefHit(at, {
                skillId: ID.DEATH_BLOSSOM,
                activationId: 'one-activation',
                offTarget
              })
            );
        },
        probes: [0.1, 0.2, 0.3].map((at) => [
          at,
          (runtime) => readings.push(runtime.resourceController.value('malice'))
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(readings, [0, expected, expected]);
  });
}

// Overflow never re-earns the cycle reward; a malicious spend resets the latch before Intent starts the next cycle.
test('Maleficent Seven rewards once per cycle through capped grants and malicious reseeding', () => {
  const readings = [];
  const result = runThief(
    [{ type: 'wait', durationMs: 500 }],
    {
      specialization: 'Deadeye',
      initialInitiative: 0,
      stats: { precision: 0 },
      selectedTraitIds: [TRAIT.MALEFICENT_SEVEN, TRAIT.MALICIOUS_INTENT]
    },
    {
      catalog: (catalog) =>
        withProfile(withProfile(catalog, CORE.resources, { resourceGain: 0 }), TRAIT.MALEFICENT_SEVEN, {
          maximumStacks: 3,
          resourceGain: 3
        }),
      initialize(runtime) {
        runtime.resourceController.replace('malice', 2);
        Object.assign(runtime.profession.specialization.state, { markedTargetId: 'primary-target', markExpiresAt: 10 });
        for (const [at, skillId] of [
          [0.1, ID.DEATH_BLOSSOM],
          [0.2, ID.DEATH_BLOSSOM],
          [0.3, ID.MALICIOUS_BACKSTAB],
          [0.4, ID.DEATH_BLOSSOM]
        ])
          runtime.schedule('test.emit', at, thiefHit(at, { skillId, activationId: `hit-${at}` }));
      },
      probes: [0.1, 0.2, 0.3, 0.4].map((at) => [
        at,
        (runtime) =>
          readings.push([
            runtime.resourceController.value('malice'),
            runtime.resourceController.value('initiative'),
            runtime.profession.specialization.state.maleficentSevenTriggered
          ])
      ])
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readings, [
    [3, 3, true],
    [3, 3, true],
    [2, 3, false],
    [3, 6, true]
  ]);
});
