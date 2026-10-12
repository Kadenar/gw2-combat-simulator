import { effectFields } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalChanceEventAt } from '#gw2/platform/results/result-queries.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';

// Report queries share committed effect history and half-open lifetimes with combat queries.
test('effect histories isolate self grants and retain older overlapping grants', () => {
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const older = { type: 'buff', kind: 'tracked', at: 0, duration: 10, stacks: 2, resolvedAudience };
  const result = {
    ...effectFields(
      [
        older,
        { ...older, at: 1, duration: 1, stacks: 3 },
        { ...older, at: 2, resolvedAudience: { ...resolvedAudience, includesSelf: false } }
      ],
      120
    )
  };
  const report = result.effectReport;
  const track = report.tracks.find(
    (track) => track.kind === 'tracked' && track.recipient === 'self' && track.origin === 'simulated'
  );
  // Reports retain source identity separately from the original grant's combat payload.
  assert.partialDeepStrictEqual(effectStateAt(report, track, 3), {
    count: 2,
    expiresAt: 10,
    source: { kind: 'tracked', at: 0 }
  });
  assert.equal(effectStateAt(report, track, 10).count, 0);
});

// Extensions use combat's duration-pool and intensity rules while retaining the original source grant.
test('reported boon extensions preserve pooled duration and surviving grant identity', () => {
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const might = { type: 'buff', kind: 'might', at: 0, duration: 4, stacks: 2, resolvedAudience };
  const fury = { type: 'buff', kind: 'fury', at: 1, duration: 2, stacks: 1, resolvedAudience };
  const result = {
    ...effectFields(
      [
        might,
        { ...fury, at: 0 },
        fury,
        { ...might, at: 1, duration: 1, stacks: 3 },
        { type: 'boon_extension', at: 3, duration: 2 }
      ],
      120
    )
  };
  const report = result.effectReport;
  const mightTrack = report.tracks.find((track) => track.kind === 'might');
  const furyTrack = report.tracks.find((track) => track.kind === 'fury');
  assert.partialDeepStrictEqual(effectStateAt(report, mightTrack, 5), {
    count: 2,
    expiresAt: 6,
    source: { kind: 'might', at: 0 }
  });
  assert.partialDeepStrictEqual(effectStateAt(report, furyTrack, 5), {
    count: 1,
    expiresAt: 6,
    source: { kind: 'fury', at: 1 }
  });
  assert.equal(effectStateAt(report, furyTrack, 6).count, 0);
  assert.equal(effectStateAt(report, mightTrack, 6).count, 0);
});

test('critical chance query selects the next eligible player strike', () => {
  // Canonical ownership excludes summons even when their labels or modifier owners resemble the player.
  const before = { type: 'damage', actorType: 'player', at: 0.5, critEligible: true, criticalChance: 0.4 };
  const after = { ...before, at: 2, source: 'Phantasm', criticalChance: 0.75 };
  const ineligible = [
    { ...before, at: 1.1, actorType: 'summon', summonKind: 'clone', source: 'Renamed clone' },
    { ...before, at: 1.2, actorType: 'summon', summonKind: 'phantasm', source: 'Renamed phantasm' },
    { ...before, at: 1.3, actorType: 'summon', summonKind: 'minion', ownerActorType: 'player' },
    { ...before, at: 1.4, critEligible: false, criticalChance: 0 },
    { ...before, at: 1.5, actorType: 'effect' },
    { ...before, at: 1.6, actorType: 'unknown' },
    { ...before, at: 1.7, type: 'condition' },
    { ...before, at: 1.8, critEligible: undefined },
    { ...before, at: 1.9, criticalChance: NaN }
  ];
  const result = {
    ...effectFields([before, ...ineligible, after], 120)
  };

  assert.equal(criticalChanceEventAt(result, 1000), after);
  assert.equal(criticalChanceEventAt(result, 2000), after);
  assert.equal(criticalChanceEventAt(result, 3000), after);
  assert.equal(criticalChanceEventAt({ resolvedEvents: ineligible }, 1000), null);
  assert.equal(criticalChanceEventAt(null, 1000), null);
});

test('critical chance query excludes independent critical profiles even on player-attributed strikes', () => {
  // Stat inheritance, rather than actor attribution, decides whether an independent strike represents player crit.
  const strike = { type: 'damage', at: 1, critEligible: true, criticalChance: 0.05, independentSummonStrike: true };
  for (const ownership of [{ actorType: 'player' }, { actorType: 'effect', ownerActorType: 'player' }]) {
    for (const profile of [{}, { summonInheritsAttributes: false, summonInheritsCriticalAttributes: false }]) {
      const independent = { ...strike, ...ownership, ...profile };
      assert.equal(criticalChanceEventAt({ resolvedEvents: [independent] }, 0), null);
    }

    for (const profile of [
      { summonInheritsAttributes: true },
      { summonInheritsCriticalAttributes: true },
      { independentSummonStrike: false }
    ]) {
      const inherited = { ...strike, ...ownership, ...profile };
      assert.equal(criticalChanceEventAt({ resolvedEvents: [inherited] }, 0), inherited);
    }
  }
});

test('critical chance query includes critical-eligible player-owned derived effects', () => {
  // Equipment procs retain the player's critical sample through explicit effect ownership.
  const effect = {
    type: 'damage',
    actorType: 'effect',
    ownerActorType: 'player',
    at: 1,
    source: 'Renamed proc',
    critEligible: true,
    criticalChance: 0.5
  };
  assert.equal(criticalChanceEventAt({ resolvedEvents: [effect] }, 0), effect);
  assert.equal(criticalChanceEventAt({ resolvedEvents: [{ ...effect, critEligible: false }] }, 0), null);
  assert.equal(criticalChanceEventAt({ resolvedEvents: [{ ...effect, ownerActorType: 'summon' }] }, 0), null);
  assert.equal(criticalChanceEventAt({ resolvedEvents: [{ ...effect, ownerActorType: undefined }] }, 0), null);
});

test('effect histories retain the latest active source and sum live stacks', () => {
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const latest = { type: 'buff', kind: 'tracked', at: 2, duration: 5, stacks: 3, resolvedAudience };
  const result = {
    ...effectFields(
      [
        { type: 'buff', kind: 'tracked', at: 0, duration: 4, stacks: 2, resolvedAudience },
        { type: 'buff', kind: 'other', at: 1, duration: 10, stacks: 10, resolvedAudience },
        latest
      ],
      120
    )
  };

  const report = result.effectReport;
  const track = report.tracks.find((track) => track.kind === 'tracked');
  assert.partialDeepStrictEqual(effectStateAt(report, track, 3), {
    count: 5,
    expiresAt: 7,
    source: { kind: 'tracked', at: 2 }
  });
  assert.equal(effectStateAt(report, track, 4).count, 3);
  assert.equal(effectStateAt(report, track, 7).count, 0);

  const rounded = {
    ...effectFields([{ type: 'buff', kind: 'tracked', at: 0.36, duration: 1.002, stacks: 1, resolvedAudience }], 120)
  };
  assert.equal(effectStateAt(rounded.effectReport, rounded.effectReport.tracks[0], 1.399999).count, 1);
  assert.equal(effectStateAt(rounded.effectReport, rounded.effectReport.tracks[0], 1.4).count, 0);
});
