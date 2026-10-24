import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';

/** A clipped teleport and a complete two-part opener must enter combat on the same owned impact. */
function hazeOpener({ launch = false, hitSource = PLAYER, combatAt = 1203 } = {}) {
  return log({
    agents: [{ ...log().agents[0], profession: 9, elite: 79 }],
    skills: [
      { id: 77141, name: 'Beguiling Haze' },
      { id: 77047, name: 'Beguiling Haze' }
    ],
    events: [
      ...(launch
        ? [
            event({ time: 720, stateChange: 67, skillId: 77141, value: 300 }),
            event({ time: 1000, stateChange: 68, skillId: 77141, value: 280, activation: 3 }),
            event({ time: 1000, stateChange: 67, skillId: 77047, value: 300 })
          ]
        : []),
      event({ time: combatAt, stateChange: 1 }),
      event({ time: 1203, skillId: 77047, source: hitSource, target: 0x2000n, value: 1000 }),
      event({ time: 1241, stateChange: 68, skillId: 77047, value: 241, activation: 3 }),
      event({ time: 1241, stateChange: 67, skillId: 77047, value: 300 }),
      event({ time: 1441, skillId: 77047, target: 0x2000n, value: 300 }),
      event({ time: 1481, stateChange: 68, skillId: 77047, value: 240, activation: 3 })
    ].sort((left, right) => left.time - right.time)
  });
}

test('clipped Conduit openers preserve combat entry and the following Haze charge', () => {
  // Missing launch evidence changes only the replay origin; raw evidence and combat-relative hits remain intact.
  const fixture = hazeOpener();
  const imported = reconstructEvtcRotation(fixture, revenantCatalog);
  const result = runRevenant(imported.rotation, {
    specialization: 'Conduit',
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.firstHitTime, result.combatStartTime);
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === 77141);
  assert.ok(strikes.some((event) => event.name.includes('Follow-Up') && event.at > result.combatStartTime));
  for (const [index, hit] of fixture.events.filter((event) => event.stateChange === 0).entries()) {
    const replay = strikes[index];
    assert.ok(Math.abs((replay.at - result.combatStartTime) * 1000 - (hit.time - 1203)) < 20);
  }

  assert.equal(imported.sourceActions[0].startMs, 1000);
});

test('complete Haze launches and uncorroborated teleports do not receive an inferred opener', () => {
  // Other-player hits and teleports after combat entry cannot establish this player's missing opening launch.
  for (const options of [{ launch: true }, { hitSource: 0x3000n }, { combatAt: 900 }]) {
    const imported = reconstructEvtcRotation(hazeOpener(options), revenantCatalog);
    assert.equal(
      imported.combatStartTimestampMs,
      Math.max(0, (options.combatAt ?? 1203) - imported.sourceActions[0].startMs)
    );
  }
});

test('dps.report Haze imports enter combat on impact and spend both granted follow-up charges', () => {
  // Completed teleport variants must grant and consume Haze charges instead of restarting its main recharge.
  for (const completeLaunch of [false, true]) {
    const report = parseDpsReport({
      durationMS: 2000,
      players: [
        {
          name: 'Fixture Conduit',
          account: ':Fixture.1234',
          profession: 'Conduit',
          rotation: [
            ...(completeLaunch ? [{ id: 77141, skills: [{ castTime: -483, duration: 280, timeGained: 0 }] }] : []),
            {
              id: 77047,
              skills: [
                { castTime: -203, duration: 241, timeGained: 0 },
                { castTime: 38, duration: 240, timeGained: 0 },
                { castTime: 278, duration: 240, timeGained: 0 }
              ]
            }
          ]
        }
      ],
      phases: [{ start: 0, end: 2000, name: 'Full Fight', phaseType: 'Encounter' }],
      skillMap: { s77141: { name: 'Beguiling Haze' }, s77047: { name: 'Beguiling Haze' } }
    });
    const imported = reconstructDpsReportRotation(report, revenantCatalog);
    const result = runRevenant(imported.rotation, {
      specialization: 'Conduit',
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.firstHitTime, result.combatStartTime);
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === 77141);
    assert.ok(hits.some((event) => event.name.includes('Follow-Up')));
    assert.equal(observedRuntime(result).profession.specialization.state.beguilingHazeCharges, 0);
    assert.equal(imported.sourceActions.find((action) => action.rawSkillId === 77047).startMs, -203);
  }
});
