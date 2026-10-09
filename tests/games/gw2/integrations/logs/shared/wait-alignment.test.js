import assert from 'node:assert/strict';
import test from 'node:test';
import { readDpsReportRotationData } from '#gw2/app/import-export/logs/dps-report-rotation-import.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineProfession } from '#gw2/platform/profession-definition/compile-contract.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';
import { buildReplayTimeline } from '#gw2/integrations/logs/shared/rotation/timeline.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';

// Minimal skills expose a recharge the recorded casts violate without depending on benchmark rotations.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 1, name: 'Cooldown Skill', castTimeMs: 120, cooldown: 1, effects: [] },
    { id: 2, name: 'Next Cast', castTimeMs: 120, effects: [] }
  ]
});

const waitDurations = (rotation) => rotation.filter((command) => command.type === 'wait').map((c) => c.durationMs);

// A companion opener must neither pull the player's first input forward nor force it to wait for the companion.
test('an independent opener preserves the first player input and combat boundary', () => {
  const companion = { id: 3, name: 'Companion', independentCast: true, quicknessCastTimeMs: 2000, castTimeMs: 3000 };
  const player = { id: 4, name: 'Player', castTimeMs: 400 };
  const actions = [
    { start: 1000, end: 3000, eventIndex: 0, skill: companion, name: companion.name, skillId: companion.id },
    { start: 1520, end: 1920, eventIndex: 1, skill: player, name: player.name, skillId: player.id },
    { start: 2600, end: 3000, eventIndex: 2, skill: player, name: player.name, skillId: player.id }
  ];
  const rotation = buildReplayTimeline(actions, 1000, 1600, {
    alignWaitsToSimulatorTiming: true,
    commandFor: (action) => ({ type: 'cast', skillId: action.skillId })
  });
  const cursor = new RotationCursor(rotation);
  cursor.acceptCast(companion, cursor.command, 0, 2, 2);
  assert.equal(cursor.requestAt(0, player), 0.52);
  cursor.acceptCast(player, cursor.command, 0.52, 0.92, 0.92);
  assert.equal(cursor.requestAt(0.52), 0.6);
  cursor.consume();
  assert.equal(cursor.requestAt(0.6, player), 1.6);
});

test('player gaps do not join an inferred companion cast with a different boon state', () => {
  // An instant command can start a long companion action. Only an explicit Wait should join both lanes.
  const companion = { id: 3, name: 'Companion', independentCast: true, quicknessCastTimeMs: 1200, castTimeMs: 2000 };
  const player = { id: 4, name: 'Player', castTimeMs: 400 };
  const actions = [
    { start: 0, end: 400, skill: player },
    { start: 200, end: 200, skill: companion },
    { start: 800, end: 1200, skill: player },
    { start: 1600, end: 2000, skill: player },
    { start: 2800, end: 3200, skill: player },
    { start: 3600, end: 4000, skill: player }
  ].map((action, eventIndex) => ({ ...action, eventIndex, name: action.skill.name, skillId: action.skill.id }));
  const rotation = buildReplayTimeline(actions, 0, null, {
    alignWaitsToSimulatorTiming: true,
    hasObservedCastTime: (action) => action.skill !== companion,
    commandFor: (action) => ({ type: 'cast', skillId: action.skillId })
  });
  for (const companionDuration of [1.2, 2]) {
    const cursor = new RotationCursor(rotation);
    let now = 0;
    const starts = [];
    while (cursor.command) {
      const command = cursor.command;
      if (command.type === 'wait') {
        now = cursor.requestAt(now) + command.durationMs / 1000;
        cursor.acceptWait(now);
        continue;
      }

      const skill = command.skillId === companion.id ? companion : player;
      now = cursor.requestAt(now, skill);
      const end = now + (skill === companion ? companionDuration : 0.4);
      if (skill === player) starts.push(now);
      cursor.acceptCast(skill, command, now, end, end);
    }

    assert.deepEqual(starts, [0, 0.8, 1.6, 2.8, 3.6]);
  }

  // Once player work outlasts the companion, ordinary gaps remain editable Wait commands.
  assert.ok(rotation.some((command) => command.type === 'wait'));
});

test('dps.report import keeps log-derived waits when replayed casts would be delayed', async () => {
  let initializations = 0;
  const profession = defineProfession({
    id: 'mesmer',
    name: 'Mesmer',
    catalog,
    hooks: {
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
