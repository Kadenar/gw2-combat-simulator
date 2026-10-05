import { effectFields } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalChanceEventAt } from '#gw2/platform/results/query.js';
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
  assert.deepEqual(effectStateAt(report, track, 3), { count: 2, expiresAt: 10, source: older });
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
  assert.deepEqual(effectStateAt(report, mightTrack, 5), { count: 2, expiresAt: 6, source: might });
  assert.deepEqual(effectStateAt(report, furyTrack, 5), { count: 1, expiresAt: 6, source: fury });
  assert.equal(effectStateAt(report, furyTrack, 6).count, 0);
  assert.equal(effectStateAt(report, mightTrack, 6).count, 0);
});

test('critical chance query selects the next eligible player strike', () => {
  const before = { type: 'damage', at: 0.5, criticalChance: 0.4 };
  const after = { type: 'damage', at: 2, criticalChance: 0.75 };
  const result = {
    ...effectFields(
      [
        before,
        { type: 'damage', at: 1.1, source: 'Clone', criticalChance: 1 },
        { type: 'damage', at: 1.2, independentSummonStrike: true, criticalChance: 1 },
        { type: 'damage', at: 1.3, critEligible: false, criticalChance: 0 },
        after
      ],
      120
    )
  };

  assert.equal(criticalChanceEventAt(result, 1000), after);
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
  assert.deepEqual(effectStateAt(report, track, 3), { count: 5, expiresAt: 7, source: latest });
  assert.equal(effectStateAt(report, track, 4).count, 3);
  assert.equal(effectStateAt(report, track, 7).count, 0);

  const rounded = {
    ...effectFields([{ type: 'buff', kind: 'tracked', at: 0.36, duration: 1.002, stacks: 1, resolvedAudience }], 120)
  };
  assert.equal(effectStateAt(rounded.effectReport, rounded.effectReport.tracks[0], 1.399999).count, 1);
  assert.equal(effectStateAt(rounded.effectReport, rounded.effectReport.tracks[0], 1.4).count, 0);
});
