import assert from 'node:assert/strict';
import test from 'node:test';

import { createStrikePacketMatcher } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { event, EVTC_FIXTURE_PLAYER, log } from '#tests/helpers/evtc-fixture.js';

// Reconstruction must retain authored packet evidence for false-stop recovery, even when skills transform effects.
test('packet matching retains observed evidence for skills with acceptance transforms', () => {
  for (const transformed of [false, true]) {
    const skill = {
      id: 1,
      name: 'Fixture',
      castTimeMs: 0,
      effects: [{ type: 'strike', coefficient: 1, atMs: 0 }],
      ...(transformed
        ? {
            effectVariants: [
              {
                when: () => true,
                transform() {
                  throw new Error('Static matching must not run combat transforms');
                }
              }
            ]
          }
        : {})
    };
    const action = {
      rawSkillId: 1,
      rawName: 'Fixture',
      start: 100,
      end: 100,
      eventIndex: 0,
      status: 'interrupted',
      replayInterruptMs: 0
    };
    const context = {
      catalog: { skills: [skill], skillsById: new Map([[1, skill]]) },
      profile: { professionId: 'elementalist', specializationName: 'Evoker', skillNameAliases: {}, skillIdAliases: {} },
      playerAddress: EVTC_FIXTURE_PLAYER,
      recordedActions: [action],
      log: log({ skills: [{ id: 1, name: 'Fixture' }], events: [event({ time: 100, skillId: 1, value: 10 })] })
    };
    const match = createStrikePacketMatcher(context);
    assert.equal(match(action).allObserved, true);
    assert.equal(match(action).allObservedTimingExplicit, true);
  }
});
