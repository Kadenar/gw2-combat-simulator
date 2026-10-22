import assert from 'node:assert/strict';
import test from 'node:test';
import { evtcReconstructionContext } from '#tests/helpers/evtc-reconstruction-context.js';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { warriorCatalog } from '#gw2/professions/warrior/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

// Keep these finder checks independent of simulator loadouts: only recorded buff evidence identifies the cast.
function find(profession, specialization, modern, events) {
  const fixture = log({ events });
  fixture.header.arcdpsBuild = modern ? '20260501' : '20260430';
  return eiInstantActions(
    evtcReconstructionContext({
      profile: ROTATION_PROFILES.find((p) => p.professionId === profession && p.specializationId === specialization),
      playerAddress: PLAYER,
      log: fixture,
      catalog: null,
      recordedActions: []
    })
  );
}

function apply(modern, skillId, value, overrides = {}) {
  return event({ time: 100, stateChange: modern ? 69 : 0, buff: 1, target: PLAYER, skillId, value, ...overrides });
}

test('Scourge F5 finders distinguish the shared buff by applied duration and reject incomplete evidence', () => {
  for (const modern of [false, true]) {
    const shrouds = (events, specialization = 'scourge') =>
      find('necromancer', specialization, modern, events).filter((action) =>
        [44663, 54870].includes(action.rawSkillId)
      );
    for (const [skillId, duration, rule] of [
      [44663, 6000, 'DesertShroud'],
      [54870, 3500, 'SandstormShroudSkill']
    ]) {
      for (const delta of [-10, -9, 0, 9, 10]) {
        const actions = shrouds([apply(modern, 40052, duration + delta)]);
        assert.equal(actions.length, Math.abs(delta) < 10 ? 1 : 0, `${skillId}: duration offset ${delta}`);

        if (!actions.length) continue;

        const [cast] = actions;
        assert.equal(cast.rawSkillId, skillId);
        assert.equal(cast.evidence, 'buff-transition');
        assert.equal(cast.castOrigin, 'skill');
        assert.equal(cast.metadataAccurate, true);
        assert.equal(cast.eiRule, `ScourgeHelper.BuffGainCastFinder(${rule})`);
      }

      for (const overrides of [
        { stateChange: 18 },
        modern ? { stateChange: 70 } : { offcycle: 1 },
        modern ? { stateChange: 72 } : { buffRemove: 1 },
        { target: 0x9999n }
      ]) {
        assert.deepEqual(shrouds([apply(modern, 40052, duration, overrides)]), []);
      }

      assert.deepEqual(shrouds([apply(modern, 40052, duration)], 'reaper'), []);
    }

    assert.deepEqual(shrouds([apply(modern, 40052, 1000)]), []);
  }
});

test('Flow Stabilizer requires exactly two nearby self-applied eight-second Positive Flow grants', () => {
  for (const modern of [false, true]) {
    const flow = (events, specialization = 'bladesworn') =>
      find('warrior', specialization, modern, events).filter((action) => action.rawSkillId === 62967);
    const grant = apply(modern, 62836, 8000);
    const second = { ...grant, time: 109, value: 8009 };
    const [cast, duplicate] = flow([second, grant]);
    assert.ok(cast);
    assert.equal(duplicate, undefined, 'the two qualifying grants identify one activation');
    assert.equal(cast.start, grant.time, 'the first qualifying application owns the inferred cast');
    assert.equal(cast.evidence, 'buff-transition');
    assert.equal(cast.castOrigin, 'skill');
    assert.equal(cast.metadataAccurate, true);
    assert.equal(cast.eiRule, 'BladeswornHelper.BuffGainCastFinder(FlowStabilizer)');

    for (const events of [
      [grant],
      [grant, grant, grant],
      [grant, { ...second, value: 7990 }],
      [grant, { ...second, value: 8010 }],
      [grant, { ...second, time: 110 }],
      [grant, { ...second, source: 0x9999n }],
      [grant, { ...second, target: 0x9999n }],
      [grant, { ...second, ...(modern ? { stateChange: 70 } : { offcycle: 1 }) }],
      [
        { ...grant, stateChange: 18 },
        { ...second, stateChange: 18 }
      ]
    ]) {
      assert.deepEqual(flow(events), []);
    }

    assert.deepEqual(flow([grant, second], 'core'), []);
    assert.equal(flow([grant, second, { ...grant, value: 15000 }]).length, 1, 'other Flow durations do not count');

    // EI includes initial BuffApplyEvents in the corroborating count, but they cannot supply the cast itself.
    const [corroborated] = flow([{ ...grant, stateChange: 18 }, second]);
    assert.equal(corroborated.start, second.time);
  }
});

test('duration-qualified buff finders preserve EI sliding duplicate suppression after evidence checks', () => {
  for (const modern of [false, true]) {
    const scourgeEvents = [100, 140, 180, 240].map((time) => apply(modern, 40052, 6000, { time }));
    const scourge = find('necromancer', 'scourge', modern, scourgeEvents);
    assert.deepEqual(
      scourge.map((action) => action.start),
      [100, 240]
    );

    const warriorEvents = [100, 140, 180, 240].flatMap((time) => [
      apply(modern, 62836, 8000, { time }),
      apply(modern, 62836, 8000, { time })
    ]);
    const warrior = find('warrior', 'bladesworn', modern, warriorEvents);
    assert.deepEqual(
      warrior.map((action) => action.start),
      [100, 240]
    );
  }
});

test('new buff finders reach EVTC replay as the represented skill without a recorded animation', () => {
  for (const [profession, elite, catalog, skillId, evidence] of [
    [8, 60, necromancerCatalog, 44663, [apply(true, 40052, 6000)]],
    [8, 60, necromancerCatalog, 54870, [apply(true, 40052, 3500)]],
    [2, 68, warriorCatalog, 62967, [apply(true, 62836, 8000), apply(true, 62836, 8000)]]
  ]) {
    const fixture = log({
      agents: [{ ...log().agents[0], profession, elite }],
      events: [event({ time: 0, stateChange: 1 }), ...evidence, event({ time: 1000, stateChange: 2 })]
    });
    const imported = reconstructEvtcRotation(fixture, catalog);
    const action = imported.actions.find((candidate) => candidate.rawSkillId === skillId);
    assert.ok(action, `missing inferred action ${skillId}`);
    assert.equal(action.skillId, skillId);
    assert.ok(imported.rotation.some((command) => command.type === 'cast' && command.skillId === skillId));
  }
});
