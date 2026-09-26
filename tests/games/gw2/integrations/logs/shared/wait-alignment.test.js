import assert from 'node:assert/strict';
import test from 'node:test';
import { readDpsReportRotationData } from '#gw2/app/io/logs/dps-report-rotation-import.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Minimal skills expose a recharge the recorded casts violate without depending on benchmark rotations.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 1, name: 'Cooldown Skill', castTimeMs: 120, cooldown: 1, effects: [] },
    { id: 2, name: 'Next Cast', castTimeMs: 120, effects: [] }
  ]
});

const waitDurations = (rotation) => rotation.filter((command) => command.type === 'wait').map((c) => c.durationMs);

test('dps.report import keeps log-derived waits when replayed casts would be delayed', async () => {
  let initializations = 0;
  const profession = defineProfession({
    id: 'mesmer',
    name: 'Mesmer',
    catalog,
    live: {
      initialize: () => {
        initializations += 1;
      }
    }
  });
  const originalRotation = [{ type: 'wait', durationMs: 40 }];
  const app = {
    profession,
    activeCatalog: catalog,
    adapter: { profession, eliteSpecialization: () => 'Core', simulationConfig: () => ({}) },
    build: { rotation: originalRotation }
  };
  const imported = await readDpsReportRotationData(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Mesmer',
          rotation: [
            { id: 1, skills: [0, 120, 1600].map((castTime) => ({ castTime, duration: 120 })) },
            { id: 2, skills: [{ castTime: 2520, duration: 120 }] }
          ]
        }
      ],
      phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
      skillMap: { s1: { name: 'Cooldown Skill' }, s2: { name: 'Next Cast' } }
    },
    app
  );

  // An incomplete import can contain casts the scheduler rejects or delays; that replay must not relocate idle time.
  assert.equal(initializations, 0);
  assert.strictEqual(app.build.rotation, originalRotation);
  assert.deepEqual(waitDurations(imported.rotation), [1360, 800]);
});

test('EVTC import keeps the same log-derived waits', () => {
  const imported = reconstructEvtcRotation(
    log({
      skills: [
        { id: 1, name: 'Cooldown Skill' },
        { id: 2, name: 'Next Cast' }
      ],
      events: [
        event({ time: 1000, stateChange: 1 }),
        ...[
          [1000, 1],
          [1120, 1],
          [2600, 1],
          [3520, 2]
        ].flatMap(([time, skillId]) => [
          event({ time, skillId, stateChange: 67, value: 120 }),
          event({ time: time + 120, skillId, stateChange: 68, value: 120, activation: 5 })
        ])
      ]
    }),
    catalog
  );
  assert.deepEqual(waitDurations(normalizeRotation(imported.rotation, catalog, { strict: true })), [1360, 800]);
});
