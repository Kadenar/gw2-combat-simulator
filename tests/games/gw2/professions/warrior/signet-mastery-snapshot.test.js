import assert from 'node:assert/strict';
import test from 'node:test';

import { warriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';

// Two Signet Mastery applications (1 stack each, 60s) plus a later one that
// only comes up after the first two lapse. Mirrors how the trait stacks the
// "signet-mastery" boon in the simulation's own buff timeline.
const RESULT = {
  events: [
    { type: 'buff', kind: 'signet-mastery', at: 1, duration: 60, stacks: 1 },
    { type: 'buff', kind: 'signet-mastery', at: 2, duration: 60, stacks: 1 },
    { type: 'buff', kind: 'signet-mastery', at: 61.5, duration: 60, stacks: 1 }
  ]
};

// Arms tier-1 major slot picks position 2 (Signet Mastery); position 1 does not.
const WITH_TRAIT = { specializations: [{ name: 'Arms', traits: '2-1-1' }] };
const WITHOUT_TRAIT = { specializations: [{ name: 'Arms', traits: '1-1-1' }] };

function snapshot(build, atSeconds) {
  return warriorCoreUi.rotationStateSnapshot({ build, result: RESULT, atSeconds });
}

test('Signet Mastery bar shows the stacks active at the inspection point', () => {
  const [item] = snapshot(WITH_TRAIT, 3);

  assert.equal(item.id, 'signet-mastery');
  assert.equal(item.label, 'Signet Mastery');
  assert.equal(item.value, '2/5');
  assert.match(item.title, /\+200 ferocity/);
});

test('Signet Mastery bar counts only applications still within their window', () => {
  assert.equal(snapshot(WITH_TRAIT, 1.5)[0].value, '1/5');
  assert.deepEqual(snapshot(WITH_TRAIT, 0.5), []); // before the first stack
  assert.equal(snapshot(WITH_TRAIT, 62)[0].value, '1/5'); // first two lapsed
});

test('Signet Mastery bar caps at 5 stacks', () => {
  const overstacked = {
    events: Array.from({ length: 7 }, (_unused, index) => ({
      type: 'buff',
      kind: 'signet-mastery',
      at: index * 0.1,
      duration: 60,
      stacks: 1
    }))
  };
  const [item] = warriorCoreUi.rotationStateSnapshot({
    build: WITH_TRAIT,
    result: overstacked,
    atSeconds: 1
  });

  assert.equal(item.value, '5/5');
});

test('Signet Mastery bar is hidden when the trait is not chosen', () => {
  assert.deepEqual(snapshot(WITHOUT_TRAIT, 3), []);
});
