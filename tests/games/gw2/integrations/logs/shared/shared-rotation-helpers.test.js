import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { normalizeConduitHazeActions } from '#gw2/integrations/logs/shared/rotation/rules/conduit.js';

test('Conduit import requires Haze timing only for discovered Haze actions', () => {
  const catalog = { skills: [{ id: 77141, name: 'Beguiling Haze', castTimeMs: 1000 }] };
  const action = { start: 0, end: 1000, eventIndex: 0, rawSkillId: 1, status: 'completed' };
  assert.deepEqual(normalizeConduitHazeActions([action], catalog), [action]);
  assert.throws(
    () => normalizeConduitHazeActions([{ ...action, rawSkillId: 77141 }], catalog),
    /missing required profile/
  );
});

test('encounter end is the earliest target death or combat exit', () => {
  const target = 0x100n;
  const other = 0x200n;
  const log = {
    header: { encounterId: 16_146 },
    agents: [
      { address: target, profession: 16_146 },
      { address: other, profession: 1 }
    ],
    events: [
      { source: other, stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD, time: 1_000 },
      { source: target, stateChange: EVTC_STATE_CHANGE.EXIT_COMBAT, time: 3_000 },
      { source: target, stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD, time: 2_000 }
    ]
  };

  assert.equal(encounterEndTime(log), 2_000);
});
