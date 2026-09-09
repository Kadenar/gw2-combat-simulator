import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_ROTATION_PROFILES } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { selectRotationPlayer } from '#gw2/integrations/logs/lib/rotation/selection.js';
import { buildReplayTimeline } from '#gw2/integrations/logs/lib/rotation/timeline.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event as evtcEvent, log } from '../helpers/evtc-fixture.js';

const fixtureSkill = {
  id: 1_000,
  name: 'Mind Stab',
  type: 'Weapon',
  slot: 'Weapon_2',
  castTimeMs: 600,
  quicknessCastTimeMs: 400,
  effects: []
};
const catalog = { skills: [fixtureSkill] };

test('both importers order tied legend swaps before weapon swaps without reversing distinct timestamps', () => {
  // Report skill-group order and EVTC record order cannot decide which weapon owns a tied legend-swap proc.
  for (const legendOffset of [0, 1]) {
    for (const reverseSourceOrder of [false, true]) {
      const events = [
        evtcEvent({ time: 1000, stateChange: 11, target: 5n }),
        evtcEvent({ time: 1000 + legendOffset, stateChange: 69, target: PLAYER, skillId: 27890, buff: 1, value: 1000 })
      ];
      const rotation = [
        { id: 65001, skills: [{ castTime: 1000, duration: 0 }] },
        { id: 28134, skills: [{ castTime: 1000 + legendOffset, duration: 0 }] }
      ];

      if (reverseSourceOrder) {
        events.reverse();
        rotation.reverse();
      }

      const evtc = reconstructEvtcRotation(
        log({
          agents: [{ ...log().agents[0], profession: 9, elite: 63 }],
          // EVTC can name only the stance buff, with no record for the inferred cast's skill ID.
          skills: [{ id: 27890, name: 'Legendary Assassin Stance' }],
          events
        }),
        revenantCatalog,
        { includeCombatStart: false }
      );
      const report = reconstructDpsReportRotation(
        {
          players: [{ name: 'Fixture', profession: 'Renegade', rotation }],
          phases: [{ start: 1000, end: 2000, name: 'Full Fight' }],
          skillMap: {
            s65001: { name: 'Weapon Swap', isSwap: true },
            s28134: { name: 'Legendary Assassin Stance' }
          }
        },
        revenantCatalog
      );
      for (const result of [evtc, report]) {
        const legendIndex = result.rotation.findIndex((command) => command.name === 'Swap Legends');
        const weaponIndex = result.rotation.findIndex((command) => command.name === 'Swap Weapons');
        assert.ok(legendIndex >= 0 && weaponIndex >= 0);
        assert.equal(legendIndex < weaponIndex, legendOffset === 0);
      }
    }
  }
});

test('both importers preserve idle after cancelled and committed retained-lockout casts', () => {
  // An idle gap beyond boundary jitter follows the occupied lane, which ends early only below the commit cutoff.
  const attack = {
    ...fixtureSkill,
    quicknessCastTimeMs: 600,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true
  };
  const skills = [attack, { ...fixtureSkill, id: 1001, name: 'Follow-up' }];
  for (const duration of [80, 400]) {
    const nextStart = 1000 + (duration < 400 ? duration : 600) + 80;
    const evtc = reconstructEvtcRotation(
      log({
        skills,
        events: [
          evtcEvent({ time: 1000, skillId: attack.id, stateChange: 67, value: 600 }),
          evtcEvent({ time: 1000 + duration, skillId: attack.id, stateChange: 68, activation: 4, value: duration }),
          evtcEvent({ time: nextStart, skillId: 1001, stateChange: 67, value: 400 }),
          evtcEvent({ time: nextStart + 400, skillId: 1001, stateChange: 68, activation: 3, value: 400 })
        ]
      }),
      { skills },
      { includeCombatStart: false }
    );
    const report = reconstructDpsReportRotation(
      {
        players: [
          {
            name: 'Fixture',
            profession: 'Mesmer',
            rotation: [
              { id: attack.id, skills: [{ castTime: 1000, duration, timeGained: -duration }] },
              { id: 1001, skills: [{ castTime: nextStart, duration: 400, timeGained: 0 }] }
            ]
          }
        ],
        phases: [{ start: 1000, end: 2500, name: 'Full Fight' }],
        skillMap: { s1000: { name: attack.name }, s1001: { name: 'Follow-up' } }
      },
      { skills }
    );
    for (const result of [evtc, report]) {
      assert.deepEqual(
        result.rotation.filter((command) => command.name !== '__combat_start'),
        [
          { name: attack.name, skillId: attack.id, interruptMs: duration },
          { name: '__wait', waitMs: 80 },
          { name: 'Follow-up', skillId: 1001 }
        ]
      );
    }
  }
});

for (const [professionCode, professionName] of [
  [1, 'Guardian'],
  [2, 'Warrior'],
  [3, 'Engineer'],
  [4, 'Ranger'],
  [5, 'Thief'],
  [6, 'Elementalist'],
  [7, 'Mesmer'],
  [8, 'Necromancer'],
  [9, 'Revenant'],
  [7, 'Troubadour']
]) {
  for (const source of professionName === 'Troubadour' ? ['dps.report'] : ['dps.report', 'EVTC']) {
    test(`${source} preserves a cancelled ${professionName} autoattack and a 40 ms wait without damage evidence`, () => {
      // No strike is needed to prove a cancelled input occupied the cast lane.
      const attack = { ...fixtureSkill, id: 10273, name: 'Winds of Chaos', slot: 'Weapon_1' };
      const skills = [attack, { ...fixtureSkill, id: 1001, name: 'Follow-up' }];
      const result =
        source === 'EVTC'
          ? reconstructEvtcRotation(
              log({
                agents: [{ ...log().agents[0], profession: professionCode, elite: 0 }],
                skills,
                events: [
                  evtcEvent({ time: 1000, skillId: attack.id, stateChange: 67, value: 400 }),
                  evtcEvent({ time: 1040, skillId: attack.id, stateChange: 68, activation: 4, value: 40 }),
                  evtcEvent({ time: 1080, skillId: 1001, stateChange: 67, value: 400 }),
                  evtcEvent({ time: 1480, skillId: 1001, stateChange: 68, activation: 3, value: 400 })
                ]
              }),
              { skills },
              { includeCombatStart: false }
            )
          : reconstructDpsReportRotation(
              {
                players: [
                  {
                    name: 'Fixture',
                    profession: professionName,
                    rotation: [
                      { id: attack.id, skills: [{ castTime: 1000, duration: 40, timeGained: -40 }] },
                      { id: 1001, skills: [{ castTime: 1080, duration: 400, timeGained: 0 }] }
                    ]
                  }
                ],
                phases: [{ start: 1000, end: 2000, name: 'Full Fight' }],
                skillMap: { s10273: { name: attack.name, autoAttack: true }, s1001: { name: 'Follow-up' } }
              },
              { skills }
            );
      assert.deepEqual(
        result.rotation.filter((command) => command.name !== '__combat_start'),
        [
          { name: attack.name, skillId: attack.id, interruptMs: 40 },
          { name: '__wait', waitMs: 40 },
          { name: 'Follow-up', skillId: 1001 }
        ]
      );
    });
  }
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
        evtcEvent({ time: 1_840, stateChange: 68, skillId: 1_000, value: 640, activation: 5 }),
        evtcEvent({ time: 1_840, stateChange: 67, skillId: 1_000, value: 600 }),
        evtcEvent({ time: 2_480, stateChange: 68, skillId: 1_000, value: 640, activation: 5 })
      ]
    },
    catalog,
    {}
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

test('the shared timeline preserves unsupported durations, idle gaps, and concurrent offsets', () => {
  const instant = { ...fixtureSkill, id: 2_000, name: 'Instant', castTimeMs: 0, quicknessCastTimeMs: 0 };
  const actions = [
    { start: 0, end: 400, eventIndex: 0, skill: fixtureSkill, name: 'Mind Stab', skillId: 1_000 },
    { start: 200, end: 200, eventIndex: 1, skill: instant, name: 'Instant', skillId: 2_000 },
    { start: 800, end: 900, eventIndex: 2, skill: null, name: 'Unknown', skillId: 9_000 }
  ];

  assert.deepEqual(buildReplayTimeline(actions, 0, 100, { commandFor: ({ name, skillId }) => ({ name, skillId }) }), [
    { name: 'Mind Stab', skillId: 1_000 },
    { name: '__combat_start', offset: 120 },
    { name: 'Instant', skillId: 2_000, offset: 200 },
    { name: '__wait', waitMs: 400 },
    { name: '__wait', waitMs: 100 }
  ]);
});

test('weapon swaps retain their observed overlap with dodge through an intervening instant', () => {
  const instant = { id: 2_000, name: 'Instant', castTimeMs: 0 };
  const swap = { id: -3, name: 'Swap Weapons', castTimeMs: 0 };
  // A non-dodge cast still serializes swaps; dodge keeps the swap cooldown anchored to its actual input.
  for (const name of ['Dodge', 'Channel']) {
    const skill = { id: -5, name, castTimeMs: 800, unaffectedByQuickness: true };
    const actions = [
      { start: 0, end: 800, skill },
      { start: 100, end: 100, skill: instant },
      { start: 200, end: 200, skill: swap }
    ].map((action, eventIndex) => ({ ...action, eventIndex, name: action.skill.name, skillId: action.skill.id }));
    const rotation = buildReplayTimeline(actions, 0, null, {
      alignWaitsToSimulatorTiming: true,
      commandFor: ({ name, skillId }) => ({ name, skillId })
    });
    assert.equal(
      rotation.find((command) => command.name === 'Swap Weapons').offset,
      name === 'Dodge' ? 100 : undefined
    );
  }
});

test('the shared timeline rounds combat offsets relative to the skill, including the cast-end jitter window', () => {
  // A non-tick-aligned cast start proves we round elapsed time, not the absolute combat timestamp.
  const start = 137;
  for (const [elapsed, expected] of [
    [355, 360],
    [365, 360],
    [360, 360],
    [380, 400]
  ]) {
    const rotation = buildReplayTimeline(
      [
        {
          start,
          end: start + 400,
          eventIndex: 0,
          skill: fixtureSkill,
          name: fixtureSkill.name,
          skillId: fixtureSkill.id
        }
      ],
      start,
      start + elapsed,
      { commandFor: ({ name, skillId }) => ({ name, skillId }) }
    );
    assert.deepEqual(
      rotation.find((command) => command.name === '__combat_start'),
      {
        name: '__combat_start',
        offset: expected
      }
    );
  }
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

test('the shared timeline preserves idle after an uninterrupted retained-lockout skill', () => {
  const retainedSkill = { ...fixtureSkill, retainsCastLockoutAfterInterrupt: true };
  const nextSkill = { ...fixtureSkill, id: 2_000, name: 'Next Cast' };
  const rotation = buildReplayTimeline(
    [
      { start: 0, end: 400, eventIndex: 0, skill: retainedSkill, name: retainedSkill.name, skillId: retainedSkill.id },
      { start: 441, end: 841, eventIndex: 1, skill: nextSkill, name: nextSkill.name, skillId: nextSkill.id }
    ],
    0,
    null,
    { commandFor: ({ name, skillId }) => ({ name, skillId }) }
  );

  assert.deepEqual(rotation, [
    { name: 'Mind Stab', skillId: 1_000 },
    { name: '__wait', waitMs: 41 },
    { name: 'Next Cast', skillId: 2_000 }
  ]);
});

test('the shared timeline subtracts accumulated simulator cast overruns from a later source gap', () => {
  const longerRuntimeSkill = { ...fixtureSkill, quicknessCastTimeMs: 480 };
  const rotation = buildReplayTimeline(
    [
      { start: 0, end: 440, eventIndex: 0, skill: longerRuntimeSkill, name: 'Mind Stab', skillId: 1_000 },
      { start: 440, end: 880, eventIndex: 1, skill: longerRuntimeSkill, name: 'Mind Stab', skillId: 1_000 },
      { start: 1_000, end: 1_440, eventIndex: 2, skill: longerRuntimeSkill, name: 'Mind Stab', skillId: 1_000 }
    ],
    0,
    null,
    {
      alignWaitsToSimulatorTiming: true,
      commandFor: ({ name, skillId }) => ({ name, skillId })
    }
  );

  assert.deepEqual(rotation, [
    { name: 'Mind Stab', skillId: 1_000 },
    { name: 'Mind Stab', skillId: 1_000 },
    { name: '__wait', waitMs: 40 },
    { name: 'Mind Stab', skillId: 1_000 }
  ]);
});

test('runtime alignment preserves mechanic-owned occupied intervals without adding waits', () => {
  // A source interval supplied by setup inference or a charge mechanic is already accounted for outside cast runtime.
  const rotation = buildReplayTimeline(
    [
      { start: 0, end: 1_200, eventIndex: 0, skill: fixtureSkill, name: 'Mind Stab', skillId: 1_000 },
      { start: 1_200, end: 1_600, eventIndex: 1, skill: fixtureSkill, name: 'Mind Stab', skillId: 1_000 }
    ],
    0,
    null,
    {
      alignWaitsToSimulatorTiming: true,
      hasObservedCastTime: ({ eventIndex }) => eventIndex !== 0,
      commandFor: ({ name, skillId }) => ({ name, skillId })
    }
  );

  assert.deepEqual(rotation, [
    { name: 'Mind Stab', skillId: 1_000 },
    { name: 'Mind Stab', skillId: 1_000 }
  ]);
});

test('runtime alignment budgets resolved cast variants instead of counting their wind-up as idle', () => {
  // Two variants of one catalog skill occupy different lanes; only the gaps between their full inputs are waits.
  const actions = [
    { start: 0, end: 800, replayDurationMs: 800 },
    { start: 1000, end: 1200, replayDurationMs: 200 },
    { start: 1400, end: 1800 }
  ].map((action, eventIndex) => ({
    ...action,
    eventIndex,
    skill: fixtureSkill,
    name: fixtureSkill.name,
    skillId: fixtureSkill.id
  }));
  const rotation = buildReplayTimeline(actions, 0, null, {
    alignWaitsToSimulatorTiming: true,
    commandFor: ({ name, skillId }) => ({ name, skillId })
  });
  assert.deepEqual(
    rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 200]
  );
});

test('the shared timeline subtracts concurrent progress from an observed instant-skill channel', () => {
  const instant = { ...fixtureSkill, id: 2_000, name: 'Instant', castTimeMs: 0, quicknessCastTimeMs: 0 };
  const channel = { ...instant, id: 2_001, name: 'Channel' };
  const actions = [
    { start: 0, end: 1_200, eventIndex: 0, skill: channel, name: channel.name, skillId: channel.id },
    { start: 360, end: 360, eventIndex: 1, skill: instant, name: instant.name, skillId: instant.id },
    { start: 400, end: 400, eventIndex: 2, skill: instant, name: instant.name, skillId: instant.id },
    { start: 640, end: 640, eventIndex: 3, skill: instant, name: instant.name, skillId: instant.id },
    { start: 1_200, end: 1_600, eventIndex: 4, skill: fixtureSkill, name: fixtureSkill.name, skillId: fixtureSkill.id }
  ];

  const rotation = buildReplayTimeline(actions, 0, null, {
    commandFor: ({ name, skillId }) => ({ name, skillId })
  });

  assert.deepEqual(rotation.slice(0, 5), [
    { name: 'Channel', skillId: 2_001 },
    { name: 'Instant', skillId: 2_000, offset: 360 },
    { name: 'Instant', skillId: 2_000, offset: 40 },
    { name: 'Instant', skillId: 2_000, offset: 240 },
    { name: '__wait', waitMs: 560 }
  ]);
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
