import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/lib/rotation/model.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/build/io/evtc-rotation-import.js';
import { applyRotationImportPreview, previewRotationFile } from '#gw2/app/build/io/rotation-import-dialog.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { detectEvtcRotationPlayers, reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { event, expandedEvtcFixture, log } from '../helpers/evtc-fixture.js';

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
                quicknessCastTimeMs: 540,
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
                quicknessCastTimeMs: 540,
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
    const html = await readFile(new URL(`../../dist/site/${page}.html`, import.meta.url), 'utf8');

    assert.match(
      html,
      /id="rotation-file-input"\s+accept="\.json,\.evtc,\.evtc\.zip,\.zevtc,application\/json,application\/zip"/,
      page
    );
  }
});
