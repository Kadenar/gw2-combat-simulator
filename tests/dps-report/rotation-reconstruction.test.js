import assert from 'node:assert/strict';
import test from 'node:test';

import { readDpsReportRotationData } from '#gw2/app/build/io/dps-report-rotation-import.js';
import { applyRotationImportPreview, previewDpsReportUrl } from '#gw2/app/build/io/rotation-import-dialog.js';
import { DpsReportError } from '#gw2/integrations/logs/dps-report/errors.js';
import { isDpsReportData, parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import {
  DPS_REPORT_PROFESSION_ROTATION_PARSERS,
  detectDpsReportRotationPlayers,
  getDpsReportProfessionRotationParser,
  reconstructDpsReportRotation
} from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { dpsReportId, dpsReportJsonUrl, fetchDpsReport } from '#gw2/integrations/logs/dps-report/url.js';

const skill = (id, name, extras = {}) => ({ id, name, implemented: true, ...extras });

// The fixture is intentionally minimal: it exercises report contracts without
// pinning the supplied benchmark's full rotation or aggregate report shape.
function reportFixture() {
  return {
    eliteInsightsVersion: 'fixture',
    durationMS: 3_000,
    players: [
      {
        name: 'Fixture Amalgam',
        account: 'Fixture.1234',
        profession: 'Amalgam',
        rotation: [
          { id: 5822, skills: [{ castTime: -500, duration: 600, timeGained: 0 }] },
          { id: -37, skills: [{ castTime: 600, duration: 0, timeGained: 0 }] },
          { id: 5812, skills: [{ castTime: 100, duration: 0, timeGained: 0 }] },
          {
            id: -2,
            skills: [
              { castTime: 101, duration: 0, timeGained: 0 },
              { castTime: 700, duration: 0, timeGained: 0 }
            ]
          },
          { id: 5823, skills: [{ castTime: 150, duration: 600, timeGained: 0 }] },
          { id: 77163, skills: [{ castTime: 200, duration: 0, timeGained: 0 }] },
          { id: 76693, skills: [{ castTime: 800, duration: 1_000, timeGained: 0 }] },
          { id: 77013, skills: [{ castTime: 1_800, duration: 560, timeGained: 0 }] },
          {
            id: 6154,
            skills: [
              { castTime: 2_400, duration: 400, timeGained: 0 },
              { castTime: 2_840, duration: 0, timeGained: 0 }
            ]
          },
          { id: 90_000, skills: [{ castTime: 2_850, duration: 100, timeGained: 0 }] },
          { id: 90_001, skills: [{ castTime: 2_900, duration: 100, timeGained: 0 }] }
        ]
      }
    ],
    phases: [{ start: 0, end: 3_000, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap: {
      s5822: { name: 'Galvanic Bomb' },
      's-37': { name: 'Detonate (Throw Mine / Mine Field)', isInstantCast: true, isNotAccurate: true },
      s5812: { name: 'Bomb Kit', isInstantCast: true, isNotAccurate: true },
      's-2': { name: 'Weapon Swap', isSwap: true },
      s5823: { name: 'Fire Bomb' },
      s77163: { name: 'Defensive Protocol: Thorns', isInstantCast: true },
      s76693: { name: 'Offensive Protocol: Demolish' },
      s77013: { name: 'Offensive Protocol: Demolish' },
      s6154: { name: 'Overcharged Shot', isInstantCast: true, isNotAccurate: true },
      s90000: { name: 'Unknown Channel' },
      s90001: { name: 'Automatic Proc', isTraitProc: true }
    }
  };
}

function catalogFixture() {
  return {
    skills: [
      skill(5822, 'Galvanic Bomb', { type: 'weapon', quicknessCastTimeMs: 600, kit: 'Bomb Kit' }),
      skill(5812, 'Bomb Kit', {
        type: 'utility',
        castTimeMs: 0,
        handlerId: 'engineer.kit-equip',
        kitName: 'Bomb Kit'
      }),
      skill(6111, 'Stow Bomb Kit', {
        type: 'utility',
        castTimeMs: 0,
        handlerId: 'engineer.kit-stow',
        kit: 'Bomb Kit'
      }),
      skill(6161, 'Throw Mine', { type: 'utility', quicknessCastTimeMs: 400 }),
      skill(6162, 'Detonate', { type: 'utility', castTimeMs: 0 }),
      skill(5823, 'Fire Bomb', { type: 'weapon', quicknessCastTimeMs: 600, kit: 'Bomb Kit' }),
      skill(77163, 'Defensive Protocol: Thorns', { type: 'profession', castTimeMs: 0 }),
      skill(77104, 'Defensive Protocol: Thorns', { type: 'profession', castTimeMs: 0 }),
      skill(76693, 'Offensive Protocol: Demolish', { type: 'profession', quicknessCastTimeMs: 1_560 }),
      skill(77013, 'Offensive Protocol: Demolish', { type: 'profession', quicknessCastTimeMs: 560 }),
      skill(76927, 'Offensive Protocol: Demolish', { type: 'profession', quicknessCastTimeMs: 1_560 }),
      skill(6154, 'Overcharged Shot', { type: 'weapon', quicknessCastTimeMs: 400 }),
      skill(-3, 'Swap Weapons', { type: 'action', castTimeMs: 0 })
    ]
  };
}

function appFixture() {
  return {
    profession: { id: 'engineer', name: 'Engineer' },
    adapter: {
      eliteSpecialization: () => 'Amalgam',
      simulationConfig: () => ({ selectedMorphSkillIds: [76927, 77104] })
    },
    build: {
      selectedSkills: { Utility1: 'Bomb Kit' },
      selectedMorphSkillIds: [76927, 77104]
    },
    activeCatalog: catalogFixture()
  };
}

test('validates dps.report IDs and builds the public JSON endpoint', () => {
  const id = 'fhZX-20260622-152654_golem';

  assert.equal(dpsReportId(id), id);
  assert.equal(dpsReportId(`https://b.dps.report/${id}?foo=bar`), id);
  assert.equal(dpsReportId(`https://example.com/${id}`), null);
  const endpoint = new URL(dpsReportJsonUrl(`https://dps.report/${id}`));

  assert.equal(endpoint.origin, 'https://dps.report');
  assert.equal(endpoint.pathname, '/getJson');
  assert.equal(endpoint.searchParams.get('permalink'), `https://dps.report/${id}`);
});

test('validates Elite Insights player, phase, skill, and cast contracts', () => {
  const report = parseDpsReport(JSON.stringify(reportFixture()));

  assert.equal(isDpsReportData(report), true);
  assert.equal(report.players[0].rotation[0].skills[0].castTime, -500);
  assert.throws(
    () => parseDpsReport({ players: [], phases: [], skillMap: {} }),
    (error) => error instanceof DpsReportError && error.code === 'NO_PLAYER'
  );
  const invalid = reportFixture();

  invalid.players[0].rotation[0].skills[0].duration = 'bad';
  assert.throws(
    () => parseDpsReport(invalid),
    (error) => error instanceof DpsReportError && error.code === 'INVALID_ROTATION_CAST'
  );
});

test('fetches and validates the raw Elite Insights response', async () => {
  let requested = '';
  const report = await fetchDpsReport('fhZX-20260622-152654_golem', async (input) => {
    requested = String(input);

    return new Response(JSON.stringify(reportFixture()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  assert.match(requested, /^https:\/\/dps\.report\/getJson\?/);
  assert.equal(report.players[0].profession, 'Amalgam');
});

test('registers a generic parser for every supported profession profile', () => {
  assert.equal(DPS_REPORT_PROFESSION_ROTATION_PARSERS.length, 45);
  assert.equal(new Set(DPS_REPORT_PROFESSION_ROTATION_PARSERS.map((parser) => parser.id)).size, 45);
  assert.equal(getDpsReportProfessionRotationParser('engineer', 'amalgam')?.id, 'engineer:amalgam');
});

test('reconstructs generic report casts and applies Amalgam report corrections', () => {
  const report = parseDpsReport(reportFixture());
  const players = detectDpsReportRotationPlayers(report);

  assert.deepEqual(
    players.map((player) => [player.professionId, player.specializationId]),
    [['engineer', 'amalgam']]
  );
  const result = reconstructDpsReportRotation(report, catalogFixture(), {
    selectedSkillIds: [76927, 77104]
  });

  assert.equal(result.combatStartTimestampMs, 900);
  assert.deepEqual(result.rotation.slice(0, 4), [
    { name: 'Throw Mine', skillId: 6161 },
    { name: '__wait', waitMs: 5_000 },
    { name: 'Bomb Kit', skillId: 5812 },
    { name: 'Galvanic Bomb', skillId: 5822 }
  ]);
  assert.equal(
    result.actions.some((action) => action.name === 'Throw Mine' && action.inferred),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Bomb Kit' && action.inferred),
    true
  );
  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Offensive Protocol: Demolish')
      .map((action) => [action.skillId, action.durationMs]),
    [[76927, 1_560]]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Overcharged Shot').length, 1);
  assert.equal(
    result.actions.some((action) => action.name === 'Stow Bomb Kit'),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Automatic Proc'),
    false
  );
  assert.equal(
    result.rotation.some((command) => command.name === '__wait' && command.waitMs === 100),
    true
  );
  assert.deepEqual(
    result.rotation.find((command) => command.name === '__combat_start'),
    { name: '__combat_start', offset: 500 }
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Throw Mine.*Bomb Kit/);
  assert.doesNotMatch(result.warnings.join('\n'), /duplicate instant|automatic trait|potentially incomplete/);
});

test('drops canceled Engineer autoattack rows while retaining committed shortened casts', () => {
  const fixture = reportFixture();
  fixture.players[0].rotation.push(
    {
      id: 5827,
      skills: [
        { castTime: 1_000, duration: 237, timeGained: -283 },
        { castTime: 1_400, duration: 351, timeGained: 169 }
      ]
    },
    {
      id: 5928,
      skills: [
        { castTime: 2_000, duration: 77, timeGained: -1_636 },
        { castTime: 2_100, duration: 397, timeGained: 1_316 }
      ]
    },
    { id: 5842, skills: [{ castTime: 2_600, duration: 84, timeGained: -416 }] }
  );
  Object.assign(fixture.skillMap, {
    s5827: { name: 'Fragmentation Shot', autoAttack: true },
    s5928: { name: 'Flame Jet', autoAttack: true },
    s5842: { name: 'Bomb', autoAttack: true }
  });
  const catalog = catalogFixture();
  catalog.skills.push(
    skill(5827, 'Fragmentation Shot', {
      type: 'weapon',
      quicknessCastTimeMs: 520,
      effects: [{ type: 'strike', atMs: 400, interruptCommitMs: 360 }]
    }),
    skill(5928, 'Flame Jet', {
      type: 'weapon',
      castTimeMs: 2_570,
      effects: [{ type: 'strike', atMs: 172 }]
    }),
    skill(5842, 'Bomb', { type: 'weapon', castTimeMs: 500, interruptCommitMs: 0 })
  );

  const result = reconstructDpsReportRotation(parseDpsReport(fixture), catalog, {
    selectedSkillIds: [76927, 77104]
  });

  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Fragmentation Shot' || action.name === 'Flame Jet')
      .map((action) => [action.name, action.durationMs]),
    [
      ['Fragmentation Shot', 351],
      ['Flame Jet', 397]
    ]
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Bomb'),
    false
  );
});

test('drops inaccurate Engineer toolbelt rows that the active build cannot equip', () => {
  const fixture = reportFixture();
  fixture.players[0].rotation.push({ id: 76613, skills: [{ castTime: 2_700, duration: 0, timeGained: 0 }] });
  fixture.skillMap.s76613 = {
    name: 'Symbiotic Shielding',
    isInstantCast: true,
    isNotAccurate: true
  };
  const catalog = catalogFixture();
  catalog.skills.push(
    skill(76613, 'Symbiotic Shielding', {
      type: 'profession',
      castTimeMs: 0,
      toolbeltParentName: 'Mitotic State'
    })
  );

  const result = reconstructDpsReportRotation(parseDpsReport(fixture), catalog, {
    selectedSkillIds: [76927, 77104],
    selectedSkillNames: ['Bomb Kit', 'Flamethrower', 'Plasmatic State']
  });

  assert.equal(
    result.actions.some((action) => action.name === 'Symbiotic Shielding'),
    false
  );
});

test('keeps Vent Exhaust trait-proc rows out of Engineer rotations without relying on EI metadata', () => {
  const fixture = reportFixture();
  fixture.players[0].rotation.push({ id: 43630, skills: [{ castTime: 2_750, duration: 0, timeGained: 0 }] });
  fixture.skillMap.s43630 = { name: 'Vent Exhaust', isInstantCast: true };
  const catalog = catalogFixture();
  catalog.skills.push(skill(43630, 'Vent Exhaust', { type: 'profession', castTimeMs: 0 }));

  const result = reconstructDpsReportRotation(parseDpsReport(fixture), catalog, {
    selectedSkillIds: [76927, 77104]
  });

  assert.equal(
    result.actions.some((action) => action.name === 'Vent Exhaust'),
    false
  );
  assert.equal(
    result.rotation.some((command) => command.name === 'Vent Exhaust'),
    false
  );
});

test('the app importer previews fetched dps.report data before applying it', async () => {
  const imported = await readDpsReportRotationData(reportFixture(), appFixture());

  assert.equal(imported.playerLabel, 'Fixture Amalgam (Fixture.1234)');
  assert.equal(imported.phaseLabel, 'Full Fight');
  assert.equal(
    imported.rotation.some((command) => command.type === 'cast' && command.skillId === 6111),
    true
  );

  const app = appFixture();
  const changedCalls = [];
  const originalRotation = [{ type: 'wait', durationMs: 250 }];

  app.build.rotation = originalRotation;
  app.changed = (...args) => changedCalls.push(args);
  const preview = await previewDpsReportUrl(
    'fhZX-20260622-152654_golem',
    app,
    async () => new Response(JSON.stringify(reportFixture()), { status: 200 })
  );

  assert.deepEqual(preview.rotation, imported.rotation);
  assert.strictEqual(app.build.rotation, originalRotation);
  assert.deepEqual(changedCalls, []);

  applyRotationImportPreview(app, preview);

  assert.deepEqual(app.build.rotation, imported.rotation);
  assert.notStrictEqual(app.build.rotation, preview.rotation);
  assert.deepEqual(changedCalls, [[false]]);
});
