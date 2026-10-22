import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareEvtcEvidence } from '#gw2/integrations/logs/evtc/rotation/evidence.js';
import { detectEvtcRotationPlayers } from '#gw2/integrations/logs/evtc/rotation/players.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/reconstruct.js';
import { eiCustomAnimatedActions } from '#gw2/integrations/logs/evtc/rotation/ei-custom-casts.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

// Observe builder-specific reads so every finder in a real reconstruction must reuse the same indexes.
// These counters assume only the builders read these fields on these two events; revisit them if another consumer does.
test('Chronomancer reconstruction builds ownership and effect evidence once', () => {
  let ownershipReads = 0;
  let effectReads = 0;
  const entry = event({ time: 0, stateChange: 1 });
  const mapping = event({ stateChange: 46, skillId: 77, source: 1n, target: 2n, sourceInstance: 0 });
  Object.defineProperty(entry, 'sourceMasterInstance', {
    get() {
      ownershipReads++;
      return 0;
    }
  });
  Object.defineProperty(mapping, 'overstackValue', {
    get() {
      effectReads++;
      return 0;
    }
  });
  const fixture = log({
    events: [
      entry,
      mapping,
      event({ time: 100, stateChange: 67, skillId: 1000, value: 100 }),
      event({ time: 200, stateChange: 68, skillId: 1000, value: 100, activation: 5 })
    ]
  });
  reconstructEvtcRotation(fixture);
  assert.equal(ownershipReads, 1);
  assert.equal(effectReads, 1);
});

// Animation reuse includes empty results and other players, while each log owns an independent cache.
test('evidence reuses decoded players and lazily caches other actors in both encodings', () => {
  for (const modern of [false, true]) {
    const other = 0x2000n;
    const pet = 0x3000n;
    const fixture = log({
      header: { ...log().header, arcdpsBuild: modern ? '20260815' : '20260429' },
      agents: [
        ...log().agents,
        { ...log().agents[0], address: other },
        { ...log().agents[0], address: pet, elite: 0xffffffff }
      ],
      events: [
        event({ time: 0, stateChange: 1 }),
        ...[PLAYER, other, pet].flatMap((source) => [
          event({
            time: 100,
            source,
            skillId: 1000,
            value: 100,
            stateChange: modern ? 67 : 0,
            activation: modern ? 0 : 1
          }),
          event({ time: 200, source, skillId: 1000, value: 100, stateChange: modern ? 68 : 0, activation: 5 })
        ])
      ].sort((a, b) => a.time - b.time)
    });
    const players = detectEvtcRotationPlayers(fixture);
    const evidence = prepareEvtcEvidence(fixture, players);
    for (const player of players) {
      assert.equal(evidence.animationsFor(player.agent.address), player.castActions);
    }

    const petActions = evidence.animationsFor(pet);
    assert.ok(petActions.some((action) => action.rawSkillId === 1000));
    assert.equal(evidence.animationsFor(pet), petActions);
    assert.deepEqual(evidence.animationsFor(0x9999n), []);
    assert.equal(evidence.animationsFor(0x9999n), evidence.animationsFor(0x9999n));
    assert.deepEqual(prepareEvtcEvidence(log()).animationsFor(pet), []);
  }
});

// Unmapped effects still disable fallback rules; a missing GUID must not erase raw effect presence.
test('raw effect presence is independent of resolved GUID evidence', () => {
  const evidence = prepareEvtcEvidence(log({ events: [event({ stateChange: 62, skillId: 77 })] }));
  assert.equal(evidence.hasEffects, true);
  assert.deepEqual(evidence.effects, []);
});

// Custom casts are suppressed by relevant animations from any actor, including another cached player.
test('custom animation suppression retains other actors when sharing player evidence', () => {
  const other = 0x2000n;
  const fixture = log({
    agents: [...log().agents, { ...log().agents[0], address: other }],
    events: [
      event({ time: 0, stateChange: 1 }),
      event({ time: 100, stateChange: 67, source: other, skillId: 62603, value: 100 }),
      event({ time: 200, stateChange: 68, source: other, skillId: 62603, value: 100, activation: 5 }),
      event({ time: 300, stateChange: 69, target: PLAYER, skillId: 62632, value: 500 })
    ]
  });
  const evidence = prepareEvtcEvidence(fixture, detectEvtcRotationPlayers(fixture));
  const context = {
    log: fixture,
    evidence,
    profile: { professionId: 'guardian', specializationId: 'willbender' },
    playerAddress: PLAYER,
    catalog: null,
    recordedActions: []
  };
  assert.deepEqual(eiCustomAnimatedActions(context), []);
  const withoutAnimation = log({ events: fixture.events.filter((event) => event.source !== other) });
  assert.ok(
    eiCustomAnimatedActions({
      ...context,
      log: withoutAnimation,
      evidence: prepareEvtcEvidence(withoutAnimation)
    }).some((action) => action.rawSkillId === 62603)
  );
});
