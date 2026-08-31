import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gw2AlliedEffectRecipients,
  gw2BoonApplicationRecipients,
  gw2AlliedPlayerProcTimeline,
  gw2BuffApplicationRecipients,
  prepareGw2BuffCompanionCandidates
} from '#gw2/platform/combat/state/allied-players.js';

test('boon companion candidates bind before canonical recipient selection', () => {
  const event = { type: 'buff', at: 1, source: 'test', recipients: 'party', maximumRecipients: 5 };
  const prepared = prepareGw2BuffCompanionCandidates(event, ['pet:one', 'pet:one', '', 'pet:two']);

  assert.deepEqual(prepared, {
    ...event,
    companionIds: ['pet:one', 'pet:two']
  });
  assert.deepEqual(gw2BoonApplicationRecipients({ allies: { count: 3 } }, prepared), {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 3,
    companionIds: ['pet:one'],
    affectsSummons: true,
    recipientCount: 5
  });
  const selfOnly = { ...event, affectsSummons: false };
  assert.equal(prepareGw2BuffCompanionCandidates(selfOnly, ['pet:one']), selfOnly);
  assert.deepEqual(prepareGw2BuffCompanionCandidates({ ...event, companionIds: ['pet:explicit'] }, ['pet:one']), {
    ...event,
    companionIds: ['pet:explicit']
  });
});

test('allied effect recipients prioritize players before companions', () => {
  const partialParty = gw2AlliedEffectRecipients(
    { allies: { count: 2, strikesPerSecond: 1 } },
    {
      maximumRecipients: 5,
      companionIds: ['minion:one', 'minion:two', 'minion:three']
    }
  );

  assert.deepEqual(partialParty, {
    includesSelf: true,
    alliedPlayerCount: 2,
    companionIds: ['minion:one', 'minion:two'],
    recipientCount: 5
  });

  const fullParty = gw2AlliedEffectRecipients(
    { allies: { count: 4, strikesPerSecond: 1 } },
    {
      maximumRecipients: 5,
      companionIds: ['minion:one', 'minion:two']
    }
  );

  assert.deepEqual(fullParty, {
    includesSelf: true,
    alliedPlayerCount: 4,
    companionIds: [],
    recipientCount: 5
  });
});

test('generic buff recipients ignore the boon-sharing configuration', () => {
  const recipients = gw2BuffApplicationRecipients(
    {
      allies: { count: 2 },
      sharePlayerBoonsWithSummons: false
    },
    {
      recipients: 'party',
      maximumRecipients: 5,
      companionIds: ['minion:one', 'minion:two']
    }
  );

  assert.deepEqual(recipients, {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 2,
    companionIds: ['minion:one', 'minion:two'],
    affectsSummons: true,
    recipientCount: 5
  });
});

test('boon applications resolve player recipients before summons', () => {
  const fullParty = gw2BoonApplicationRecipients(
    {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    {
      recipients: 'party',
      maximumRecipients: 5,
      companionIds: ['clone:one', 'clone:two']
    }
  );

  assert.deepEqual(fullParty, {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 4,
    companionIds: [],
    affectsSummons: false,
    recipientCount: 5
  });

  const partialParty = gw2BoonApplicationRecipients(
    {
      allies: { count: 2, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    {
      recipients: 'party',
      maximumRecipients: 5,
      companionIds: ['clone:one', 'clone:two', 'clone:three']
    }
  );

  assert.deepEqual(partialParty, {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 2,
    companionIds: ['clone:one', 'clone:two'],
    affectsSummons: true,
    recipientCount: 5
  });

  const alliesOnly = gw2BoonApplicationRecipients(
    { allies: { count: 4, strikesPerSecond: 1 } },
    {
      recipients: 'allies',
      maximumRecipients: 5,
      companionIds: ['clone:one', 'clone:two']
    }
  );

  assert.deepEqual(alliesOnly, {
    includesSelf: false,
    affectsSelf: false,
    alliedPlayerCount: 4,
    companionIds: ['clone:one'],
    affectsSummons: true,
    recipientCount: 5
  });
});

test('boon audiences distinguish self, capped sharing, and summon-only effects', () => {
  const selfOnly = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    { recipients: 'self', maximumRecipients: 1 }
  );

  assert.deepEqual(selfOnly, {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 0,
    companionIds: [],
    affectsSummons: false,
    recipientCount: 1
  });

  const sharingDisabled = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: false
    },
    {
      recipients: 'party',
      affectsSummons: true,
      maximumRecipients: 5
    }
  );

  assert.equal(sharingDisabled.affectsSummons, false);

  const explicitSelfAndPet = gw2BoonApplicationRecipients(
    {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: false
    },
    { affectsSummons: true, maximumRecipients: 2 }
  );

  assert.deepEqual(explicitSelfAndPet, {
    includesSelf: true,
    affectsSelf: true,
    alliedPlayerCount: 0,
    companionIds: [],
    affectsSummons: true,
    recipientCount: 2
  });

  const implicitSharingDisabled = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: false
    },
    { recipients: 'party', maximumRecipients: 5 }
  );

  assert.equal(implicitSharingDisabled.affectsSummons, false);

  const openPartySlot = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    { recipients: 'party', maximumRecipients: 5 }
  );

  assert.equal(openPartySlot.affectsSummons, true);

  const resolvedOpenPartySlot = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    {
      recipients: 'party',
      maximumRecipients: 5,
      ...openPartySlot,
      boonAudienceResolved: true
    }
  );

  assert.deepEqual(resolvedOpenPartySlot, openPartySlot);

  const noEligibleCompanions = gw2BoonApplicationRecipients(
    {
      allies: { count: 0, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    { recipients: 'party', maximumRecipients: 5, companionIds: [] }
  );

  assert.equal(noEligibleCompanions.affectsSummons, false);
  assert.equal(noEligibleCompanions.recipientCount, 1);

  const cappedParty = gw2BoonApplicationRecipients(
    {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    { recipients: 'party', maximumRecipients: 5 }
  );

  assert.equal(cappedParty.affectsSummons, false);
  assert.equal(cappedParty.recipientCount, 5);

  const summonOnly = gw2BoonApplicationRecipients(
    {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: false
    },
    {
      recipients: 'summons',
      maximumRecipients: 1,
      companionIds: ['ranger-pet']
    }
  );

  assert.deepEqual(summonOnly, {
    includesSelf: false,
    affectsSelf: false,
    alliedPlayerCount: 0,
    companionIds: ['ranger-pet'],
    affectsSummons: true,
    recipientCount: 1
  });
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
