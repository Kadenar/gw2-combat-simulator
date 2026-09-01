import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gw2AlliedEffectRecipients,
  gw2AlliedPlayerProcTimeline,
  gw2BoonApplicationRecipients,
  gw2BuffApplicationRecipients,
  prepareGw2BuffCompanionCandidates
} from '#gw2/platform/combat/state/allied-players.js';

test('buff preparation binds unique companion candidates inside the audience request', () => {
  const event = {
    type: 'buff',
    at: 1,
    source: 'test',
    audience: { recipients: 'party', maximumRecipients: 5 }
  };
  const prepared = prepareGw2BuffCompanionCandidates(event, ['pet:one', 'pet:one', '', 'pet:two']);

  assert.deepEqual(prepared, {
    ...event,
    audience: {
      ...event.audience,
      eligibleCompanionIds: ['pet:one', 'pet:two']
    }
  });
  assert.equal(
    prepareGw2BuffCompanionCandidates({ ...event, audience: { recipients: 'self' } }, ['pet:one']).audience.recipients,
    'self'
  );
  assert.equal(
    prepareGw2BuffCompanionCandidates(
      { ...event, audience: { ...event.audience, eligibleCompanionIds: ['pet:explicit'] } },
      ['pet:one']
    ).audience.eligibleCompanionIds[0],
    'pet:explicit'
  );
});

test('party audiences prioritize players and use summons only as fallback', () => {
  assert.deepEqual(
    gw2AlliedEffectRecipients(
      { allies: { count: 2 }, sharePlayerBoonsWithSummons: true },
      {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: ['minion:one', 'minion:two', 'minion:three']
      }
    ),
    {
      includesSelf: true,
      includesSummons: true,
      alliedPlayerCount: 2,
      companionIds: ['minion:one', 'minion:two'],
      recipientCount: 5
    }
  );

  assert.deepEqual(
    gw2AlliedEffectRecipients(
      { allies: { count: 4 }, sharePlayerBoonsWithSummons: true },
      {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: ['minion:one']
      }
    ),
    {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 4,
      companionIds: [],
      recipientCount: 5
    }
  );
});

test('party summon fallback respects the boon-sharing configuration', () => {
  assert.deepEqual(
    gw2AlliedEffectRecipients(
      { allies: { count: 2 }, sharePlayerBoonsWithSummons: false },
      {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: ['minion:one', 'minion:two']
      }
    ),
    {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 2,
      companionIds: [],
      recipientCount: 3
    }
  );
});

test('generic buffs keep summon fallback independent from boon sharing', () => {
  assert.deepEqual(
    gw2BuffApplicationRecipients(
      { allies: { count: 2 }, sharePlayerBoonsWithSummons: false },
      {
        audience: {
          recipients: 'party',
          maximumRecipients: 5,
          eligibleCompanionIds: ['minion:one', 'minion:two']
        }
      }
    ).companionIds,
    ['minion:one', 'minion:two']
  );
});

test('summons means the caster plus eligible summons and counts the caster against the cap', () => {
  assert.deepEqual(
    gw2AlliedEffectRecipients(
      { allies: { count: 4 }, sharePlayerBoonsWithSummons: false },
      {
        recipients: 'summons',
        maximumRecipients: 2,
        eligibleCompanionIds: ['ranger-pet', 'extra-pet']
      }
    ),
    {
      includesSelf: true,
      includesSummons: true,
      alliedPlayerCount: 0,
      companionIds: ['ranger-pet'],
      recipientCount: 2
    }
  );
});

test('affectsSelf false selects only allies or summons and leaves the player out of the result', () => {
  assert.deepEqual(
    gw2AlliedEffectRecipients(
      { allies: { count: 2 }, sharePlayerBoonsWithSummons: true },
      {
        recipients: 'party',
        affectsSelf: false,
        maximumRecipients: 3,
        eligibleCompanionIds: ['ranger-pet']
      }
    ),
    {
      includesSelf: false,
      includesSummons: true,
      alliedPlayerCount: 2,
      companionIds: ['ranger-pet'],
      recipientCount: 3
    }
  );

  assert.deepEqual(
    gw2AlliedEffectRecipients(
      {},
      {
        recipients: 'summons',
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: ['ranger-pet']
      }
    ),
    {
      includesSelf: false,
      includesSummons: true,
      alliedPlayerCount: 0,
      companionIds: ['ranger-pet'],
      recipientCount: 1
    }
  );
});

test('self audiences resolve only the caster and resolved audiences are reused', () => {
  const self = gw2BoonApplicationRecipients({}, { audience: { recipients: 'self' } });

  assert.deepEqual(self, {
    includesSelf: true,
    includesSummons: false,
    alliedPlayerCount: 0,
    companionIds: [],
    recipientCount: 1
  });
  assert.equal(gw2BoonApplicationRecipients({}, { resolvedAudience: self }), self);
});

test('a summon self-buff includes its caster without affecting the simulated player', () => {
  assert.deepEqual(
    gw2BoonApplicationRecipients(
      { allies: { count: 4 }, sharePlayerBoonsWithSummons: false },
      {
        actorType: 'summon',
        summonOwner: 'ranger-pet:1',
        audience: { recipients: 'self' }
      }
    ),
    {
      includesSelf: false,
      includesSummons: true,
      alliedPlayerCount: 0,
      companionIds: ['ranger-pet:1'],
      recipientCount: 1
    }
  );
});

test("allied proc timelines respect the effect's selected player count", () => {
  const procs = gw2AlliedPlayerProcTimeline(
    { allies: { count: 4, strikesPerSecond: 2 } },
    {
      start: 1,
      duration: 10,
      maximumAllies: 2,
      maximumPerAlly: 3,
      internalCooldown: 1
    }
  );

  assert.equal(procs.length, 6);
  assert.deepEqual([...new Set(procs.map((proc) => proc.allyIndex))], [1, 2]);
  assert.deepEqual(
    procs.filter((proc) => proc.allyIndex === 1).map((proc) => proc.at),
    [2, 3, 4]
  );
});
