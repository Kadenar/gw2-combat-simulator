import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { normalizeConduitHazeActions } from '#gw2/integrations/logs/shared/rotation/rules/conduit.js';
import { replayActionCommand } from '#gw2/integrations/logs/shared/rotation/commands.js';
import { resolvedActionIdentity } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { reconstructProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/reconstruct.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { RANGER_SKILL_IDS } from '#gw2/professions/ranger/data/ids.js';
import { ENGINEER_SKILL_IDS } from '#gw2/professions/engineer/data/ids.js';
import { event, log, EVTC_FIXTURE_PLAYER } from '#tests/helpers/evtc-fixture.js';

// Command encoding preserves adapter decisions, including zero-duration cancellation and mechanic-specific inputs.
test('shared commands retain explicit cancellation and variants but reset markers discard cast fields', () => {
  const action = {
    rawSkillId: 1000,
    rawName: 'Fixture',
    skillId: 1000,
    doubleEdgeOutcome: 'backfire',
    releaseAtCharges: 2
  };
  for (const interruptMs of [null, 0, 160]) {
    assert.deepEqual(replayActionCommand(action, interruptMs), {
      type: 'cast',
      skillId: 1000,
      doubleEdgeOutcome: 'backfire',
      releaseAtCharges: 2,
      ...(interruptMs == null ? {} : { interruptAfterMs: interruptMs })
    });
  }

  assert.deepEqual(replayActionCommand({ ...action, rawSkillId: 46970 }, 160), { type: 'cooldown-reset' });
  assert.deepEqual(replayActionCommand({ rawSkillId: 1, rawName: 'Plain', skillId: 1 }, null), {
    type: 'cast',
    skillId: 1
  });
});

test('resolved identity uses the adapter-selected skill, then canonical identity, then source identity', () => {
  const source = { rawSkillId: 1000, rawName: 'Source' };
  const canonical = { ...source, canonicalSkillId: 0, canonicalName: 'Canonical' };
  const skill = { id: 2000, name: 'Selected' };
  assert.deepEqual(resolvedActionIdentity(source, null), { skill: null, skillId: 1000, name: 'Source' });
  assert.deepEqual(resolvedActionIdentity(canonical, null), { skill: null, skillId: 0, name: 'Canonical' });
  assert.deepEqual(resolvedActionIdentity(canonical, skill), { skill, skillId: 2000, name: 'Selected' });
});

test('composites retain the first source identity and evidence while combining expected durations', () => {
  const profile = ROTATION_PROFILES.find((candidate) => candidate.specializationId === 'untamed');
  const first = {
    start: 1000,
    end: 1200,
    rawSkillId: RANGER_SKILL_IDS.OVERBEARING_SMASH,
    rawName: 'Overbearing Smash',
    expectedDurationMs: 200,
    eventIndex: 80,
    evidence: 'animation',
    status: 'completed',
    eiRule: 'first',
    acceleration: 0.5
  };
  const finish = {
    ...first,
    start: 1200,
    end: 1600,
    rawSkillId: RANGER_SKILL_IDS.OVERBEARING_SMASH_SECOND_STRIKE,
    expectedDurationMs: 400,
    eventIndex: 90,
    eiRule: 'finish'
  };
  const [merged] = reconstructProfessionActions({
    profile,
    log: log(),
    catalog: null,
    playerAddress: EVTC_FIXTURE_PLAYER,
    recordedActions: [first, finish]
  });
  assert.equal(merged.expectedDurationMs, 600);
  assert.equal(merged.sourceActionIndex, 0);
  assert.equal(merged.eventIndex, first.eventIndex);
  assert.equal(merged.evidence, first.evidence);
  assert.equal(merged.eiRule, first.eiRule);
  assert.equal(merged.acceleration, first.acceleration);
  assert.equal(first.expectedDurationMs, 200);
  const result = reconstructEvtcRotation(
    log({
      agents: [{ ...log().agents[0], profession: 4, elite: 0 }],
      skills: [first, finish].map((action) => ({ id: action.rawSkillId, name: action.rawName })),
      events: [first, finish].flatMap((action) => [
        event({ time: action.start, skillId: action.rawSkillId, stateChange: 67, value: action.expectedDurationMs }),
        event({
          time: action.end,
          skillId: action.rawSkillId,
          stateChange: 68,
          activation: 5,
          value: action.end - action.start
        })
      ])
    }),
    null,
    { includeCombatStart: false }
  );
  assert.equal(result.actions.find((action) => action.rawSkillId === first.rawSkillId).expectedDurationMs, 600);
});

test('synthesized inputs have explicit evidence without borrowing a source row or its event index', () => {
  const rows = [
    [ENGINEER_SKILL_IDS.RADIANT_ARC_NON_HOLOSMITH, 'Radiant Arc', 1000, 1200],
    [ENGINEER_SKILL_IDS.SUN_RIPPER_NON_HOLOSMITH, 'Sun Ripper', 1600, 2000]
  ];
  const sunEdge = { id: ENGINEER_SKILL_IDS.SUN_EDGE_NON_HOLOSMITH, name: 'Sun Edge', castTimeMs: 400, effects: [] };
  const catalog = { skills: [...rows.map(([id, name]) => ({ id, name, castTimeMs: 400, effects: [] })), sunEdge] };
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 3, elite: 0 }],
    skills: catalog.skills,
    events: rows.flatMap(([skillId, , start, end]) => [
      event({ time: start, skillId, stateChange: 67, value: end - start }),
      event({ time: end, skillId, stateChange: 68, activation: 5, value: end - start })
    ])
  });
  const recordedActions = rows.map(([rawSkillId, rawName, start, end], index) => ({
    rawSkillId,
    rawName,
    start,
    end,
    expectedDurationMs: end - start,
    eventIndex: 10 + index * 10,
    evidence: 'animation',
    status: 'completed'
  }));
  const normalized = reconstructProfessionActions({
    profile: ROTATION_PROFILES.find(
      (candidate) => candidate.professionId === 'engineer' && candidate.specializationId === 'core'
    ),
    log: fixture,
    catalog,
    playerAddress: EVTC_FIXTURE_PLAYER,
    recordedActions
  });
  const synthetic = normalized.find((action) => action.rawSkillId === sunEdge.id);
  assert.equal(synthetic.evidence, 'synthesized');
  assert.equal(synthetic.sourceActionIndex, undefined);
  assert.equal(synthetic.eventIndex, 0.5);
  assert.equal(synthetic.metadataAccurate, false);
  assert.equal(synthetic.expectedDurationMs, 400);
  assert.equal(normalized.find((action) => action.sourceActionIndex === 1).eventIndex, 20);
  const result = reconstructEvtcRotation(fixture, catalog, { includeCombatStart: false });
  assert.equal(result.actions.find((action) => action.skillId === sunEdge.id).evidence, 'synthesized');
  assert.equal(
    result.sourceActions.some((action) => action.rawSkillId === sunEdge.id),
    false
  );
});

test('Conduit import requires Haze timing only for discovered Haze actions', () => {
  const catalog = { skills: [{ id: 77141, name: 'Beguiling Haze', castTimeMs: 1000 }] };
  const action = { start: 0, end: 1000, eventIndex: 0, rawSkillId: 1, status: 'completed' };
  assert.deepEqual(normalizeConduitHazeActions([action], catalog), [action]);
  assert.throws(
    () => normalizeConduitHazeActions([{ ...action, rawSkillId: 77141 }], catalog),
    /missing required profile/
  );
});

test('encounter end is the earliest target death or combat exit', () => {
  const target = 0x100n;
  const other = 0x200n;
  const log = {
    header: { encounterId: 16_146 },
    agents: [
      { address: target, profession: 16_146 },
      { address: other, profession: 1 }
    ],
    events: [
      { source: other, stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD, time: 1_000 },
      { source: target, stateChange: EVTC_STATE_CHANGE.EXIT_COMBAT, time: 3_000 },
      { source: target, stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD, time: 2_000 }
    ]
  };

  assert.equal(encounterEndTime(log), 2_000);
});
