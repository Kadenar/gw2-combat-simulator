import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import {
  LOG_OPENER_WARNING,
  MUSHROOM_KINGS_BLESSING_BUFF_ID,
  MUSHROOM_KINGS_BLESSING_SKILL_ID
} from '#gw2/integrations/logs/shared/rotation/model.js';
import { applyRotationImportPreview } from '#gw2/app/import-export/rotation-import-dialog.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { event, log, expandedEvtcFixture } from '#tests/helpers/evtc-fixture.js';
import { encounterStartTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';

const catalog = { skills: [{ id: 1000, name: 'Mind Stab', castTimeMs: 400, type: 'Weapon', effects: [] }] };
const cast = (start = 0, end = 400) => [
  event({ time: start, stateChange: 67, skillId: 1000, value: end - start }),
  event({ time: end, stateChange: 68, skillId: 1000, value: end - start, activation: 5 })
];

// Golem damage starts the observation window, while an aborted auto remains a pre-combat input.
test('golem combat start follows damage inside a cast instead of the initial player combat snapshot', () => {
  const target = { ...log().agents[0], address: 0x2000n, profession: 16199, elite: 0xffffffff };
  const fixture = log({
    agents: [...log().agents, target],
    events: [
      event({ time: 0, stateChange: 47, target: target.address }),
      event({ time: 0, stateChange: 1 }),
      ...cast(40, 80).map((e) => (e.stateChange === 68 ? { ...e, activation: 4 } : e)),
      ...cast(80, 480),
      event({ time: 280, target: target.address, skillId: 1000, value: 100 })
    ].sort((a, b) => a.time - b.time)
  });
  const out = reconstructEvtcRotation(fixture, catalog);
  assert.equal(out.combatStartTimestampMs, 240);
  assert.deepEqual(out.rotation, [
    { type: 'cast', skillId: 1000, interruptAfterMs: 40 },
    { type: 'cast', skillId: 1000 },
    { type: 'combat-start', concurrentOffsetMs: 200 }
  ]);
});

test('golem start accepts strike and condition damage from any source but rejects buff and animation payloads', () => {
  const target = { ...log().agents[0], address: 0x2000n, profession: 16199, elite: 0xffffffff };
  const setup = [
    event({ time: 0, stateChange: 47, target: target.address }),
    event({ time: 20, stateChange: 69, skillId: 46333, source: target.address, value: 30000 }),
    event({ time: 30, stateChange: 67, target: target.address, value: 400 }),
    event({ time: 40, target: target.address, skillId: 43390, value: 0 }),
    event({ time: 50, target: 0x3000n, value: 100 })
  ];
  // Stolen skills and trait/Mark damage require no weapon cast to define the encounter boundary.
  for (const hit of [
    { skillId: 43373, value: 100 },
    { skillId: 43390, value: 100 },
    { skillId: 13014, value: 100 },
    { skillId: 736, buff: 1, buffDamage: 100 }
  ]) {
    const fixture = log({
      agents: [...log().agents, target],
      events: [...setup, event({ time: 100, source: 0x4000n, target: target.address, ...hit })]
    });
    assert.equal(encounterStartTime(fixture), 100);
    assert.equal(encounterStartTime({ ...fixture, events: fixture.events.slice(1) }), null);
    assert.equal(encounterStartTime({ ...fixture, header: { ...fixture.header, encounterId: 123 } }), null);
  }

  assert.equal(encounterStartTime(log({ agents: [...log().agents, target], events: setup })), null);
});

// Stow is idle time, including at the end of a log where no later cast can recover its duration.
test('EVTC weapon stows become waits for Warrior and other professions', () => {
  for (const profession of [2, 7]) {
    const fixture = log({
      agents: [{ ...log().agents[0], profession, elite: 0 }],
      events: [
        event({ time: 0, stateChange: 1 }),
        ...cast(),
        event({ time: 400, stateChange: 67, skillId: 23285, value: 80 }),
        event({ time: 480, stateChange: 68, skillId: 23285, value: 80, activation: 5 })
      ]
    });
    const result = reconstructEvtcRotation(fixture, catalog);
    assert.deepEqual(result.rotation, [
      { type: 'combat-start' },
      { type: 'cast', skillId: 1000 },
      { type: 'wait', durationMs: 80 }
    ]);
    assert.deepEqual(result.warnings, [LOG_OPENER_WARNING]);
  }
});

// Source evidence must survive conversion even when the simulator's timing differs.
test('EVTC preserves a stop-only pre-log cast and distinguishes recording, combat and replay origins', () => {
  const fixture = log({
    events: [
      event({ time: 0, stateChange: 19, source: 0x2000n }),
      event({ time: 100, stateChange: 1 }),
      event({ time: 200, stateChange: 68, skillId: 1000, value: 800, activation: 5 })
    ]
  });
  const out = reconstructEvtcRotation(fixture, catalog);
  assert.equal(out.sourceActions[0].startMs, -600);
  assert.equal(out.timelineOriginMs, -600);
  assert.equal(out.combatStartTimestampMs, 700);
  assert.equal(out.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
});

test('encounter end excludes new inputs but retains crossing casts', () => {
  const target = { ...log().agents[0], address: 0x2000n, profession: 16199, elite: 0xffffffff };
  const out = reconstructEvtcRotation(
    log({
      agents: [...log().agents, target],
      events: [...cast(0, 400), event({ time: 200, stateChange: 4, source: target.address }), ...cast(200, 600)]
    }),
    catalog
  );
  assert.deepEqual(
    out.sourceActions.map((action) => action.startMs),
    [0]
  );
});

test('incomplete imports keep unsupported diagnostics and receive exactly one opener notice', () => {
  const out = reconstructEvtcRotation(
    log({
      events: [
        ...cast(),
        event({ time: 700, stateChange: 67, skillId: 9999, value: 400 }),
        event({ time: 900, stateChange: 2 })
      ]
    }),
    catalog
  );
  assert.equal(out.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
  assert.ok(out.warnings.some((w) => w.includes('not present')));
  assert.ok(out.warnings.some((w) => w.includes('no matching stop')));
  assert.ok(out.rotation.some((command) => command.type === 'wait'));
});

test('binary parsing retains canonical skill labels', () => {
  assert.equal(parseEvtc(expandedEvtcFixture({ skillName: 'Master Tuning Crystal' })).skills[0].name, 'Tuning Icicle');
});

// Raw logs expose the training reset as a buff gain, so reconstruction must synthesize EI's cast before replay.
test("EVTC Mushroom King's Blessing buff gains become cooldown resets", () => {
  const out = reconstructEvtcRotation(
    log({
      events: [
        event({
          time: 500,
          stateChange: 69,
          skillId: MUSHROOM_KINGS_BLESSING_BUFF_ID,
          target: 0x1000n
        })
      ]
    }),
    catalog
  );

  assert.ok(out.sourceActions.some((action) => action.rawSkillId === MUSHROOM_KINGS_BLESSING_SKILL_ID));
  assert.ok(out.rotation.some((command) => command.type === 'cooldown-reset'));
  assert.ok(out.warnings.every((warning) => !warning.includes('not present')));
});

test('applying an import preserves manually configured starting resources', () => {
  const config = { startingEnergy: 23, startingLifeForce: 42 };
  const app = { build: { rotation: [], professionConfig: config }, changed() {} };
  applyRotationImportPreview(app, { rotation: [{ type: 'cast', skillId: 1000 }], warnings: [LOG_OPENER_WARNING] });
  assert.strictEqual(app.build.professionConfig, config);
});
