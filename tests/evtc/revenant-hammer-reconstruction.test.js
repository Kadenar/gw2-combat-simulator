import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';

// Keep these fixtures limited to missing precast and upkeep transitions, independently of any saved rotation.
function renegadeLog(events) {
  return log({
    agents: [{ ...log().agents[0], profession: 9, elite: 63 }],
    skills: [
      { id: 28110, name: 'Drop the Hammer' },
      { id: 27581, name: 'Impossible Odds' },
      { id: 44272, name: 'Legendary Renegade Stance' }
    ],
    events
  });
}

test('recovers a delayed opening hammer once, using the catalog impact offset', () => {
  for (const recorded of [false, true]) {
    const fixture = renegadeLog([
      ...(recorded
        ? [
            event({ time: 1861, skillId: 28110, stateChange: 67, value: 680 }),
            event({ time: 2341, skillId: 28110, stateChange: 68, activation: 3, value: 480 })
          ]
        : []),
      event({ time: 3000, stateChange: 1 }),
      event({ time: 3500, skillId: 28110, value: 100 })
    ]);
    const result = reconstructEvtcRotation(fixture, revenantCatalog);
    const hammers = result.actions.filter((action) => action.skillId === 28110);
    assert.equal(hammers.length, 1);
    assert.equal(hammers[0].durationMs, 480);
    assert.equal(hammers[0].evidence, recorded ? 'animation' : 'initial-state');
    assert.ok(hammers[0].timestampMs < result.combatStartTimestampMs);
  }

  assert.throws(
    () =>
      reconstructEvtcRotation(
        renegadeLog([event({ time: 3000, stateChange: 1 }), event({ time: 6000, skillId: 28110, value: 100 })]),
        revenantCatalog
      ),
    { code: 'NO_ROTATION_ACTIONS' }
  );
});

test('infers manual upkeep release only when restart timing rules out starvation and legend swap', () => {
  for (const stateChange of [0, 69]) {
    for (const [restartAt, swap, expected] of [
      [4500, false, true],
      [7000, false, false],
      [4500, true, false]
    ]) {
      const fixture = renegadeLog([
        event({ time: 1000, stateChange: 1 }),
        event({ time: 1500, target: PLAYER, skillId: 27581, buff: 1, value: 10000, stateChange }),
        event({
          time: 3000,
          target: PLAYER,
          skillId: 27581,
          buff: 1,
          buffRemove: 1,
          stateChange: stateChange === 0 ? 0 : 72
        }),
        ...(swap ? [event({ time: 3000, target: PLAYER, skillId: 44272, buff: 1, value: 10000, stateChange })] : []),
        event({ time: restartAt, target: PLAYER, skillId: 27581, buff: 1, value: 10000, stateChange })
      ]);
      // Array-only catalogs are supported by import callers as well as the indexed application catalog.
      const result = reconstructEvtcRotation(fixture, { skills: revenantCatalog.skills });
      assert.equal(
        result.rotation.some((command) => command.skillId === 28382),
        expected
      );
    }
  }
});

test('warband effect GUIDs recover enhanced inputs and suppress normal-cast and actor duplicates', () => {
  for (const [guid, skillId, actorSkillId, name, species] of [
    ['72FC15613B4B2C44A1906617998859F9', 45686, 72365, "Breakrazor's Bastion", 18806],
    ['71B04F91F9B3DF4A8954059FCFAD630E', 42949, 72370, "Razorclaw's Rage", 18791],
    ['C8FDB04E59C1034CABEFBECE470AA1BC', 41220, 72360, "Darkrazor's Daring", 18594],
    ['E725FC2FD486A84EBEAC403DB4DA30DE', 40485, 72353, "Icerazor's Ire", 18524]
  ]) {
    for (const recorded of [false, true]) {
      const bytes = Buffer.from(guid, 'hex');
      const actor = 0x3000n;
      const base = renegadeLog([]);
      // An effect midway through a normal cast is not a second, enhanced activation.
      const fixture = {
        ...base,
        agents: [...base.agents, { ...base.agents[0], address: actor, profession: species, elite: 0xffffffff }],
        skills: [...base.skills, { id: skillId, name }, { id: actorSkillId, name }, { id: 28549, name: 'Hammer Bolt' }],
        events: [
          event({
            time: 0,
            source: bytes.readBigUInt64LE(0),
            target: bytes.readBigUInt64LE(8),
            skillId: 123,
            stateChange: 46
          }),
          event({ time: 1000, stateChange: 1 }),
          ...(recorded ? [event({ time: 1600, skillId, value: 800, stateChange: 67 })] : []),
          event({ time: 1800, source: 0x4000n, skillId: 123, stateChange: 60 }),
          event({ time: 2000, skillId: 123, stateChange: 60 }),
          event({ time: 2020, skillId: 123, stateChange: 60 }),
          event({
            time: 2250,
            source: actor,
            sourceInstance: 24,
            sourceMasterInstance: 1,
            skillId: actorSkillId,
            stateChange: 67
          }),
          ...(recorded
            ? [event({ time: 2400, skillId, value: 800, activation: 3, stateChange: 68 })]
            : [
                event({ time: 2080, skillId: 28549, value: 560, stateChange: 67 }),
                event({ time: 2640, skillId: 28549, value: 560, activation: 3, stateChange: 68 })
              ])
        ]
      };
      const result = reconstructEvtcRotation(fixture, revenantCatalog);
      const casts = result.actions.filter((action) => action.skillId === skillId);
      assert.equal(casts.length, 1, name);
      assert.equal(casts[0].evidence, recorded ? 'animation' : 'effect', name);
      assert.equal(casts[0].timestampMs, recorded ? 600 : 1000, name);
      if (!recorded) {
        assert.equal(casts[0].durationMs, 0, name);
        // The enhanced input must not consume the following gap using its base skill's cast duration.
        const followup = result.rotation.findIndex((command) => command.skillId === 28549);
        assert.deepEqual(result.rotation[followup - 1], { name: '__wait', waitMs: 80 });
      }
    }
  }
});
