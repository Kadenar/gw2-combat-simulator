import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(mesmerProfession, {
  specialization: 'Core',
  primaryWeapon: 'Sword',
  initialResource: 3,
  selectedTraitIds: [TRAIT.BOUNTIFUL_DISILLUSIONMENT],
  attributeInputs: baseAttributeInputs({ concentration: 0 }),
  boons: {},
  allies: { count: 4, strikesPerSecond: 0 },
  target: { armor: 2597, conditions: {} }
});
const rewards = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.BOUNTIFUL_DISILLUSIONMENT);
const expectedBoons = ['might', 'vigor', 'fury', 'regeneration'];

// Each profession slot grants one personal Stability packet and one shared boon, independent of resource count.
test('Bountiful Disillusionment maps shatters and instruments to the correct boon recipients', () => {
  for (const [specialization, skills] of [
    ['Core', ['Mind Wrack', 'Cry of Frustration', 'Diversion', 'Distortion']],
    ['Mirage', ['Mind Wrack', 'Cry of Frustration', 'Diversion', 'Distortion']],
    ['Chronomancer', ['Split Second', 'Rewinder', 'Time Sink', 'Distortion']],
    ['Virtuoso', ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladesong Distortion']],
    ['Troubadour', ['Lively Lute', 'Flustering Flute', 'Deafening Drum', 'Harmonious Harp']]
  ]) {
    for (const [slot, skill] of skills.entries()) {
      const result = simulate(specialization, [
        skill === 'Harmonious Harp' ? 77077 : mesmerCatalog.skills.find((candidate) => candidate.name === skill).id,
        { type: 'wait', durationMs: 6000 }
      ]);
      assert.deepEqual(result.warnings, [], skill);
      const boons = rewards(result);
      assert.deepEqual(
        boons.map((event) => event.kind),
        ['stability', expectedBoons[slot]],
        `${specialization}: ${skill}`
      );
      assert.equal(boons[0].audience.recipients, 'self');
      assert.equal(boons[0].resolvedAudience.recipientCount, 1);
      assert.equal(boons[1].audience.recipients, 'party');
      assert.equal(boons[1].resolvedAudience.includesSelf, true);
      assert.equal(boons[1].resolvedAudience.alliedPlayerCount, 4);
      assert.equal(boons[1].resolvedAudience.recipientCount, 5);
    }
  }
});

// A boon reward requires a committed profession action; ordinary skills and unselected traits cannot grant it.
test('Bountiful Disillusionment respects selection, cancellation, and skill eligibility', () => {
  for (const [specialization, skill, overrides] of [
    ['Core', 'Mind Wrack', { selectedTraitIds: [] }],
    ['Core', 'Mind Slash', {}],
    ['Virtuoso', { name: 'Bladesong Harmony', interruptAfterMs: 1 }, {}],
    ['Troubadour', { name: 'Flustering Flute', interruptAfterMs: 1 }, {}]
  ]) {
    const result = simulate(specialization, [skill, { type: 'wait', durationMs: 6000 }], overrides);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(rewards(result), []);
  }
});

// Self and allied boon eligibility does not require a target or clones.
test('Bountiful Disillusionment grants boons on off-target zero-clone shatters', () => {
  const result = simulate(
    'Core',
    [
      { name: 'Mind Wrack', offTarget: true },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      initialResource: 0
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    rewards(result).map((event) => event.kind),
    ['stability', 'might']
  );
});

// The fifth shatter still grants Stability, but only F1 through F4 have an additional boon.
test('fifth-slot shatters grant only Bountiful Disillusionment Stability', () => {
  for (const [specialization, skill] of [
    ['Virtuoso', 'Bladeturn Requiem'],
    ['Chronomancer', 'Continuum Split']
  ]) {
    const result = simulate(specialization, [skill, { type: 'wait', durationMs: 6000 }]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      rewards(result).map((event) => event.kind),
      ['stability']
    );
  }
});
