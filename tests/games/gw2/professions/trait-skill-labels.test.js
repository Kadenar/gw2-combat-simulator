import assert from 'node:assert/strict';
import test from 'node:test';

import { invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// A trait invocation keeps the child skill's identity and records which action triggered it.
test('an invoked strike keeps its skill and parent action', () => {
  const skill = { id: 'child', name: 'Child skill', effects: [{ type: 'strike', name: 'component', coefficient: 1 }] };
  const cause = { type: 'damage', at: 0, skillId: 'parent', skillName: 'Parent action' };
  const capture = captureEffectEmissions();
  invokeTraitSkill({ ...capture, helpers: { skillsById: new Map([[skill.id, skill]]) } }, 'trait', skill.id, cause);
  const strike = capture.events.find((event) => event.type === 'damage');
  assert.equal(strike.name, skill.name);
  assert.equal(strike.skillId, skill.id);
  assert.equal(strike.traitId, 'trait');
  assert.equal(strike.parentSkillName, cause.skillName);
});
