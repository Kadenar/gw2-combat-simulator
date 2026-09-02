import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_ROTATION_PROFILES } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { selectRotationPlayer } from '#gw2/integrations/logs/lib/rotation/selection.js';
import { buildReplayTimeline } from '#gw2/integrations/logs/lib/rotation/timeline.js';

const PLAYER = 0x1000n;
const fixtureSkill = {
  id: 1_000,
  name: 'Mind Stab',
  type: 'Weapon',
  slot: 'Weapon_2',
  castTimeMs: 600,
  quicknessCastTimeMs: 400,
  effects: [],
  implemented: true
};
const catalog = { skills: [fixtureSkill] };

function evtcEvent(overrides = {}) {
  return {
    time: 1_000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 1,
    targetInstance: 0,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 0,
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
    pad: 0,
    ...overrides
  };
}

test('both adapters expose every profession from the shared profile inventory', () => {
  const identities = (profiles) => profiles.map((profile) => `${profile.professionId}:${profile.specializationId}`);

  assert.deepEqual(identities(EVTC_ROTATION_PROFILES), identities(ROTATION_PROFILES));
});

test('EVTC and dps.report produce the same replay timing for equivalent cast evidence', () => {
  const evtc = reconstructEvtcRotation(
    {
      header: {
        magic: 'EVTC',
        arcdpsBuild: '20260815',
        revision: 1,
        encounterId: 16_199,
        agentCount: 1,
        skillCount: 1,
        eventCount: 5
      },
      agents: [
        {
          address: PLAYER,
          profession: 7,
          elite: 40,
          toughness: 0,
          concentration: 0,
          healing: 0,
          condition: 0,
          character: 'Fixture Chronomancer',
          account: ':Fixture.1234',
          subgroup: '1'
        }
      ],
      skills: [{ id: 1_000, name: 'Mind Stab' }],
      events: [
        evtcEvent({ stateChange: 1 }),
        evtcEvent({ time: 1_200, stateChange: 67, skillId: 1_000, value: 600 }),
        evtcEvent({ time: 1_840, stateChange: 68, skillId: 1_000, value: 640, activation: 3 }),
        evtcEvent({ time: 1_840, stateChange: 67, skillId: 1_000, value: 600 }),
        evtcEvent({ time: 2_480, stateChange: 68, skillId: 1_000, value: 640, activation: 3 })
      ]
    },
    catalog,
    { inferInstantCasts: false }
  );
  const report = reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture Chronomancer',
          account: 'Fixture.1234',
          profession: 'Chronomancer',
          rotation: [
            {
              id: 1_000,
              skills: [
                { castTime: 1_200, duration: 640, timeGained: 0 },
                { castTime: 1_840, duration: 640, timeGained: 0 }
              ]
            }
          ]
        }
      ],
      phases: [{ start: 1_000, end: 3_000, name: 'Full Fight' }],
      skillMap: { s1000: { name: 'Mind Stab' } }
    },
    catalog
  );

  assert.equal(evtc.timelineOriginMs, report.timelineOriginMs);
  assert.equal(evtc.combatStartTimestampMs, report.combatStartTimestampMs);
  assert.deepEqual(evtc.rotation, report.rotation);
  // Both import paths preserve the observed-aftercast mismatch on 40 ms action ticks.
  assert.deepEqual(
    report.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 240, 240]
  );
});

test('the shared timeline preserves controls, unsupported durations, idle gaps, and concurrent offsets', () => {
  const instant = { ...fixtureSkill, id: 2_000, name: 'Instant', castTimeMs: 0, quicknessCastTimeMs: 0 };
  const actions = [
    { start: 0, end: 400, eventIndex: 0, skill: fixtureSkill, name: 'Mind Stab', skillId: 1_000 },
    { start: 200, end: 200, eventIndex: 1, skill: instant, name: 'Instant', skillId: 2_000 },
    { start: 800, end: 900, eventIndex: 2, skill: null, name: 'Unknown', skillId: 9_000 },
    {
      start: 1_000,
      end: 1_000,
      eventIndex: 3,
      skill: null,
      name: 'Reset',
      skillId: -1,
      control: 'cooldown-reset'
    }
  ];

  assert.deepEqual(buildReplayTimeline(actions, 0, 100, { commandFor: ({ name, skillId }) => ({ name, skillId }) }), [
    { name: 'Mind Stab', skillId: 1_000 },
    { name: '__combat_start', offset: 100 },
    { name: 'Instant', skillId: 2_000, offset: 200 },
    { name: '__wait', waitMs: 400 },
    { name: '__wait', waitMs: 100 },
    { name: '__wait', waitMs: 100 },
    { name: '__cooldown_reset' }
  ]);
});

test('the shared timeline preserves explicit aftercast mismatches without adding autoattack waits', () => {
  const waitFor = (durationMs, skill = fixtureSkill) =>
    buildReplayTimeline(
      [{ start: 0, end: durationMs, eventIndex: 0, skill, name: skill.name, skillId: skill.id }],
      0,
      null,
      { commandFor: ({ name, skillId }) => ({ name, skillId }) }
    ).find((command) => command.name === '__wait')?.waitMs ?? 0;

  assert.equal(waitFor(420), 0);
  assert.equal(waitFor(421), 21);
  assert.equal(waitFor(800), 400);
  assert.equal(waitFor(800, { ...fixtureSkill, slot: 'Weapon_1' }), 0);
});

test('the shared player selector applies explicit matching and evidence ties consistently', () => {
  const players = [
    { id: 'a', recordedActionCount: 3 },
    { id: 'b', recordedActionCount: 3 }
  ];

  assert.equal(selectRotationPlayer(players).status, 'selection-required');
  assert.deepEqual(
    selectRotationPlayer(players, (player) => player.id === 'b'),
    {
      status: 'selected',
      player: players[1]
    }
  );
  assert.equal(selectRotationPlayer(players, (player) => player.id === 'missing').status, 'player-not-found');
});
