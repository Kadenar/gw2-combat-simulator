import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBoonGeneration, projectedPartyEffects } from '#gw2/platform/results/boon-generation.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';

const grant = (kind, at, duration, stacks = 1, options = {}) => ({
  type: 'buff',
  kind,
  at,
  duration,
  stacks,
  audience: { recipients: 'party' },
  ...options
});
const reportFor = (events, end) => projectedPartyEffects(buildBoonGeneration(events, 0, end), end);
const trackFor = (report, kind, recipient = 'ally:1') =>
  report.tracks.find((track) => track.kind === kind && track.recipient === recipient);
const valueAt = (report, kind, at, recipient) => effectStateAt(report, trackFor(report, kind, recipient), at);

// Combat entry limits generation credit, but preparation grants still seed each ally's live boon pool.
test('party projection retains preparation boons while generation counts only the combat window', () => {
  const events = [grant('alacrity', 0, 4), grant('alacrity', 3, 4)];
  const generation = buildBoonGeneration(events, 2, 10);
  const report = projectedPartyEffects(generation, 10);
  const completeHistory = reportFor(events, 10);
  assert.equal(generation.boons.get('alacrity').self.generatedStackSeconds, 4);
  assert.equal(generation.boons.get('alacrity').allies.generatedStackSeconds, 16);
  for (const recipient of ['ally:1', 'ally:2', 'ally:3', 'ally:4']) {
    for (const at of [0, 2, 3, 7, 8]) {
      assert.deepEqual(valueAt(report, 'alacrity', at, recipient), valueAt(completeHistory, 'alacrity', at, recipient));
    }
  }
});

// Extensions after combat entry can extend preparation boons; earlier grants and extensions earn no combat credit.
test('party generation credits in-combat extensions of preparation boons for their actual recipients', () => {
  const generation = buildBoonGeneration(
    [
      grant('alacrity', 0, 4),
      grant('fury', 0, 4, 1, { audience: { recipients: 'self' } }),
      { type: 'boon_extension', at: 1, duration: 1, extensionAudience: 'all' },
      { type: 'boon_extension', at: 3, duration: 2, extensionAudience: 'all' }
    ],
    2,
    10
  );
  assert.equal(generation.boons.get('alacrity').self.generatedStackSeconds, 2);
  assert.equal(generation.boons.get('alacrity').allies.generatedStackSeconds, 8);
  assert.equal(generation.boons.get('fury').self.generatedStackSeconds, 2);
  assert.equal(generation.boons.get('fury').allies.generatedStackSeconds, 0);
  const report = projectedPartyEffects(generation, 10);
  assert.equal(valueAt(report, 'alacrity', 3).expiresAt, 7);
  assert.equal(trackFor(report, 'fury'), undefined);
});

// Independent capture scopes must retain other allies and boons while the current track changes.
test('party projection preserves unrelated tracks and partial recipient audiences', () => {
  const report = reportFor(
    [
      grant('might', 0, 10, 3),
      grant('fury', 2, 2, 1, { audience: { recipients: 'party', maximumRecipients: 3 } }),
      grant('quickness', 3, 2)
    ],
    8
  );
  for (const recipient of ['ally:1', 'ally:2', 'ally:3', 'ally:4']) {
    assert.equal(valueAt(report, 'might', 7, recipient).count, 3);
    assert.equal(valueAt(report, 'might', 8, recipient).expiresAt, 10);
    assert.equal(valueAt(report, 'quickness', 4, recipient).count, 1);
    assert.equal(valueAt(report, 'quickness', 5, recipient).count, 0);
  }

  assert.equal(valueAt(report, 'fury', 3, 'ally:1').count, 1);
  assert.equal(valueAt(report, 'fury', 3, 'ally:2').count, 1);
  assert.equal(trackFor(report, 'fury', 'ally:3'), undefined);
  assert.equal(trackFor(report, 'fury', 'ally:4'), undefined);
  assert.ok(report.tracks.every((track) => track.origin === 'party-projection'));
});

// A pooled deadline can outlive individual receipts, but an extension at expiry cannot restart the pool.
test('party duration pools preserve caps, expiry gaps, and terminal observation', () => {
  const report = reportFor(
    [
      grant('quickness', 0, 20),
      grant('quickness', 5, 20),
      { type: 'boon_extension', kind: 'quickness', at: 35, duration: 4, extensionAudience: 'all' },
      grant('quickness', 40, 5),
      grant('quickness', 43, 20)
    ],
    43
  );
  assert.equal(valueAt(report, 'quickness', 5).expiresAt, 35);
  assert.equal(valueAt(report, 'quickness', 34).count, 1);
  assert.equal(valueAt(report, 'quickness', 35).count, 0);
  assert.equal(valueAt(report, 'quickness', 39).count, 0);
  assert.equal(valueAt(report, 'quickness', 43).count, 1);
  assert.equal(valueAt(report, 'quickness', 43).expiresAt, 45);
  assert.ok(trackFor(report, 'quickness').segments.every((segment) => segment.end <= 43));

  const rounded = reportFor(
    [
      grant('fury', 0.36, 1.002),
      { type: 'boon_extension', kind: 'fury', at: 1.4, duration: 1, extensionAudience: 'all' }
    ],
    2
  );
  assert.equal(valueAt(rounded, 'fury', 1.399999).count, 1);
  assert.equal(valueAt(rounded, 'fury', 1.4).count, 0);
});

// Excess stacks remain available after expiry; source follows application order while expiry uses all live windows.
test('party intensity projection retains excess stacks and switches back to the surviving source', () => {
  const report = reportFor(
    [
      grant('might', 0, 10, 25, { eventOrder: 1, skillName: 'Long grant' }),
      grant('might', 1, 3, 10, { eventOrder: 2, skillName: 'Short grant' })
    ],
    12
  );
  assert.equal(valueAt(report, 'might', 2).count, 25);
  assert.equal(valueAt(report, 'might', 2).expiresAt, 10);
  assert.equal(valueAt(report, 'might', 2).source.skillName, 'Short grant');
  assert.equal(valueAt(report, 'might', 4).count, 25);
  assert.equal(valueAt(report, 'might', 4).source.skillName, 'Long grant');
  assert.equal(valueAt(report, 'might', 10).count, 0);
});

// Equal-time grant/extension order changes whether the new pool receives the extension without creating zero-width segments.
test('party projection preserves causal ordering of grants and extensions at expiry', () => {
  const extension = {
    type: 'boon_extension',
    kind: 'fury',
    at: 2,
    duration: 3,
    extensionAudience: 'all',
    causalOrder: 2
  };
  for (const [causalOrder, expiresAt] of [
    [1, 6],
    [3, 3]
  ]) {
    const report = reportFor([grant('fury', 0, 2), extension, grant('fury', 2, 1, 1, { causalOrder })], 8);
    assert.equal(valueAt(report, 'fury', 2).expiresAt, expiresAt);
    assert.equal(valueAt(report, 'fury', expiresAt).count, 0);
    assert.ok(trackFor(report, 'fury').segments.every((segment) => segment.start < segment.end));
  }
});
