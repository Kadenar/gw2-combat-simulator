import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { reconstructWarriorDpsReportActions } from '#gw2/integrations/logs/shared/rotation/professions/warrior.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

const profile = ROTATION_PROFILES.find((entry) => entry.specializationId === 'spellbreaker');

/** Keep marker identity independent of translated names, source order, and unrelated signet activations. */
test('Warrior normalization removes only Signet of Fury instant evidence covered by its animation', () => {
  const animation = {
    start: 1000,
    end: 2000,
    rawSkillId: ID.SIGNET_OF_FURY,
    rawName: 'Localized signet',
    status: 'completed',
    eventIndex: 1,
    isSwap: false,
    metadataAccurate: true
  };
  for (const markerStart of [999, 1000, 1040, 2000, 2001]) {
    const marker = { ...animation, start: markerStart, end: markerStart, status: 'instant', eventIndex: 2 };
    const otherSignet = { ...marker, rawSkillId: ID.SIGNET_OF_MIGHT, eventIndex: 3 };
    for (const actions of [
      [animation, marker, otherSignet],
      [otherSignet, marker, animation]
    ]) {
      const result = reconstructWarriorDpsReportActions({ profile, catalog: warriorCatalog, recordedActions: actions });
      assert.deepEqual(
        new Set(result),
        new Set(
          actions.filter((action) => action !== marker || markerStart < animation.start || markerStart > animation.end)
        )
      );
    }

    assert.deepEqual(
      reconstructWarriorDpsReportActions({ profile, catalog: warriorCatalog, recordedActions: [marker] }),
      [marker]
    );
  }
});

/** Equivalent animation and buff evidence must replay the same input without triggering a second cooldown check. */
function reconstructFixture(format, includeMarker) {
  if (format === 'dps.report') {
    return reconstructDpsReportRotation(
      parseDpsReport({
        durationMS: 3000,
        players: [
          {
            name: 'Fixture Warrior',
            profession: 'Spellbreaker',
            rotation: [
              {
                id: ID.SIGNET_OF_FURY,
                skills: [
                  { castTime: 1000, duration: 1000 },
                  ...(includeMarker ? [{ castTime: 1040, duration: 0 }] : [])
                ]
              }
            ]
          }
        ],
        phases: [{ start: 0, end: 3000, name: 'Full Fight' }],
        skillMap: { [`s${ID.SIGNET_OF_FURY}`]: { name: 'Signet of Fury', isInstantCast: true } }
      }),
      warriorCatalog
    );
  }

  return reconstructEvtcRotation(
    log({
      agents: [{ ...log().agents[0], profession: 2, elite: 61 }],
      skills: [{ id: ID.SIGNET_OF_FURY, name: 'Signet of Fury' }],
      events: [
        event({ time: 0, stateChange: 1 }),
        event({ time: 1000, stateChange: 67, skillId: ID.SIGNET_OF_FURY, value: 1000 }),
        ...(includeMarker
          ? [event({ time: 1040, stateChange: 69, skillId: 51664, target: PLAYER, value: 4000, buff: 1 })]
          : []),
        event({ time: 2000, stateChange: 68, skillId: ID.SIGNET_OF_FURY, value: 1000, activation: 3 }),
        event({ time: 3000, stateChange: 2 })
      ]
    }),
    warriorCatalog
  );
}

for (const format of ['dps.report', 'evtc']) {
  test(`${format} Signet of Might passive evidence distinguishes trait procs from manual cooldowns`, () => {
    // A persistent passive proves a lesser signet, while absent evidence or a nearby loss preserves manual input.
    for (const mode of ['proc', 'manual', 'unknown', 'other-player']) {
      const passive = mode !== 'unknown';
      const manual = mode === 'manual';
      const states = mode === 'other-player' ? [] : [...(passive ? [[0, 1]] : []), ...(manual ? [[1010, 0]] : [])];
      const guid = Buffer.from('75EF160EAFC0394CACC436CF89819148', 'hex');
      const imported =
        format === 'dps.report'
          ? reconstructDpsReportRotation(
              parseDpsReport({
                players: [
                  {
                    name: 'Fixture',
                    profession: 'Spellbreaker',
                    buffUptimes: [{ id: 14444, states }],
                    rotation: [
                      { id: ID.SIGNET_OF_MIGHT, skills: [{ castTime: 1000, duration: 0 }] },
                      { id: ID.SIGNET_OF_FURY, skills: [{ castTime: 2000, duration: 1000 }] }
                    ]
                  }
                ],
                phases: [{ start: 0, end: 4000, name: 'Full Fight' }],
                skillMap: {
                  [`s${ID.SIGNET_OF_MIGHT}`]: { name: 'Signet of Might', isNotAccurate: true },
                  [`s${ID.SIGNET_OF_FURY}`]: { name: 'Signet of Fury' }
                }
              }),
              warriorCatalog
            )
          : reconstructEvtcRotation(
              log({
                agents: [{ ...log().agents[0], profession: 2, elite: 61 }],
                skills: [{ id: ID.SIGNET_OF_FURY, name: 'Signet of Fury' }],
                events: [
                  event({ time: 0, stateChange: 1 }),
                  event({
                    time: 0,
                    stateChange: 46,
                    skillId: 77,
                    source: guid.readBigUInt64LE(0),
                    target: guid.readBigUInt64LE(8)
                  }),
                  ...(passive
                    ? [
                        event({
                          time: 0,
                          stateChange: 18,
                          skillId: 14444,
                          value: 2147483647,
                          target: mode === 'other-player' ? 0x9999n : PLAYER,
                          buff: 1
                        })
                      ]
                    : []),
                  event({ time: 1000, stateChange: 51, skillId: 77, target: PLAYER }),
                  ...(manual
                    ? [event({ time: 1010, stateChange: 72, skillId: 14444, source: PLAYER, buffRemove: 1 })]
                    : []),
                  event({ time: 2000, stateChange: 67, skillId: ID.SIGNET_OF_FURY, value: 1000 }),
                  event({ time: 3000, stateChange: 68, skillId: ID.SIGNET_OF_FURY, value: 1000, activation: 3 }),
                  event({ time: 4000, stateChange: 2 })
                ]
              }),
              warriorCatalog
            );
      assert.ok(imported.sourceActions.some((action) => action.rawSkillId === ID.SIGNET_OF_MIGHT));
      assert.equal(
        imported.rotation.some((command) => command.skillId === ID.SIGNET_OF_MIGHT),
        mode !== 'proc'
      );
      const result = simulateGw2({
        profession: warriorProfession,
        rotation: imported.rotation,
        config: defaultSimulationConfig({ specialization: 'Spellbreaker', initialResource: 0 })
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(Object.hasOwn(result.planningState.cooldowns, ID.SIGNET_OF_MIGHT), mode !== 'proc');
    }
  });

  test(`${format} Signet of Fury corroboration preserves source evidence without replaying a duplicate`, () => {
    const imported = reconstructFixture(format, true);
    const animationOnly = reconstructFixture(format, false);
    assert.deepEqual(imported.rotation, animationOnly.rotation);
    assert.deepEqual(imported.actions, animationOnly.actions);
    assert.ok(
      imported.sourceActions.some((action) => action.rawSkillId === ID.SIGNET_OF_FURY && action.status === 'instant')
    );
    const result = simulateGw2({
      profession: warriorProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({ specialization: 'Spellbreaker', initialResource: 0 })
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.ADRENALINE].value, 20);
  });
}
