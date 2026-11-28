/** Imported casts use canonical protocol IDs while source evidence retains the recorded IDs. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

const selectedMorphSkillIds = [76568, 76705, 76640];

/** Exercise the public import boundary directly so a later saved-build migration cannot hide an invalid command. */
function importProtocols(format) {
  if (format === 'evtc')
    return reconstructEvtcRotation(
      log({
        agents: [{ ...log().agents[0], profession: 3, elite: 75 }],
        skills: [
          { id: 77103, name: 'Offensive Protocol: Shred' },
          { id: 77163, name: 'Defensive Protocol: Thorns' },
          { id: 77283, name: 'Thorns' }
        ],
        events: [
          event({ time: 0, stateChange: 15, source: 200000n }),
          event({ time: 0, stateChange: 1 }),
          event({ time: 1000, stateChange: 67, skillId: 77103, value: 800 }),
          event({ time: 1800, stateChange: 68, skillId: 77103, value: 800, activation: 3 }),
          event({ time: 2000, stateChange: 69, skillId: 77283, target: PLAYER, value: 6000 }),
          event({ time: 3000, stateChange: 2 })
        ]
      }),
      engineerCatalog
    );

  return reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Amalgam',
          rotation: [
            { id: 77103, skills: [{ castTime: 1000, duration: 800 }] },
            { id: 77163, skills: [{ castTime: 2000, duration: 0 }] }
          ]
        }
      ],
      phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
      skillMap: {
        s77103: { name: 'Offensive Protocol: Shred' },
        s77163: { name: 'Defensive Protocol: Thorns', isInstantCast: true }
      }
    },
    engineerCatalog
  );
}

for (const format of ['evtc', 'dps.report'])
  test(`${format} imports button IDs as canonical protocols without a selected build`, () => {
    const imported = importProtocols(format);
    const casts = imported.rotation.filter((command) => command.type === 'cast');
    assert.ok(casts.some((command) => command.skillId === 76568));
    assert.ok(casts.some((command) => command.skillId === 76640));
    assert.ok(!casts.some((command) => [77103, 77163].includes(command.skillId)));
    assert.ok(imported.sourceActions.some((action) => action.rawSkillId === 77103));
    assert.ok(imported.sourceActions.some((action) => action.rawSkillId === 77163));
    const result = simulateGw2({
      profession: engineerProfession,
      rotation: imported.rotation,
      config: { specialization: 'Amalgam', selectedMorphSkillIds },
      collectChartData: false
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.steps.some((step) => step.skillId === 76568 && !step.invalid));
    assert.ok(result.steps.some((step) => step.skillId === 76640 && !step.invalid));
  });
