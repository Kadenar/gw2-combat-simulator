import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/shared/rotation/model.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/io/logs/evtc-rotation-import.js';
import { applyRotationImportPreview, previewRotationFile } from '#gw2/app/io/rotation-import-dialog.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { decompressEvtcInput } from '#gw2/integrations/logs/evtc/decompression.js';
import { detectEvtcRotationPlayers, reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, expandedEvtcFixture, log } from '#tests/helpers/evtc-fixture.js';

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function zipEvtc(bytes) {
  const name = new TextEncoder().encode('fixture.evtc');
  const compressed = deflateRawSync(bytes);
  const checksum = crc32(bytes);
  const local = new Uint8Array(30 + name.length);
  const localView = new DataView(local.buffer);

  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(14, checksum, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, bytes.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);

  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, checksum, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, bytes.length, true);
  centralView.setUint16(28, name.length, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length + compressed.length, true);

  const result = new Uint8Array(local.length + compressed.length + central.length + end.length);

  result.set(local, 0);
  result.set(compressed, local.length);
  result.set(central, local.length + compressed.length);
  result.set(end, local.length + compressed.length + central.length);

  return result;
}

test('ZIP inflation cancels before forged size metadata can exhaust the expansion budget', async (t) => {
  const payload = new Uint8Array(1024 * 1024);
  const archive = zipEvtc(payload);
  const view = new DataView(archive.buffer);
  const centralOffset = view.getUint32(archive.length - 6, true);
  const declaredSize = view.getUint32(centralOffset + 20, true) * 10;
  const NativeDecompressionStream = globalThis.DecompressionStream;
  let emittedBytes = 0;
  let largestChunk = 0;
  let cancelled = false;

  // Count native output without prefetching so the check measures early cancellation, not just eventual rejection.
  t.mock.method(globalThis, 'DecompressionStream', function (format) {
    const stream = new NativeDecompressionStream(format);
    const reader = stream.readable.getReader();

    return {
      writable: stream.writable,
      readable: new ReadableStream(
        {
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }

            emittedBytes += value.byteLength;
            largestChunk = Math.max(largestChunk, value.byteLength);
            controller.enqueue(value);
          },
          cancel() {
            cancelled = true;
            return reader.cancel();
          }
        },
        { highWaterMark: 0 }
      )
    };
  });

  await assert.rejects(decompressEvtcInput(archive), { code: 'ZIP_BOMB' });
  assert.equal(emittedBytes, 0);
  view.setUint32(centralOffset + 24, declaredSize, true);
  await assert.rejects(decompressEvtcInput(archive), { code: 'INVALID_ZIP' });
  assert.equal(cancelled, true);
  assert.ok(emittedBytes > declaredSize);
  assert.ok(emittedBytes <= declaredSize + largestChunk);
  assert.ok(emittedBytes < payload.byteLength);
});

test('ZIP inflation accepts valid output and retains size and CRC validation', async () => {
  const payload = expandedEvtcFixture();
  const archive = zipEvtc(payload);
  const view = new DataView(archive.buffer);
  const centralOffset = view.getUint32(archive.length - 6, true);

  assert.deepEqual(await decompressEvtcInput(archive), new Uint8Array(payload));
  // Overstated sizes still fail after inflation, and a matching size still requires a valid checksum.
  view.setUint32(centralOffset + 24, payload.length + 1, true);
  await assert.rejects(decompressEvtcInput(archive), { code: 'INVALID_ZIP', message: /expected/ });
  view.setUint32(centralOffset + 24, payload.length, true);
  view.setUint32(centralOffset + 16, (view.getUint32(centralOffset + 16, true) ^ 1) >>> 0, true);
  await assert.rejects(decompressEvtcInput(archive), { code: 'INVALID_ZIP', message: /CRC/ });
});

const catalog = {
  skills: [
    {
      id: 1_000,
      name: 'Mind Stab',
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 800,
      effects: []
    },
    {
      id: 2_000,
      name: 'Time Sink',
      type: 'Profession',
      slot: 'Profession_3',
      castTimeMs: 0,
      effects: [{ type: 'strike', atMs: 0 }]
    },
    {
      id: 3_000,
      name: 'Blink',
      type: 'Utility',
      slot: 'Utility',
      castTimeMs: 500,
      effects: []
    },
    {
      id: -3,
      name: 'Swap Weapons',
      type: 'Action',
      slot: 'Action',
      castTimeMs: 0,
      effects: []
    }
  ]
};

test('requires an address when multiple players have equal action evidence', () => {
  const secondAddress = 0x2000n;
  const fixture = log({
    agents: [
      ...log().agents,
      {
        ...log().agents[0],
        address: secondAddress,
        character: 'Second Chronomancer'
      }
    ],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000 }),
      event({
        time: 1_000,
        source: secondAddress,
        stateChange: 67,
        skillId: 1_000
      })
    ]
  });
  const players = detectEvtcRotationPlayers(fixture);

  assert.equal(players.length, 2);
  assert.throws(
    () => reconstructEvtcRotation(fixture, catalog),
    (error) => error instanceof EvtcError && error.code === 'PLAYER_SELECTION_REQUIRED'
  );
});

test('a recorded Mirage dodge restores the state required to replay an ambush', async () => {
  const { mesmerCatalog } = await import('#gw2/professions/mesmer/profession.js');
  const { simulateMesmer } = await import('#tests/helpers/mesmer-simulation.js');
  const fixture = log({
    agents: [{ ...log().agents[0], elite: 59 }],
    // The owned dodge-source buff identifies the input behind this cloak gain.
    skills: [{ id: 44321, name: 'Imaginary Axes' }],
    events: [
      event({ stateChange: 1 }),
      event({ stateChange: 69, target: 0x1000n, skillId: 40408, value: 1000 }),
      event({ stateChange: 69, target: 0x1000n, skillId: 69209, value: 800 }),
      event({ time: 1100, stateChange: 67, skillId: 44321, value: 1000 }),
      event({ time: 2100, stateChange: 68, skillId: 44321, value: 1000, activation: 5 })
    ]
  });
  const imported = reconstructEvtcRotation(fixture, mesmerCatalog);
  const result = simulateMesmer(imported.rotation, {
    specialization: 'Mirage',
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    initialResource: 0
  });

  assert.deepEqual(imported.warnings, [LOG_OPENER_WARNING]);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.endurance < 100);
  assert.ok(result.steps.some((step) => step.skill === 'Imaginary Axes' && !step.invalid));
  assert.equal(result.endState.profession.availableAmbush, null);
});

test('Frigid Blitz imports retain completed packets without inventing the missing follow-up', async () => {
  const { revenantCatalog, revenantProfession } = await import('#gw2/professions/revenant/profession.js');
  const { simulateGw2 } = await import('#gw2/platform/simulation/simulate.js');
  const { defaultSimulationConfig } = await import('#tests/helpers/fixture-harness-core.js');

  // Replay both split phases and an opening-only log through the real packet scheduler.
  for (const [openingMs, followUp, coefficients, conditions] of [
    [400, false, [], []],
    [681, false, [0.15], ['Chilled']],
    [680, true, [0.15, 1.5], ['Chilled', 'Torment']]
  ]) {
    const fixture = log({
      agents: [{ ...log().agents[0], profession: 9, elite: 0 }],
      skills: [
        { id: 28029, name: 'Frigid Blitz' },
        { id: 26923, name: 'Frigid Blitz' }
      ],
      events: [
        event({ stateChange: 1 }),
        event({ stateChange: 67, skillId: 28029, value: 680 }),
        event({ time: 1000 + openingMs, stateChange: 68, skillId: 28029, value: openingMs, activation: 3 }),
        ...(followUp
          ? [
              event({ time: 1680, stateChange: 67, skillId: 26923, value: 320 }),
              event({ time: 2000, stateChange: 68, skillId: 26923, value: 320, activation: 3 })
            ]
          : [])
      ]
    });
    const imported = reconstructEvtcRotation(fixture, revenantCatalog);
    const result = simulateGw2({
      profession: revenantProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({ specialization: 'Core', primaryWeapon: 'Mace', secondaryWeapon: 'Axe' }),
      observationPolicy: { kind: 'tail', durationMs: 1500 }
    });
    const packets = result.events.filter((entry) => entry.skillName === 'Frigid Blitz');
    const cast = result.steps.find((step) => step.skill === 'Frigid Blitz');

    assert.deepEqual(imported.warnings, [LOG_OPENER_WARNING]);
    assert.deepEqual(result.warnings, []);
    assert.ok(cast && !cast.invalid && !cast.cancelledBeforeCommit);
    assert.deepEqual(
      packets.filter((entry) => entry.type === 'damage').map((entry) => entry.coefficient),
      coefficients
    );
    assert.deepEqual(
      packets.filter((entry) => entry.type === 'condition').map((entry) => entry.condition),
      conditions
    );
    if (!followUp) assert.equal(cast.end - cast.start, openingMs === 681 ? 680 : openingMs);
  }
});

test('the browser rotation importer previews compressed .zevtc files before applying them', async () => {
  assert.equal(isJsonRotationFile({ name: 'rotation.json', type: '' }), true);
  assert.equal(isJsonRotationFile({ name: 'fight.zevtc', type: '' }), false);
  const bytes = zipEvtc(expandedEvtcFixture());
  const changedCalls = [];
  const originalRotation = [{ type: 'wait', durationMs: 250 }];
  const app = {
    profession: { id: 'mesmer', name: 'Mesmer' },
    adapter: { eliteSpecialization: () => 'Chronomancer' },
    build: { rotation: originalRotation },
    activeCatalog: catalog,
    changed(...args) {
      changedCalls.push(args);
    }
  };
  const imported = await previewRotationFile(
    {
      name: 'fight.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    },
    app
  );

  assert.equal(imported.description, 'Reconstructed Fixture Chronomancer (:Fixture.1234)');
  assert.equal(imported.actionCount, 1);
  assert.deepEqual(imported.rotation, [{ type: 'combat-start' }, { type: 'cast', skillId: 1_000 }]);
  assert.match(imported.warnings.join('\n'), /no matching stop event/);
  assert.equal(imported.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
  assert.strictEqual(app.build.rotation, originalRotation);
  assert.deepEqual(changedCalls, []);

  applyRotationImportPreview(app, imported);

  assert.deepEqual(app.build.rotation, imported.rotation);
  assert.notStrictEqual(app.build.rotation, imported.rotation);
  assert.deepEqual(changedCalls, [[false]]);

  const idleGapBytes = zipEvtc(expandedEvtcFixture({ secondActivation: true }));
  const idleGapImport = await readEvtcRotationFile(
    {
      name: 'idle-gap.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        idleGapBytes.buffer.slice(idleGapBytes.byteOffset, idleGapBytes.byteOffset + idleGapBytes.byteLength)
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: catalog
    }
  );

  assert.deepEqual(idleGapImport.rotation, [
    { type: 'combat-start' },
    { type: 'cast', skillId: 1_000 },
    { type: 'wait', durationMs: 1200 },
    { type: 'cast', skillId: 1_000 }
  ]);

  const interruptedBytes = zipEvtc(expandedEvtcFixture({ interruptedDamage: true }));
  const interruptedImport = await readEvtcRotationFile(
    {
      name: 'interrupted.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        interruptedBytes.buffer.slice(
          interruptedBytes.byteOffset,
          interruptedBytes.byteOffset + interruptedBytes.byteLength
        )
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: {
        skills: catalog.skills.map((skill) =>
          skill.id === 1_000
            ? {
                ...skill,
                castTimeMs: 540,
                effects: [{ type: 'strike', atMs: 350, timingAnchor: 'castStart', timingScale: 'fixed' }]
              }
            : skill
        )
      }
    }
  );

  assert.deepEqual(interruptedImport.rotation, [
    { type: 'combat-start' },
    { type: 'cast', skillId: 1_000, interruptAfterMs: 40 }
  ]);
  assert.match(interruptedImport.warnings.join('\n'), /no interruptCommitMs cutoff/);

  const zeroDurationInterruptBytes = zipEvtc(
    expandedEvtcFixture({ interruptedDamage: true, zeroDurationInterrupt: true })
  );
  for (const persistsAfterInterrupt of [true, false]) {
    const committedImport = await readEvtcRotationFile(
      {
        name: persistsAfterInterrupt ? 'committed-delayed-strike.zevtc' : 'false-cancelled-strike.zevtc',
        type: 'application/octet-stream',
        arrayBuffer: async () =>
          zeroDurationInterruptBytes.buffer.slice(
            zeroDurationInterruptBytes.byteOffset,
            zeroDurationInterruptBytes.byteOffset + zeroDurationInterruptBytes.byteLength
          )
      },
      {
        profession: { id: 'mesmer', name: 'Mesmer' },
        adapter: { eliteSpecialization: () => 'Chronomancer' },
        build: {},
        activeCatalog: {
          skills: catalog.skills.map((skill) =>
            skill.id === 1_000
              ? {
                  ...skill,
                  castTimeMs: 540,
                  interruptCommitMs: 40,
                  effects: [
                    {
                      type: 'strike',
                      atMs: 350,
                      timingAnchor: 'castStart',
                      timingScale: 'fixed',
                      ...(persistsAfterInterrupt ? { persistsAfterInterrupt: true } : {})
                    }
                  ]
                }
              : skill
          )
        }
      }
    );

    // Complete timed packets prove the zero-duration cancellation marker is false for either effect model.
    assert.deepEqual(committedImport.rotation, [{ type: 'combat-start' }, { type: 'cast', skillId: 1_000 }]);
    assert.doesNotMatch(committedImport.warnings.join('\n'), /no interruptCommitMs cutoff/);
  }

  const perPacketImport = await readEvtcRotationFile(
    {
      name: 'interrupted-channel.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        interruptedBytes.buffer.slice(
          interruptedBytes.byteOffset,
          interruptedBytes.byteOffset + interruptedBytes.byteLength
        )
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: {
        skills: catalog.skills.map((skill) =>
          skill.id === 1_000
            ? {
                ...skill,
                interruptMode: 'per-packet',
                castTimeMs: 540,
                effects: [{ type: 'strike', atMs: 350, timingAnchor: 'castStart', timingScale: 'fixed' }]
              }
            : skill
        )
      }
    }
  );

  assert.doesNotMatch(perPacketImport.warnings.join('\n'), /no interruptCommitMs cutoff/);
});

test('every profession page exposes JSON and EVTC rotation files', async () => {
  const pages = [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ];

  for (const page of pages) {
    const html = await readFile(new URL(`../../../../../../dist/site/${page}.html`, import.meta.url), 'utf8');

    assert.match(
      html,
      /id="rotation-file-input"\s+accept="\.json,\.evtc,\.evtc\.zip,\.zevtc,application\/json,application\/zip"/,
      page
    );
  }
});
