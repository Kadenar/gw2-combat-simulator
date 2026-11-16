// Clock observations require independent periodic evidence and must not change imported simulation settings.
import assert from 'node:assert/strict';
import test from 'node:test';

import { previewRotationFile } from '#gw2/app/import-export/rotation-import-dialog.js';
import { analyzeConditionClockObservation } from '#gw2/integrations/logs/evtc/rotation/condition-clock-observation.js';
import { event, expandedEvtcFixture, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { rotationCatalog } from '#tests/helpers/rotation-catalog.js';

const TARGET = 0x2000n;

function strike(overrides = {}) {
  return event({ target: TARGET, iff: 1, value: 10000, skillId: 1000, ...overrides });
}

function tick(time, overrides = {}) {
  return event({ time, target: TARGET, iff: 1, buff: 1, buffDamage: 100, skillId: 737, result: 14, ...overrides });
}

function observe(events) {
  return analyzeConditionClockObservation(log({ events }), PLAYER);
}

test('clock inference measures a repeated phase despite jitter and isolated outliers', () => {
  const ticks = [1283, 2273, 3293, 4283, 5285, 6283].map((time) => tick(time));
  const result = observe([strike(), ...ticks, tick(3720)]);

  assert.deepEqual(result, {
    status: 'estimated',
    offsetMs: 720,
    phaseMs: 283,
    tickCount: 7,
    matchedTickCount: 6,
    jitterMs: 10
  });
});

test('clock inference treats jitter across the second boundary as one phase', () => {
  const result = observe([strike(), ...[1998, 3002, 4000, 4999, 6001].map((time) => tick(time))]);

  assert.equal(result.status, 'estimated');
  assert.equal(result.offsetMs, 0);
  assert.equal(result.phaseMs, 0);
  assert.equal(result.jitterMs, 2);
});

test('clock inference excludes other players, other targets, on-hit damage and removal payouts', () => {
  const events = [strike(), ...[1283, 2283, 3283, 4283, 5283].map((time) => tick(time))];
  for (let index = 0; index < 8; index += 1) {
    const time = 1400 + index * 1000;
    events.push(
      tick(time, { source: 0x3000n }),
      tick(time, { target: 0x4000n }),
      tick(time, { result: 15 }),
      tick(time, { result: 18 }),
      tick(time, { stateChange: 69 }),
      tick(time, { buffRemove: 1 }),
      tick(time, { skillId: 57409, result: 16 }),
      tick(time, { buffDamage: 0 }),
      tick(time, { iff: 0 })
    );
  }

  const result = observe(events);
  assert.equal(result.status, 'estimated');
  assert.equal(result.offsetMs, 720);
  assert.equal(result.tickCount, 5);
});

test('simultaneous condition packets and a single burst cannot establish five independent cycles', () => {
  assert.deepEqual(observe([strike(), ...Array.from({ length: 10 }, () => tick(1283))]), {
    status: 'unavailable',
    reason: 'insufficient-ticks'
  });
  assert.deepEqual(observe([strike(), ...[1280, 1281, 1282, 1283, 1284].map((time) => tick(time))]), {
    status: 'unavailable',
    reason: 'insufficient-ticks'
  });
});

test('conflicting clock phases do not produce a recommendation', () => {
  const ticks = Array.from({ length: 6 }, (_, index) => [tick(1283 + index * 1000), tick(1783 + index * 1000)]).flat();

  assert.deepEqual(observe([strike(), ...ticks]), { status: 'unavailable', reason: 'unstable-ticks' });
});

test('condition-first damage and missing modern tick evidence remain unavailable', () => {
  const ticks = [1283, 2283, 3283, 4283, 5283].map((time) => tick(time));

  assert.deepEqual(observe(ticks), { status: 'unavailable', reason: 'condition-opening' });
  assert.deepEqual(observe([]), { status: 'unavailable', reason: 'no-target' });
  assert.deepEqual(
    analyzeConditionClockObservation(
      log({ header: { ...log().header, arcdpsBuild: '20260401' }, events: [strike(), ...ticks] }),
      PLAYER
    ),
    { status: 'unavailable', reason: 'unsupported-recording' }
  );
});

test('owned actors can establish the first damage anchor', () => {
  const minion = 0x5000n;
  const fixture = log({
    agents: [...log().agents, { ...log().agents[0], address: minion, elite: 0xffffffff }],
    events: [
      strike({ time: 900, source: minion, sourceInstance: 2, sourceMasterInstance: 1 }),
      strike(),
      ...[1283, 2283, 3283, 4283, 5283].map((time) => tick(time))
    ]
  });
  const result = analyzeConditionClockObservation(fixture, PLAYER);

  assert.equal(result.status, 'estimated');
  assert.equal(result.phaseMs, 383);
  assert.equal(result.offsetMs, 600);
});

test('EVTC preview surfaces clock evidence without applying the suggested setting', async () => {
  // Encode only the damage evidence needed to exercise the actual file parser and preview boundary.
  const packets = [strike(), ...[1283, 2283, 3283, 4283, 5283].map((time) => tick(time))].map((entry) => {
    const bytes = Buffer.alloc(64);
    bytes.writeBigUInt64LE(BigInt(entry.time), 0);
    bytes.writeBigUInt64LE(entry.source, 8);
    bytes.writeBigUInt64LE(entry.target, 16);
    bytes.writeInt32LE(entry.value, 24);
    bytes.writeInt32LE(entry.buffDamage, 28);
    bytes.writeUInt32LE(entry.skillId, 36);
    bytes.writeUInt16LE(entry.sourceInstance, 40);
    bytes[48] = entry.iff;
    bytes[49] = entry.buff;
    bytes[50] = entry.result;
    return bytes;
  });
  const file = new File([Buffer.concat([expandedEvtcFixture(), ...packets])], 'clock.evtc');
  const app = {
    profession: { id: 'mesmer', name: 'Mesmer' },
    adapter: {
      eliteSpecialization: () => 'Chronomancer',
      createBuildContext: () => ({ simulationConfig: () => ({}) })
    },
    build: { rotation: [] },
    simulationSettings: { conditionTickOffsetMs: 400 },
    activeCatalog: rotationCatalog([{ id: 1000, name: 'Mind Stab', type: 'Weapon', castTimeMs: 800, effects: [] }])
  };
  const preview = await previewRotationFile(file, app);
  const observation = preview.observations.find((item) => item.title === 'Condition clock offset');

  assert.match(observation.summary, /720 ms/);
  assert.match(observation.detail, /283 ms/);
  assert.match(observation.detail, /5 of 5/);
  assert.equal(preview.conditionTickOffsetMs, undefined);
  assert.equal(app.simulationSettings.conditionTickOffsetMs, 400);
  assert.deepEqual(app.build.rotation, []);
});
