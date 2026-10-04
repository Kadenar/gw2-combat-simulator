import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBoonExtension, recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { effectStateValue, timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { EffectRecorder, effectStateAt } from '#gw2/platform/results/effect-report.js';

const audience = {
  includesSelf: true,
  includesSummons: true,
  alliedPlayerCount: 1,
  companionIds: ['clone:1'],
  recipientCount: 3
};
const runtime = () => ({ boons: new Map(), config: {}, conditionState: new Map(), time: 0 });
const grant = (state, kind, at, stacks, duration) =>
  recordBuffApplication(state.boons, {
    type: 'buff',
    kind,
    at,
    stacks,
    duration,
    resolvedAudience: audience
  });
const value = (state, kind, recipient = 'self', profession = {}) => {
  const effect = observeRuntimeEffects(state, profession).find(
    (entry) => entry.kind === kind && entry.recipient === recipient
  );
  return effect && effectStateValue(effect, state.time);
};

// Observation reuse must still see same-time grants, immutable replacements, removals, and expiry.
test('generic observation follows grant-history changes and time boundaries for each recipient', () => {
  const state = runtime();
  const applications = grant(state, 'might', 0, 2, 4);
  assert.equal(value(state, 'might').count, 2);
  grant(state, 'might', 0, 3, 8);
  for (const recipient of ['self', 'ally:1', 'companion:clone:1'])
    assert.equal(value(state, 'might', recipient).count, 5);

  // Replacing an entry in the same array must invalidate even though its identity and length are unchanged.
  applications[0] = { ...applications[0], stacks: 1 };
  assert.equal(value(state, 'might').count, 4);
  state.time = 4;
  assert.equal(value(state, 'might').count, 3);
  state.boons.set(
    'might',
    applications.map((application) => ({ ...application, expiresAt: 5 }))
  );
  assert.equal(value(state, 'might').expiresAt, 5);
  state.time = 5;
  assert.equal(value(state, 'might').count, 0);
  state.boons.delete('might');
  assert.equal(value(state, 'might'), undefined);
  grant(state, 'might', 5, 7, 2);
  assert.equal(value(state, 'might').count, 7);
});

test('duration observation retains pooled deadlines and audience-specific extensions', () => {
  const state = runtime();
  grant(state, 'fury', 0, 1, 2);
  grant(state, 'fury', 1, 1, 3);
  assert.equal(value(state, 'fury').expiresAt, 2);
  state.time = 1;
  assert.equal(value(state, 'fury').expiresAt, 5);
  state.time = 2;
  assert.equal(value(state, 'fury').expiresAt, 5);
  applyBoonExtension(state.boons, { type: 'boon_extension', kind: 'fury', at: 2, duration: 2 });
  assert.equal(value(state, 'fury').expiresAt, 7);
  for (const recipient of ['ally:1', 'companion:clone:1']) assert.equal(value(state, 'fury', recipient).expiresAt, 5);
  state.time = 5;
  assert.equal(value(state, 'fury', 'companion:clone:1').count, 0);
  assert.equal(value(state, 'fury').count, 1);
  state.time = 7;
  assert.equal(value(state, 'fury').count, 0);
  // A historical query must not reuse a later expired observation.
  state.time = 0;
  assert.equal(value(state, 'fury').expiresAt, 2);
});

test('duration observations expire on the canonical deadline without another capture', () => {
  const state = runtime();
  state.time = 65.04;
  grant(state, 'fury', state.time, 1, 3.2);
  const recorder = new EffectRecorder();
  recorder.capture(state.time, observeRuntimeEffects(state, {}));
  const report = recorder.finish(68.24);
  const fury = report.tracks.find((track) => track.kind === 'fury' && track.recipient === 'self');
  assert.equal(effectStateAt(report, fury, 68.239).count, 1);
  assert.equal(effectStateAt(report, fury, 68.24).count, 0);
});

test('intensity extension replaces accepted windows without extending other audiences', () => {
  const state = runtime();
  grant(state, 'might', 0, 2, 3);
  assert.equal(value(state, 'might').expiresAt, 3);
  state.time = 1;
  applyBoonExtension(state.boons, { type: 'boon_extension', kind: 'might', at: 1, duration: 2 });
  assert.equal(value(state, 'might').expiresAt, 5);
  state.time = 3;
  assert.equal(value(state, 'might').count, 2);
  assert.equal(value(state, 'might', 'ally:1').count, 0);
  assert.equal(value(state, 'might', 'companion:clone:1').count, 0);
});

test('policy changes and native consumption remain visible with unchanged generic grants', () => {
  const state = runtime();
  grant(state, 'charges', 0, 5, 10);
  let maximumStacks = 3;
  let native = false;
  let charges = 2;
  const profession = {
    buffPolicies: () => [{ kind: 'charges', maximumStacks }],
    observeEffects: () => (native ? [timedEffectState('charges', [{ stacks: charges, expiresAt: 10 }], 3)] : [])
  };
  assert.equal(value(state, 'charges', 'self', profession).count, 3);
  maximumStacks = 1;
  assert.equal(value(state, 'charges', 'self', profession).count, 1);
  native = true;
  assert.equal(value(state, 'charges', 'self', profession).count, 2);
  charges = 0;
  assert.equal(value(state, 'charges', 'self', profession).count, 0);
  assert.equal(value(state, 'charges', 'companion:clone:1', profession).count, 1);
});

// Scalar window copying must retain deep isolation of nested source metadata and finished reports.
test('recorded windows and source events stay detached from their owner and report consumers', () => {
  const recorder = new EffectRecorder();
  const source = { type: 'buff', at: 0, metadata: { variant: 'original' } };
  const windows = [{ stacks: 2, expiresAt: 5, source }];
  recorder.capture(0, [timedEffectState('charges', windows, 3, { source })]);
  source.metadata.variant = 'changed';
  windows[0].stacks = 1;
  const report = recorder.finish(2);
  const observed = effectStateAt(report, report.tracks[0], 1);
  assert.equal(observed.count, 2);
  assert.equal(observed.source.metadata.variant, 'original');
  observed.source.metadata.variant = 'consumer edit';
  assert.equal(recorder.finish(3).tracks[0].terminal.source.metadata.variant, 'original');
});

// Identity indexing must distinguish every scope while removals remain local to the capturing owner.
test('recorder keeps identity scopes distinct and clears only the owner that omitted a track', () => {
  const recorder = new EffectRecorder();
  const state = (stacks, options = {}) => timedEffectState('shared', [{ stacks, expiresAt: 10 }], null, options);
  recorder.capture(0, [
    state(1),
    state(2, { origin: 'assumption' }),
    state(3, { recipient: 'companion:1' }),
    state(4, { category: 'boon' })
  ]);
  recorder.capture(0, [timedEffectState('relic:shared', [{ stacks: 1, expiresAt: 10 }])], 'relic');
  recorder.capture(1, [state(5)]);
  // The last accepted transaction at the same timestamp owns the visible count.
  recorder.capture(1, [state(6)]);
  const report = recorder.finish(2);
  assert.deepEqual(
    report.tracks.map((track) => effectStateAt(report, track, 0).count),
    [1, 2, 3, 4, 1]
  );
  assert.deepEqual(
    report.tracks.map((track) => effectStateAt(report, track, 1).count),
    [6, 0, 0, 0, 1]
  );
});

test('recorder rejects duplicate identities within each observation batch', () => {
  const recorder = new EffectRecorder();
  const state = timedEffectState('charges', [{ stacks: 1, expiresAt: 5 }]);
  recorder.capture(0, [state]);
  assert.throws(() => recorder.capture(1, [state, state]), /Duplicate effect state owner/);
});
