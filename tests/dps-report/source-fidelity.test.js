import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { readDpsReportRotationData, readDpsReportRotationUrl } from '#gw2/app/build/io/dps-report-rotation-import.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/lib/rotation/model.js';
import { previewRotationFile } from '#gw2/app/build/io/rotation-import-dialog.js';

function report(rotation, skillMap, profession = 'Luminary') {
  return {
    players: [{ name: 'Fixture', profession, rotation }],
    skillMap,
    phases: [
      { start: 0, end: 4000, name: 'Full fight' },
      { start: 1000, end: 2000, name: 'Selected phase' }
    ]
  };
}

test('native saved rotations keep their manual preparation without receiving the log opener notice', async (t) => {
  const previousReader = globalThis.FileReader;
  t.after(() => {
    if (previousReader) globalThis.FileReader = previousReader;
    else delete globalThis.FileReader;
  });
  // Supply only the browser file-read boundary; exercise the real JSON preview and command validation.
  globalThis.FileReader = class {
    async readAsText(file) {
      this.result = await file.text();
      this.onload();
    }
  };
  const rotation = [{ name: 'Enter Radiant Forge', skillId: 77073 }];
  const preview = await previewRotationFile(
    { name: 'manual.json', type: 'application/json', text: async () => JSON.stringify(rotation) },
    { activeCatalog: guardianCatalog }
  );
  assert.equal(preview.rotation[0].skillId, 77073);
  assert.deepEqual(preview.warnings, []);
});

// The source clock and supplied inputs remain authoritative through normalization and app conversion.
test('Luminary preserves supplied Forge entries and exits, including inaccurate EI rows', async () => {
  const input = report(
    [
      { id: 76708, skills: [{ castTime: 0, duration: 500 }] },
      { id: 76616, skills: [{ castTime: 700, duration: 0 }] },
      { id: 77073, skills: [{ castTime: 1000, duration: 0 }] }
    ],
    {
      s76708: { name: 'Luminous Staff' },
      s76616: { name: 'Exit Radiant Forge' },
      s77073: { name: 'Enter Radiant Forge', isNotAccurate: true }
    }
  );
  const out = reconstructDpsReportRotation(input, guardianCatalog);
  assert.deepEqual(
    out.sourceActions.filter((a) => [77073, 76616].includes(a.rawSkillId)).map((a) => [a.rawSkillId, a.startMs]),
    [
      [76616, 700],
      [77073, 1000]
    ]
  );
  assert.equal(out.actions.find((a) => a.rawSkillId === 77073).metadataAccurate, false);
  assert.equal(out.rotation.filter((c) => c.skillId === 77073).length, 1);
  const app = {
    profession: { id: 'guardian', name: 'Guardian' },
    adapter: { eliteSpecialization: () => 'Luminary' },
    build: {},
    activeCatalog: guardianCatalog
  };
  for (const imported of [
    await readDpsReportRotationData(input, app),
    await readDpsReportRotationUrl('https://dps.report/fixture_golem', app, async () => ({
      ok: true,
      json: async () => input
    }))
  ]) {
    assert.equal(imported.rotation.filter((c) => c.skillId === 77073).length, 1);
    assert.equal(imported.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
  }
});

test('Luminary removes represented Forge bar changes without dropping standalone weapon swaps', () => {
  const input = report(
    [
      { id: 77073, skills: [{ castTime: 100, duration: 0 }] },
      {
        id: -2,
        skills: [
          { castTime: 101, duration: 0 },
          { castTime: 1000, duration: 0 }
        ]
      }
    ],
    { s77073: { name: 'Enter Radiant Forge' }, 's-2': { name: 'Weapon Swap', isSwap: true } }
  );
  const out = reconstructDpsReportRotation(input, guardianCatalog);
  assert.equal(out.sourceActions.length, 3);
  assert.deepEqual(
    out.actions.filter((a) => a.kind === 'weapon-swap').map((a) => a.timestampMs),
    [1000]
  );
  assert.equal(out.rotation.filter((c) => c.skillId === 77073).length, 1);
});

test('phase selection preserves crossing timestamps and durations and excludes casts wholly outside the phase', () => {
  const input = report(
    [
      {
        id: 1000,
        skills: [
          { castTime: -200, duration: 400 },
          { castTime: 600, duration: 300 },
          { castTime: 800, duration: 400 },
          { castTime: 2100, duration: 400 }
        ]
      }
    ],
    { s1000: { name: 'Observed' } },
    'Chronomancer'
  );
  const catalog = { skills: [{ id: 1000, name: 'Observed', castTimeMs: 400, effects: [] }] };
  const full = reconstructDpsReportRotation(input, catalog);
  assert.deepEqual([full.sourceActions[0].startMs, full.sourceActions[0].durationMs], [-200, 400]);
  const selected = reconstructDpsReportRotation(input, catalog, { phaseIndex: 1 });
  assert.deepEqual(
    selected.sourceActions.map((a) => [a.startMs, a.durationMs]),
    [[800, 400]]
  );
  assert.equal(selected.timelineOriginMs, 800);
  assert.equal(selected.combatStartTimestampMs, 200);
});

test('aggregate packets and later dependencies cannot add opener or mid-rotation setup', () => {
  const input = report(
    [
      {
        id: 76708,
        skills: [
          { castTime: 100, duration: 500 },
          { castTime: 2100, duration: 500 }
        ]
      }
    ],
    { s76708: { name: 'Luminous Staff' }, s77073: { name: 'Enter Radiant Forge' } }
  );
  input.players[0].targetDamageDist = [[[{ id: 77073, connectedHits: 99, hits: 99 }]]];
  input.players[0].buffUptimes = [{ id: 77142, buffData: [{ uptime: 100 }] }];
  const before = structuredClone(input);
  const out = reconstructDpsReportRotation(input, guardianCatalog);
  assert.deepEqual(input, before);
  assert.equal(
    out.rotation.some((c) => c.skillId === 77073),
    false
  );
  assert.equal(out.warnings.filter((w) => w === LOG_OPENER_WARNING).length, 1);
  assert.equal(
    out.warnings.some((w) => w.includes('Recovered setup')),
    false
  );
});

test('report chronology retains same-skill duplicates and stable exported traversal order for ties', () => {
  const input = report(
    [
      {
        id: 1000,
        skills: [
          { castTime: 100, duration: 0 },
          { castTime: 120, duration: 0 }
        ]
      },
      { id: 2000, skills: [{ castTime: 100, duration: 0 }] }
    ],
    { s1000: { name: 'First' }, s2000: { name: 'Second' } },
    'Chronomancer'
  );
  const catalog = {
    skills: [
      { id: 1000, name: 'First', castTimeMs: 0 },
      { id: 2000, name: 'Second', castTimeMs: 0 }
    ]
  };
  const out = reconstructDpsReportRotation(input, catalog);
  assert.deepEqual(
    out.sourceActions.map((a) => [a.rawSkillId, a.startMs]),
    [
      [1000, 100],
      [2000, 100],
      [1000, 120]
    ]
  );
});
