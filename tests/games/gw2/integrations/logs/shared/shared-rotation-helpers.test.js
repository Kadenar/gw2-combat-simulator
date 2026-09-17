import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';

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
