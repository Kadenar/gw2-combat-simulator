import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { reconcileCastEffectPackets } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { evtcRotationProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { reconstructVindicatorActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/vindicator.js';

const action = (rawSkillId, rawName, start, end, status = 'completed') => ({
  start,
  end,
  expectedDuration: end - start,
  rawSkillId,
  rawName,
  evidence: 'animation',
  status,
  eventIndex: start
});

test('EVTC Vindicator reconstruction keeps one Dodge input and omits canceled autoattack attempts', () => {
  const profile = evtcRotationProfile('revenant', 'vindicator');
  assert.ok(profile);

  const actions = reconstructVindicatorActions({
    log: {
      header: {
        magic: 'EVTC',
        arcdpsBuild: '20260815',
        revision: 1,
        encounterId: 16199,
        agentCount: 1,
        skillCount: 3,
        eventCount: 0
      },
      agents: [],
      skills: [
        { id: 23_275, name: 'Dodge' },
        { id: 62_730, name: 'Death Drop' },
        { id: 29_057, name: 'Preparation Thrust' }
      ],
      events: []
    },
    playerAddress: 1n,
    profile,
    catalog: revenantCatalog,
    recordedActions: [
      action(23_275, 'Dodge', 1000, 1000),
      action(62_730, 'Death Drop', 1600, 1800),
      action(29_057, 'Preparation Thrust', 2000, 2040, 'interrupted')
    ],
    timelineOriginMs: 1000
  });

  assert.deepEqual(
    actions.map(({ rawSkillId, canonicalName }) => [rawSkillId, canonicalName]),
    [[62_730, 'Dodge']]
  );
});

test('EVTC preserves a cataloged aftercast cancel when every strike packet landed', () => {
  const profile = evtcRotationProfile('revenant', 'vindicator');
  assert.ok(profile);
  const chillingIsolation = {
    ...action(29_233, 'Chilling Isolation', 1000, 1483),
    expectedDuration: 1000
  };
  const directHit = (time) => ({
    time,
    source: 1n,
    target: 2n,
    value: 100,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 29_233,
    sourceInstance: 1,
    targetInstance: 2,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 1,
    buff: 0,
    result: 0,
    activation: 0,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: 0,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0
  });
  const [reconciled] = reconcileCastEffectPackets(
    {
      log: {
        header: {
          magic: 'EVTC',
          arcdpsBuild: '20260815',
          revision: 1,
          encounterId: 16199,
          agentCount: 1,
          skillCount: 1,
          eventCount: 2
        },
        agents: [],
        skills: [{ id: 29_233, name: 'Chilling Isolation' }],
        events: [directHit(1280), directHit(1480)]
      },
      playerAddress: 1n,
      profile,
      catalog: revenantCatalog,
      recordedActions: [chillingIsolation],
      timelineOriginMs: 1000
    },
    [chillingIsolation]
  );

  assert.equal(reconciled.status, 'reduced');
  assert.equal(reconciled.replayInterruptMs, 483);
  assert.equal(reconciled.replayCastEnd, undefined);
});
