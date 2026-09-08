import assert from 'node:assert/strict';
import test from 'node:test';

import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { reconcileCastEffectPackets } from '#gw2/integrations/logs/evtc/rotation/effect-packets.js';
import { evtcRotationProfile } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { reconstructVindicatorActions } from '#gw2/integrations/logs/evtc/rotation/professions/revenant/vindicator.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { createProfessionSimulator } from '../helpers/profession-simulation.js';
import { event, log } from '../helpers/evtc-fixture.js';

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

test('Vindicator import preserves extended dodge autos and counts landing occupancy only once', () => {
  // Minimal leaps exercise damage-based recognition and scheduler timing on both weapon sets and EVTC formats.
  const simulate = createProfessionSimulator(revenantProfession, {
    selectedDodge: 'Death Drop',
    stats: {},
    boons: { quickness: true },
    target: { conditions: {} }
  });
  for (const modern of [false, true]) {
    for (const [id, name, start, duration, hitMs, weapon, offhand] of [
      [62913, 'Mist Swing', 1040, 560, 400, 'Greatsword', ''],
      [29057, 'Preparation Thrust', 1200, 400, 320, 'Sword', 'Sword']
    ]) {
      const activation = (skillId, time, begin, value = 0) =>
        event({
          skillId,
          time,
          value,
          activation: begin ? 1 : 3,
          stateChange: modern ? (begin ? 67 : 68) : 0
        });
      const fixture = log({
        agents: [{ ...log().agents[0], profession: 9, elite: 69 }],
        skills: [
          { id, name },
          { id: 23275, name: 'Dodge' },
          { id: 62730, name: 'Death Drop' }
        ],
        events: [
          activation(23275, 1000, true),
          activation(23275, 1000, false),
          activation(id, start, true, duration),
          event({ skillId: id, time: start + hitMs, value: 100 }),
          activation(id, 1600, false, duration),
          activation(62730, 1600, true, 200),
          event({ skillId: 62730, time: 1760, value: 100 }),
          activation(62730, 1800, false, 200),
          activation(id, 1800, true, 400),
          event({ skillId: id, time: 1800 + hitMs, value: 100 }),
          activation(id, 2200, false, 400)
        ]
      });
      const result = reconstructEvtcRotation(fixture, revenantCatalog, { includeCombatStart: false });
      assert.deepEqual(result.warnings, []);
      const autos = result.actions.filter((entry) => entry.name === name);
      assert.equal(autos[0].vindicatorDodgeAuto, true);
      assert.equal(autos[1].vindicatorDodgeAuto, undefined);
      const replay = simulate('Vindicator', result.rotation, { primaryWeapon: weapon, secondaryWeapon: offhand });
      assert.deepEqual(replay.warnings, []);
      const landing = replay.steps.find((step) => step.skill === 'Dodge Jump');
      assert.equal(landing.start, 0);
      assert.equal(landing.end, 800);
      assert.equal(replay.steps.find((step) => step.skill === name).start, start - 1000);
      assert.equal(
        Math.round(replay.events.find((entry) => entry.type === 'damage' && entry.name === 'Death Drop').at * 1000),
        760
      );
      assert.equal(replay.steps.filter((step) => step.skill === name)[1].start, landing.end);

      const noDamage = reconstructEvtcRotation(
        { ...fixture, events: fixture.events.filter((entry) => entry.time !== start + hitMs) },
        revenantCatalog
      );
      assert.ok(noDamage.actions.every((entry) => !entry.vindicatorDodgeAuto));
      const noDamageReplay = simulate('Vindicator', noDamage.rotation, {
        primaryWeapon: weapon,
        secondaryWeapon: offhand
      });
      assert.deepEqual(noDamageReplay.warnings, []);
      assert.equal(noDamageReplay.steps.find((step) => step.skill === name).start, start - 1000);
      const noInput = reconstructEvtcRotation(
        { ...fixture, events: fixture.events.filter((entry) => entry.skillId !== 23275) },
        revenantCatalog
      );
      assert.ok(noInput.actions.some((entry) => entry.vindicatorDodgeAuto));
      const inferredReplay = simulate('Vindicator', noInput.rotation, {
        primaryWeapon: weapon,
        secondaryWeapon: offhand
      });
      assert.equal(inferredReplay.steps.find((step) => step.skill === 'Dodge Jump').fullCastMs, 800);
    }
  }
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
    [[23_275, 'Dodge Jump']]
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
