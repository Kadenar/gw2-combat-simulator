import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { reconstructEngineerDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Synthetic inputs isolate corroboration boundaries without pinning a benchmark rotation or skill timing.
test('Engineer removes only inaccurate Overcharged Shot markers covered by an animation and its trailing tick', () => {
  const animation = {
    start: 1000,
    end: 1700,
    rawSkillId: ID.OVERCHARGED_SHOT,
    rawName: 'Localized rifle skill',
    status: 'completed',
    eventIndex: 1,
    isSwap: false,
    metadataAccurate: false
  };
  for (const profile of ROTATION_PROFILES.filter((entry) => entry.professionId === 'engineer')) {
    const normalize = (recordedActions) =>
      reconstructEngineerDpsReportActions({ profile, catalog: engineerCatalog, recordedActions });
    for (const start of [999, 1000, 1400, 1700, 1740, 1750, 1751]) {
      const marker = { ...animation, start, end: start, status: 'instant', eventIndex: 2 };
      const accurate = { ...marker, metadataAccurate: true, eventIndex: 3 };
      const unrelated = { ...marker, rawSkillId: ID.NET_SHOT, eventIndex: 4 };
      const laterAnimation = { ...animation, start: 3000, end: 3700, eventIndex: 5 };
      for (const actions of [
        [animation, marker, accurate, unrelated, laterAnimation],
        [laterAnimation, unrelated, accurate, marker, animation]
      ]) {
        assert.deepEqual(
          new Set(normalize(actions)),
          new Set(
            actions.filter((action) => action !== marker || start < animation.start || start > animation.end + 50)
          )
        );
      }

      assert.deepEqual(normalize([marker]), [marker]);
    }
  }
});

/** Equivalent animation and damage evidence must produce the same replay input in either importer. */
function reconstructFixture(format, includeMarker) {
  const skillId = ID.OVERCHARGED_SHOT;

  if (format === 'dps.report') {
    return reconstructDpsReportRotation(
      {
        players: [
          {
            name: 'Fixture',
            profession: 'Engineer',
            rotation: [
              {
                id: skillId,
                skills: [{ castTime: 1000, duration: 400 }, ...(includeMarker ? [{ castTime: 1440, duration: 0 }] : [])]
              }
            ]
          }
        ],
        phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
        skillMap: { [`s${skillId}`]: { name: 'Overcharged Shot', isInstantCast: true, isNotAccurate: true } }
      },
      engineerCatalog
    );
  }

  return reconstructEvtcRotation(
    log({
      agents: [{ ...log().agents[0], profession: 3, elite: 0 }],
      skills: [{ id: skillId, name: 'Overcharged Shot' }],
      events: [
        event({ time: 0, stateChange: 1 }),
        event({ time: 1000, stateChange: 67, skillId, value: 400 }),
        event({ time: 1400, stateChange: 68, skillId, value: 400, activation: 3 }),
        ...(includeMarker ? [event({ time: 1440, target: 0x2000n, skillId, value: 100 })] : []),
        event({ time: 3000, stateChange: 2 })
      ]
    }),
    engineerCatalog
  );
}

for (const format of ['dps.report', 'evtc']) {
  test(`${format} Overcharged Shot corroboration preserves evidence without adding a replay input`, () => {
    const animation = reconstructFixture(format, false);
    const corroborated = reconstructFixture(format, true);
    assert.ok(animation.rotation.some((command) => command.skillId === ID.OVERCHARGED_SHOT));
    assert.equal(corroborated.sourceActions.length, animation.sourceActions.length + 1);
    assert.deepEqual(corroborated.rotation, animation.rotation);
  });
}
