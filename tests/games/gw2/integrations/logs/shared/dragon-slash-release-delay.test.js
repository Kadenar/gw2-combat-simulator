import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';

// Paired animations prove a single charge hold; replay must neither discard it nor add a second idle wait.
for (const [duration, reload, daringDragon, expectedDelay] of [
  [2400, false, false, 0],
  [2443, false, false, 40],
  [2484, false, false, 80],
  [1282, true, false, 80],
  [1160, false, true, 0],
  [1203, false, true, 40],
  [680, true, true, 0],
  [723, true, true, 40],
  [840, true, true, 160]
]) {
  test(`EVTC and report imports preserve ${duration}ms charging${reload ? ' with reload' : ''}${daringDragon ? ' with Daring Dragon' : ''}`, () => {
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
    const selectedTraitIds = daringDragon ? [TRAIT.DARING_DRAGON] : [];
    const options = { professionConfig: { selectedTraitIds } };
    for (const imported of [
      reconstructDpsReportRotation(report, warriorCatalog, options),
      reconstructEvtcRotation(evtc, warriorCatalog, options)
    ]) {
      const command = imported.rotation.find((c) => c.skillId === 62797);
      assert.equal(command.releaseAtCharges, daringDragon ? 5 : 10);
      assert.equal(command.releaseDelayMs ?? 0, expectedDelay);
      const result = simulateGw2({
        profession: warriorProfession,
        rotation: imported.rotation,
        config: {
          specialization: 'Bladesworn',
          initialResource: 100,
          selectedTraitIds,
          attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
          target: { armor: 2597 }
        }
      });
      assert.deepEqual(result.warnings, []);
      const entry = result.events.find((e) => e.reason === 'dragon trigger entry');
      const release = result.events.find((e) => e.resource === 'dragon charges' && e.reason === 'profession mechanic');
      // Replaying the imported hold preserves the observed release while spending only the charge conversion cost.
      const chargeMs = daringDragon ? (reload ? 680 : 1160) : reload ? 1200 : 2400;
      assert.ok(Math.abs(release.at - entry.at - (chargeMs + expectedDelay) / 1000) < 1e-9);
      assert.equal(release.chargesReached, daringDragon ? 5 : 10);
      assert.equal(release.flowSpent, daringDragon ? (reload ? 20 : 40) : reload ? 20 : 45);
    }
  });
}
