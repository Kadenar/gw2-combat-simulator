import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

// Shade Step belongs to commitment; its selected party boon must already exist when deferred completion runs.
test('Shade Step grants only the committed skill boon before deferred Specter completion', () => {
  for (const [skillId, kind] of [
    [ID.GRASPING_SHADOWS, 'alacrity'],
    [ID.DAWNS_REPOSE, 'protection'],
    [ID.MIND_SHOCK, 'aegis']
  ]) {
    const atCompletion = [];
    const result = runThief(
      [ID.ENTER_SHADOW_SHROUD, skillId, { type: 'wait', durationMs: 1000 }],
      {
        specialization: 'Specter',
        initialShadowForce: 100,
        selectedTraitIds: [TRAIT.SHADESTEP],
        allies: { count: 2, strikesPerSecond: 0 }
      },
      {
        extend: (native) => ({
          tasks: {
            ...native.tasks,
            'thief.specter-complete'(runtime, data) {
              atCompletion.push(runtime.history.filter((event) => event.sourceId === TRAIT.SHADESTEP));
              native.tasks['thief.specter-complete'](runtime, data);
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    const rewards = result.events.filter((event) => event.sourceId === TRAIT.SHADESTEP);
    assert.deepEqual(
      rewards.map((event) => event.kind),
      [kind]
    );
    assert.deepEqual(
      atCompletion.at(-1).map((event) => event.kind),
      [kind]
    );
    const action = result.events.find((event) => event.type === 'action' && event.skillId === skillId);
    assert.equal(rewards[0].at, action.endsAt);
    assert.equal(rewards[0].activationId, action.activationId);
    assert.equal(rewards[0].resolvedAudience.recipientCount, 3);
  }
});

// Removing the selected effect cannot substitute a sibling boon or suppress Dawn's independent barrier.
test('Shade Step respects trait selection and a removed boon while preserving completion mechanics', () => {
  for (const selectedTraitIds of [[], [TRAIT.SHADESTEP]]) {
    const result = runThief(
      [ID.ENTER_SHADOW_SHROUD, ID.DAWNS_REPOSE, { type: 'wait', durationMs: 1000 }],
      { specialization: 'Specter', initialShadowForce: 100, selectedTraitIds },
      {
        catalog: (catalog) =>
          selectedTraitIds.length
            ? withProfile(catalog, TRAIT.SHADESTEP, {
                effects: catalog.balanceProfilesById
                  .get(TRAIT.SHADESTEP)
                  .effects.filter((effect) => effect.name !== 'protection')
              })
            : catalog
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.sourceId === TRAIT.SHADESTEP),
      false
    );
    assert.ok(result.events.some((event) => event.skillId === ID.DAWNS_REPOSE && event.kind === 'barrier'));
  }
});
