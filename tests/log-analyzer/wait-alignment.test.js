import assert from 'node:assert/strict';
import test from 'node:test';
import { readDpsReportRotationData } from '#gw2/app/build/io/dps-report-rotation-import.js';
import { alignImportedRotationWaits } from '#gw2/app/build/io/log-rotation-import.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, log } from '../helpers/evtc-fixture.js';

// Minimal skills expose cooldown and concurrent-lane contracts without depending on benchmark rotations.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 1, name: 'Cooldown Skill', castTimeMs: 120, cooldown: 1, effects: [] },
    { id: 2, name: 'Next Cast', castTimeMs: 120, effects: [] },
    { id: 3, name: 'Long Cast', castTimeMs: 1200, effects: [] },
    { id: 4, name: 'Instant', castTimeMs: 0, effects: [] }
  ]
});

test('import correction uses one scheduler pass and handles cooldowns exposed by shortened waits', async () => {
  let initializations = 0;
  const profession = defineProfession({
    id: 'mesmer',
    name: 'Mesmer',
    catalog,
    schedulerHooks: {
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

  assert.equal(initializations, 1);
  assert.strictEqual(app.build.rotation, originalRotation);
  assert.deepEqual(
    imported.rotation.filter((c) => c.type === 'wait'),
    [
      { type: 'wait', durationMs: 360 },
      { type: 'wait', durationMs: 160 }
    ]
  );
  const replay = createScheduler({ profession }).run(imported.rotation);
  assert.equal(replay.steps.filter((s) => s.skillId === 1).at(-1).start, 2240);
  assert.equal(replay.steps.find((s) => s.skillId === 2).start, 2520);
  assert.deepEqual(replay.warnings, []);
});

test('fully absorbed waits retain the serial barrier before a concurrent input', () => {
  const profession = defineProfession({ id: 'fixture', name: 'Fixture', catalog });
  const rotation = [
    { type: 'cast', skillId: 3 },
    { type: 'cast', skillId: 4, concurrentOffsetMs: 200 },
    { type: 'wait', durationMs: 80 },
    { type: 'cast', skillId: 4, concurrentOffsetMs: 100 }
  ];
  const corrected = alignImportedRotationWaits(rotation, new Map([[2, 280]]), { adapter: { profession } }, {});
  assert.deepEqual(corrected.rotation[2], { type: 'wait', durationMs: 0 });
  assert.equal(rotation[2].durationMs, 80);
  assert.equal(createScheduler({ profession }).run(corrected.rotation).steps.at(-1).start, 1200);
  assert.deepEqual(corrected.warnings, []);
});

test('EVTC wait targets use replay-relative time and feed the same correction', () => {
  const profession = defineProfession({ id: 'mesmer', name: 'Mesmer', catalog });
  const waitTargets = new Map();
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
    catalog,
    { onReplayWait: (index, targetMs) => waitTargets.set(index, targetMs) }
  );
  assert.deepEqual([...waitTargets.values()], [1600, 2520]);
  const corrected = alignImportedRotationWaits(
    normalizeRotation(imported.rotation, catalog, { strict: true }),
    waitTargets,
    { adapter: { profession } },
    {}
  );
  assert.equal(createScheduler({ profession }).run(corrected.rotation).steps.at(-1).start, 2520);
});

test('scheduler wait adjustments reject invalid durations', () => {
  const profession = defineProfession({ id: 'fixture', name: 'Fixture', catalog });
  for (const durationMs of [-1, NaN, Infinity]) {
    assert.throws(
      () => createScheduler({ profession }).run([{ type: 'wait', durationMs: 40 }], () => durationMs),
      /Adjusted wait duration must be a non-negative finite number/
    );
  }
});
