import assert from 'node:assert/strict';
import test from 'node:test';

import { isDpsReportData, parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { WingmanError } from '#gw2/integrations/logs/wingman/errors.js';
import { normalizeWingmanReport } from '#gw2/integrations/logs/wingman/normalize.js';
import { fetchWingmanReport, isWingmanUrl, wingmanJsonUrl, wingmanLogId } from '#gw2/integrations/logs/wingman/url.js';

const skill = (id, name, extras = {}) => ({ id, name, ...extras });

const WINGMAN_LOG_URL =
  'https://gw2wingman.nevermindcreations.de/log/a4deb-amdmda9462_20260915-105522_StdGolem_kill';
const WINGMAN_LOG_ID = 'a4deb-amdmda9462_20260915-105522_StdGolem_kill';

// Mirrors the shape gw2wingman's /api/getJson/<id> actually returns: EI's HTML-embed format,
// where a player's rotation is bucketed one flat, phase-relative-seconds array per phase
// ([atSeconds, skillId, durationMs, statusId, quickness] tuples), and skillMap entries use EI's
// short html field names instead of dps.report's raw isXyz camelCase names.
function wingmanFixture() {
  return {
    parser: 'Elite Insights 3.29.0.0',
    fightName: 'Standard Kitty Golem',
    phases: [{ name: 'Full Fight', start: 0, end: 3 }],
    players: [
      {
        name: 'Fixture Dragonhunter',
        acc: 'Fixture.1234',
        profession: 'Dragonhunter',
        group: 1,
        details: {
          rotation: [
            [
              [0, 9081, 1480, 3, 0],
              [2, 9081, 1401, 3, 0],
              [0.5, 90001, 0, 4, 0]
            ]
          ]
        }
      }
    ],
    skillMap: {
      s9081: { name: 'Whirling Wrath', icon: 'https://render.guildwars2.com/whirling.png' },
      s90001: { name: 'Automatic Proc', traitProc: true }
    }
  };
}

test('extracts the log id from a gw2wingman link and rejects other hosts and bare ids', () => {
  assert.equal(wingmanLogId(WINGMAN_LOG_URL), WINGMAN_LOG_ID);
  assert.equal(isWingmanUrl(WINGMAN_LOG_URL), true);
  assert.equal(wingmanLogId(`https://gw2wingman.nevermindcreations.de/log/${WINGMAN_LOG_ID}?foo=bar`), WINGMAN_LOG_ID);
  assert.equal(wingmanLogId('https://dps.report/fhZX-20260622-152654_golem'), null);
  assert.equal(wingmanLogId(WINGMAN_LOG_ID), null);
  assert.equal(isWingmanUrl(WINGMAN_LOG_ID), false);

  const endpoint = new URL(wingmanJsonUrl(WINGMAN_LOG_URL));

  assert.equal(endpoint.origin, 'https://gw2wingman.nevermindcreations.de');
  assert.equal(endpoint.pathname, `/api/getJson/${WINGMAN_LOG_ID}`);
  assert.throws(
    () => wingmanJsonUrl('https://dps.report/fhZX-20260622-152654_golem'),
    (error) => error instanceof WingmanError && error.code === 'INVALID_URL'
  );
});

test('reshapes the gw2wingman html-embed payload into the validated dps.report document', () => {
  const normalized = normalizeWingmanReport(wingmanFixture());
  const report = parseDpsReport(normalized);

  assert.equal(isDpsReportData(report), true);
  assert.deepEqual(report.phases[0], { name: 'Full Fight', start: 0, end: 3_000 });

  const player = report.players[0];
  assert.equal(player.profession, 'Dragonhunter');
  const whirling = player.rotation.find((group) => group.id === 9081);

  // Seconds become milliseconds, and the phase-relative html tuples become the raw castTime/duration/timeGained shape.
  assert.deepEqual(whirling.skills, [
    { castTime: 0, duration: 1_480, timeGained: 0, quickness: 0 },
    { castTime: 2_000, duration: 1_401, timeGained: 0, quickness: 0 }
  ]);

  // skillMap's short html names (traitProc/aa/notAccurate/...) become dps.report's isXyz camelCase fields.
  assert.equal(report.skillMap.s90001.isTraitProc, true);
  assert.equal(report.skillMap.s9081.isTraitProc, false);
});

test('fetches a gw2wingman log and reconstructs it through the exact dps.report rules', async () => {
  let requested = '';
  const report = await fetchWingmanReport(WINGMAN_LOG_URL, async (input) => {
    requested = String(input);

    return new Response(JSON.stringify(wingmanFixture()), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });

  assert.equal(requested, `https://gw2wingman.nevermindcreations.de/api/getJson/${WINGMAN_LOG_ID}`);
  assert.equal(report.players[0].profession, 'Dragonhunter');

  // Same quantization the dps.report importer applies to a 1401 ms observed duration against a 1480 ms catalog cast.
  const result = reconstructDpsReportRotation(report, {
    skills: [skill(9_081, 'Whirling Wrath', { type: 'weapon', castTimeMs: 1_480, interruptMode: 'per-packet' })]
  });
  const casts = result.rotation.filter((command) => command.name === 'Whirling Wrath');

  assert.equal(casts[0].interruptMs, undefined);
  assert.equal(casts[1].interruptMs, 1_400);
  // The trait-proc entry (id 90001) is filtered out, exactly like an automatic proc from dps.report.
  assert.equal(result.rotation.some((command) => command.name === 'Automatic Proc'), false);
});

test('surfaces a gw2wingman error payload as a WingmanError', async () => {
  await assert.rejects(
    fetchWingmanReport(WINGMAN_LOG_URL, async () =>
      new Response(JSON.stringify({ error: 'Log not found' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    ),
    (error) => error instanceof WingmanError && error.code === 'REPORT_ERROR'
  );
});
