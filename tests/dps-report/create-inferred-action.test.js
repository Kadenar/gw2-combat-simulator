import assert from 'node:assert/strict';
import test from 'node:test';

import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';

test('creates inferred dps.report actions with shared defaults and explicit exceptions', () => {
  const skill = { id: 123, name: 'Recovered Skill' };

  assert.deepEqual(createInferredAction(skill, 100, 100, -1, 'ranger-opening'), {
    start: 100,
    end: 100,
    rawSkillId: 123,
    rawName: 'Recovered Skill',
    status: 'instant',
    eventIndex: -1,
    isSwap: false,
    metadataAccurate: false,
    inference: 'ranger-opening',
    canonicalSkillId: 123,
    canonicalName: 'Recovered Skill'
  });
  assert.deepEqual(
    createInferredAction(skill, 100, 100, -2, 'conduit-opening', {
      status: 'completed',
      isSwap: true,
      expectedDurationMs: 0
    }),
    {
      start: 100,
      end: 100,
      rawSkillId: 123,
      rawName: 'Recovered Skill',
      status: 'completed',
      eventIndex: -2,
      isSwap: true,
      metadataAccurate: false,
      expectedDurationMs: 0,
      inference: 'conduit-opening',
      canonicalSkillId: 123,
      canonicalName: 'Recovered Skill'
    }
  );
});
