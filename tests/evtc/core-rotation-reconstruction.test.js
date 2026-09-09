import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/lib/rotation/model.js';
import { applyRotationImportPreview } from '#gw2/app/build/io/rotation-import-dialog.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { event, log, expandedEvtcFixture } from '../helpers/evtc-fixture.js';

const catalog = { skills: [{ id: 1000, name: 'Mind Stab', castTimeMs: 400, type: 'Weapon', effects: [] }] };
const cast = (start = 0, end = 400) => [
  event({ time: start, stateChange: 67, skillId: 1000, value: end - start }),
  event({ time: end, stateChange: 68, skillId: 1000, value: end - start, activation: 5 })
];

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
  assert.equal(out.sourceActions[0].durationMs, 800);
  assert.equal(out.timelineOriginMs, -600);
  assert.equal(out.combatStartTimestampMs, 700);
  assert.equal(out.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
});

test('source durations and statuses are not rewritten by replay or landed damage', () => {
  const fixture = log({
    events: [
      event({ time: 0, stateChange: 1 }),
      ...cast(100, 220).map((e) => (e.stateChange === 68 ? { ...e, activation: 4 } : e)),
      event({ time: 250, skillId: 1000, value: 100 })
    ]
  });
  const before = structuredClone(fixture);
  const out = reconstructEvtcRotation(fixture, catalog);
  assert.deepEqual(fixture, before);
  assert.equal(out.sourceActions[0].status, 'interrupted');
  assert.equal(out.sourceActions[0].durationMs, 120);
  assert.equal(out.actions[0].durationMs, 120);
  assert.equal(out.actions[0].status, 'interrupted');
});

test('encounter end excludes new inputs but retains crossing casts and their complete stops', () => {
  const target = { ...log().agents[0], address: 0x2000n, profession: 16199, elite: 0xffffffff };
  const out = reconstructEvtcRotation(
    log({
      agents: [...log().agents, target],
      events: [...cast(0, 400), event({ time: 200, stateChange: 4, source: target.address }), ...cast(200, 600)]
    }),
    catalog
  );
  assert.deepEqual(
    out.sourceActions.map((a) => [a.startMs, a.durationMs]),
    [[0, 400]]
  );
  assert.equal(out.actions[0].durationMs, 400);
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
  assert.ok(out.rotation.some((command) => command.name === '__wait'));
});

test('binary parsing retains canonical skill labels', () => {
  assert.equal(parseEvtc(expandedEvtcFixture({ skillName: 'Master Tuning Crystal' })).skills[0].name, 'Tuning Icicle');
});

test('applying an import preserves manually configured starting resources', () => {
  const config = { startingEnergy: 23, startingLifeForce: 42 };
  const app = { build: { rotation: [], professionConfig: config }, changed() {} };
  applyRotationImportPreview(app, { rotation: [{ type: 'cast', skillId: 1000 }], warnings: [LOG_OPENER_WARNING] });
  assert.strictEqual(app.build.professionConfig, config);
});
