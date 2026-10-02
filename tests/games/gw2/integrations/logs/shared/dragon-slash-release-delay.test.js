import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Paired animations prove a single charge hold; replay must neither discard it nor add a second idle wait.
for (const [duration, reload, expectedDelay] of [
  [2400, false, 0],
  [2443, false, 40],
  [2484, false, 80],
  [1282, true, 80]
]) {
  test(`EVTC and report imports preserve ${duration}ms charging${reload ? ' with reload' : ''}`, () => {
    const triggerAt = reload ? 1000 : 0;
    const slashAt = triggerAt + duration;
    const actions = [
      ...(reload ? [{ id: 62901, at: 0, duration: 560 }] : []),
      { id: 62803, at: triggerAt, duration },
      { id: 62797, at: slashAt, duration: 1040 }
    ];
    const names = { 62901: 'Tactical Reload', 62803: 'Dragon Trigger', 62797: 'Dragon Slash—Force' };
    const end = slashAt + 1100;
    const report = parseDpsReport({
      durationMS: end,
      players: [
        {
          name: 'Fixture',
          account: 'Fixture.1234',
          profession: 'Bladesworn',
          rotation: actions.map((a) => ({ id: a.id, skills: [{ castTime: a.at, duration: a.duration }] }))
        }
      ],
      phases: [{ start: 0, end, name: 'Full Fight', phaseType: 'Encounter' }],
      skillMap: Object.fromEntries(Object.entries(names).map(([id, name]) => ['s' + id, { name }]))
    });
    const evtc = log({
      agents: [{ ...log().agents[0], profession: 2, elite: 68 }],
      skills: Object.entries(names).map(([id, name]) => ({ id: Number(id), name })),
      events: [
        event({ time: 1000, stateChange: 1 }),
        ...actions.flatMap((a) => [
          event({ time: 1000 + a.at, skillId: a.id, stateChange: 67, value: a.duration }),
          event({ time: 1000 + a.at + a.duration, skillId: a.id, stateChange: 68, value: a.duration, activation: 5 })
        ]),
        event({ time: 1000 + end, stateChange: 2 })
      ].sort((a, b) => a.time - b.time)
    });
    for (const imported of [
      reconstructDpsReportRotation(report, warriorCatalog),
      reconstructEvtcRotation(evtc, warriorCatalog)
    ]) {
      const command = imported.rotation.find((c) => c.skillId === 62797);
      assert.equal(command.releaseAtCharges, 10);
      assert.equal(command.releaseDelayMs ?? 0, expectedDelay);
      const result = simulateGw2({
        profession: warriorProfession,
        rotation: imported.rotation,
        config: {
          specialization: 'Bladesworn',
          initialResource: 100,
          selectedTraitIds: [],
          stats: { power: 2000, precision: 1000 },
          target: { armor: 2597 }
        }
      });
      assert.deepEqual(result.warnings, []);
      const entry = result.events.find((e) => e.reason === 'dragon trigger entry');
      const release = result.events.find((e) => e.resource === 'dragon charges' && e.reason === 'profession mechanic');
      assert.ok(Math.abs(release.at - entry.at - ((reload ? 1200 : 2400) + expectedDelay) / 1000) < 1e-9);
    }
  });
}
