/** Imported protocol identities must follow selected slots while preserving the original log evidence. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { reconstructAmalgamDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/engineer/amalgam.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

const selectedMorphSkillIds = [77103, 76901, 76640];
const profile = ROTATION_PROFILES.find((entry) => entry.specializationId === 'amalgam');

test('Amalgam selects protocol identities by kind without rewriting raw evidence or inventing unavailable choices', () => {
  const action = Object.freeze({
    start: 1000,
    end: 1800,
    rawSkillId: 76568,
    rawName: 'Recorded Shred',
    status: 'completed',
    eventIndex: 2,
    isSwap: false,
    metadataAccurate: true
  });
  const normalize = (ids, catalog = engineerCatalog) =>
    reconstructAmalgamDpsReportActions({
      profile,
      catalog,
      recordedActions: [action],
      professionConfig: ids === undefined ? undefined : { selectedMorphSkillIds: ids }
    })[0];
  assert.deepEqual(normalize(selectedMorphSkillIds), {
    ...action,
    canonicalSkillId: 77103,
    canonicalName: engineerCatalog.skillsById.get(77103).name
  });
  for (const ids of [undefined, [], [76901, 76640], [77103, 76568]]) assert.deepEqual(normalize(ids), action);
  assert.deepEqual(normalize(selectedMorphSkillIds, null), action);
});

/** Exercise the public import boundary directly so a later saved-build migration cannot hide an invalid command. */
function importProtocols(format) {
  const options = { professionConfig: { selectedMorphSkillIds } };

  if (format === 'evtc')
    return reconstructEvtcRotation(
      log({
        agents: [{ ...log().agents[0], profession: 3, elite: 75 }],
        skills: [
          { id: 76568, name: 'Offensive Protocol: Shred' },
          { id: 77163, name: 'Defensive Protocol: Thorns' },
          { id: 77283, name: 'Thorns' }
        ],
        events: [
          event({ time: 0, stateChange: 15, source: 200000n }),
          event({ time: 0, stateChange: 1 }),
          event({ time: 1000, stateChange: 67, skillId: 76568, value: 800 }),
          event({ time: 1800, stateChange: 68, skillId: 76568, value: 800, activation: 3 }),
          event({ time: 2000, stateChange: 69, skillId: 77283, target: PLAYER, value: 6000 }),
          event({ time: 3000, stateChange: 2 })
        ]
      }),
      engineerCatalog,
      options
    );

  return reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Amalgam',
          rotation: [
            { id: 76568, skills: [{ castTime: 1000, duration: 800 }] },
            { id: 77163, skills: [{ castTime: 2000, duration: 0 }] }
          ]
        }
      ],
      phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
      skillMap: {
        s76568: { name: 'Offensive Protocol: Shred' },
        s77163: { name: 'Defensive Protocol: Thorns', isInstantCast: true }
      }
    },
    engineerCatalog,
    options
  );
}

for (const format of ['evtc', 'dps.report'])
  test(`${format} protocol imports simulate in their selected slots without a build migration`, () => {
    const imported = importProtocols(format);
    const casts = imported.rotation.filter((command) => command.type === 'cast');
    assert.ok(casts.some((command) => command.skillId === 77103));
    assert.ok(casts.some((command) => command.skillId === 76640));
    assert.ok(!casts.some((command) => [76568, 77163].includes(command.skillId)));
    assert.ok(imported.sourceActions.some((action) => action.rawSkillId === 76568));
    assert.ok(imported.sourceActions.some((action) => action.rawSkillId === 77163));
    const result = simulateGw2({
      profession: engineerProfession,
      rotation: imported.rotation,
      config: { specialization: 'Amalgam', selectedMorphSkillIds },
      collectChartData: false
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.steps.some((step) => step.skillId === 77103 && !step.invalid));
    assert.ok(result.steps.some((step) => step.skillId === 76640 && !step.invalid));
  });
