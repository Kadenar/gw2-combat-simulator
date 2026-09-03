import assert from 'node:assert/strict';
import test from 'node:test';

import {
  alignToReference,
  baseSkillToken,
  sequenceEditDistance,
  sequenceSimilarity,
  tokenizeActions
} from '#gw2/app/rotation/result/loop-analysis-sequences.js';

function action(skillId, sequenceIndex) {
  return {
    sequenceIndex,
    skillId,
    name: `Skill ${skillId}`,
    icon: '',
    activationId: `activation-${sequenceIndex}`,
    startMs: sequenceIndex * 500,
    endMs: sequenceIndex * 500 + 250,
    rotationIndex: sequenceIndex,
    weaponSet: 1,
    attunement: '',
    weaponLine: '',
    weaponLineDestination: undefined,
    cancelled: false
  };
}

test('loop tokenization keeps interleaved casts outside complete autoattack chains', () => {
  const tokens = tokenizeActions(
    [action(1, 0), action(9, 1), action(2, 2), action(3, 3), action(1, 4), action(2, 5)],
    new Map([['1', [1, 2, 3]]])
  );

  assert.deepEqual(
    tokens.map(({ key, count }) => ({ key, count })),
    [
      { key: 'auto-chain:1', count: 1 },
      { key: 'skill:9', count: 1 },
      { key: 'auto-chain-fragment:1', count: 2 }
    ]
  );
  assert.deepEqual(
    tokens[0].actions.map(({ skillId }) => skillId),
    [1, 2, 3]
  );
});

test('loop sequence comparison aligns inserted actions without shifting later matches', () => {
  const reference = [1, 2, 3].map((skillId, index) => baseSkillToken(action(skillId, index)));
  const candidate = [1, 9, 2, 3].map((skillId, index) => baseSkillToken(action(skillId, index)));
  const alignment = alignToReference(reference, candidate);

  assert.equal(sequenceEditDistance(reference, candidate), 1);
  assert.equal(sequenceSimilarity(reference, candidate), 0.75);
  assert.deepEqual(
    alignment.matches.map((token) => token?.primarySkillId),
    [1, 2, 3]
  );
  assert.deepEqual(
    alignment.insertions.map(({ slot, token }) => ({ slot, skillId: token.primarySkillId })),
    [{ slot: 1, skillId: 9 }]
  );
});
