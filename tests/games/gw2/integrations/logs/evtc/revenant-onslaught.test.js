import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/profession.js';
import { event, log } from '#tests/helpers/evtc-fixture.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

// Both log formats must produce one usable input, including when only the hit animation was recorded.
for (const format of ['evtc', 'dps-report']) {
  for (const dashRecorded of [false, true]) {
    test(`${format} Onslaught imports own Greatsword damage and cooldown with dashRecorded=${dashRecorded}`, () => {
      const imported =
        format === 'evtc'
          ? reconstructEvtcRotation(
              log({
                agents: [{ ...log().agents[0], profession: 9, elite: 79 }],
                skills: [
                  { id: 62895, name: "Phantom's Onslaught" },
                  { id: 62713, name: "Phantom's Onslaught" }
                ],
                events: [
                  event({ time: 900, stateChange: 1 }),
                  ...(dashRecorded
                    ? [
                        event({ time: 960, stateChange: 67, skillId: 62895, value: 60 }),
                        event({ time: 1000, stateChange: 68, skillId: 62895, value: 40, activation: 3 })
                      ]
                    : []),
                  event({ time: 1000, stateChange: 67, skillId: 62713, value: 600 }),
                  event({ time: 1400, stateChange: 68, skillId: 62713, value: 400, activation: 3 })
                ]
              }),
              revenantCatalog
            )
          : reconstructDpsReportRotation(
              parseDpsReport({
                durationMS: 4000,
                players: [
                  {
                    name: 'Fixture Conduit',
                    account: ':Fixture.1234',
                    profession: 'Conduit',
                    rotation: [
                      ...(dashRecorded
                        ? [{ id: 62895, skills: [{ castTime: 960, duration: 40, timeGained: 0 }] }]
                        : []),
                      { id: 62713, skills: [{ castTime: 1000, duration: 400, timeGained: 0 }] }
                    ]
                  }
                ],
                phases: [{ start: 0, end: 4000, name: 'Full Fight', phaseType: 'Encounter' }],
                skillMap: {
                  s62895: { name: "Phantom's Onslaught" },
                  s62713: { name: "Phantom's Onslaught (Hit)" }
                }
              }),
              revenantCatalog
            );

      const inputs = imported.rotation.filter((step) => step.type === 'cast');
      assert.equal(inputs.length, 1);
      assert.equal(inputs[0].skillId, 62895);
      assert.equal(revenantCatalog.skillsById.get(62713).simulatorExcluded, true);
      const result = runRevenant(imported.rotation, {
        specialization: 'Conduit',
        primaryWeapon: 'Greatsword',
        initialEnergy: 100,
        boons: { quickness: true }
      });
      assert.deepEqual(result.warnings, []);
      const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === 62895);
      assert.ok(hit?.damage > 0);
      assert.equal(hit.weaponStrengthProfileId, 'weapon.greatsword');
      assert.ok(result.planningState.cooldowns[62895]);
      assert.equal(result.planningState.cooldowns[62713], undefined);
    });
  }
}
