import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBoonExtension, isStandardBoon, recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { effectStateValue, timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { captureRuntimeEffects, observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { reviseEffectState } from '#gw2/platform/combat/effect-revisions.js';
import { EffectRecorder, effectStateAt } from '#gw2/platform/results/effect-report.js';
import { sigilBuffPolicies } from '#gw2/platform/equipment/sigils/effect-state.js';
import { chronomancerBuffPolicies } from '#gw2/professions/mesmer/specializations/chronomancer/effect-state.js';

const audience = {
  includesSelf: true,
  includesSummons: true,
  alliedPlayerCount: 1,
  companionIds: ['clone:1'],
  recipientCount: 3
};
const runtime = () => ({
  boons: new Map(),
  buffs: new Map(),
  retiredCompanions: new Map(),
  config: {},
  conditionState: new Map(),
  time: 0,
  equipmentBuffPolicies: []
});
const grant = (state, kind, at, stacks, duration) =>
  recordBuffApplication(isStandardBoon(kind) ? state.boons : state.buffs, {
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

// Policies follow their contributing owner even when planning has no chart recorder.
test('profession effects require their owner contribution', () => {
  const state = runtime();
  grant(state, 'time-bomb', 0, 1, 5);
  assert.throws(() => observeRuntimeEffects(state, {}), /policy/i);
  assert.equal(value(state, 'time-bomb', 'self', { buffPolicies: chronomancerBuffPolicies }).count, 1);
  assert.equal(state.effectRecorder, undefined);
});

test('equipment policies cover both configured sets and surviving effects after a swap', () => {
  const state = runtime();
  state.config = { sigilSets: [{ names: ['Force'] }, { names: ['Severance'] }] };
  state.equipmentBuffPolicies = sigilBuffPolicies(state.config);
  assert.deepEqual(sigilBuffPolicies({}), []);
  assert.equal(sigilBuffPolicies({ sigilSets: [{ names: ['Severance'] }, { names: ['Severance'] }] }).length, 1);
  state.activeWeaponSet = 2;
  grant(state, 'sigil-severance', 0, 1, 5);
  assert.equal(value(state, 'sigil-severance').count, 1);
  state.activeWeaponSet = 1;
  state.time = 1;
  assert.equal(value(state, 'sigil-severance').count, 1);
  state.time = 5;
  assert.equal(value(state, 'sigil-severance').count, 0);
});

test('policy composition rejects duplicate owners and replacement of shared boons', () => {
  const state = runtime();
  state.equipmentBuffPolicies = [{ kind: 'charges', maximumStacks: 1 }];
  assert.throws(
    () => observeRuntimeEffects(state, { buffPolicies: () => [{ kind: 'charges', maximumStacks: 2 }] }),
    /Duplicate equipment buff policy: charges.*profession/
  );
  for (const owner of ['profession', 'equipment']) {
    const policies = [{ kind: 'might', maximumStacks: 1 }];
    state.equipmentBuffPolicies = owner === 'equipment' ? policies : [];
    assert.throws(
      () => observeRuntimeEffects(state, { buffPolicies: () => (owner === 'profession' ? policies : []) }),
      /Duplicate.*might.*shared/
    );
  }
});

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

// Scalar windows and the retained label metadata stay detached from live sources and finished report consumers.
test('recorded windows and source events stay detached from their owner and report consumers', () => {
  const recorder = new EffectRecorder();
  const source = { type: 'buff', at: 0, metadata: { radiantWeapon: 'original' } };
  const windows = [{ stacks: 2, expiresAt: 5, source }];
  recorder.capture(0, [timedEffectState('charges', windows, 3, { source })]);
  source.metadata.radiantWeapon = 'changed';
  windows[0].stacks = 1;
  const report = recorder.finish(2);
  const observed = effectStateAt(report, report.tracks[0], 1);
  assert.equal(observed.count, 2);
  assert.equal(observed.source.metadata.radiantWeapon, 'original');
  observed.source.metadata.radiantWeapon = 'consumer edit';
  assert.equal(recorder.finish(3).tracks[0].terminal.source.metadata.radiantWeapon, 'original');
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
    new Map(report.tracks.map((track) => [track.id, effectStateAt(report, track, 0).count])),
    new Map([
      ['simulated:self:buff:shared', 1],
      ['assumption:self:buff:shared', 2],
      ['simulated:companion:1:buff:shared', 3],
      ['simulated:self:boon:shared', 4],
      ['simulated:self:buff:relic:shared', 1]
    ])
  );
  assert.deepEqual(
    new Map(report.tracks.map((track) => [track.id, effectStateAt(report, track, 1).count])),
    new Map([
      ['simulated:self:buff:shared', 6],
      ['assumption:self:buff:shared', 0],
      ['simulated:companion:1:buff:shared', 0],
      ['simulated:self:boon:shared', 0],
      ['simulated:self:buff:relic:shared', 1]
    ])
  );
});

test('recorder rejects duplicate identities within each observation batch', () => {
  const recorder = new EffectRecorder();
  const state = timedEffectState('charges', [{ stacks: 1, expiresAt: 5 }]);
  recorder.capture(0, [state]);
  assert.throws(() => recorder.capture(1, [state, state]), /Duplicate effect state owner/);
});

// Fixed assumptions must coexist with the actual self, ally, and companion grants across skipped captures.
test('scoped recording preserves generated boons alongside permanent assumptions', () => {
  const state = runtime();
  state.config = { boons: { might: 25, fury: true } };
  state.effectRecorder = new EffectRecorder();
  captureRuntimeEffects(state, {});
  state.time = 1;
  grant(state, 'might', 1, 3, 4);
  grant(state, 'fury', 1, 1, 2);
  captureRuntimeEffects(state, {});
  state.time = 2;
  captureRuntimeEffects(state, {});
  applyBoonExtension(state.boons, { type: 'boon_extension', kind: 'fury', at: 2, duration: 2 });
  captureRuntimeEffects(state, {});
  state.time = 3;
  state.boons.delete('might');
  captureRuntimeEffects(state, {});
  const report = state.effectRecorder.finish(6);
  const find = (kind, origin, recipient = 'self') =>
    report.tracks.find((track) => track.kind === kind && track.origin === origin && track.recipient === recipient);
  for (const at of [0, 1, 3, 6]) {
    assert.equal(effectStateAt(report, find('might', 'assumption'), at).count, 25);
    assert.equal(effectStateAt(report, find('fury', 'assumption'), at).count, 1);
  }

  for (const recipient of ['self', 'ally:1', 'companion:clone:1']) {
    const might = find('might', 'simulated', recipient);
    assert.equal(effectStateAt(report, might, 0).count, 0);
    assert.equal(effectStateAt(report, might, 2).count, 3);
    assert.equal(effectStateAt(report, might, 3).count, 0);
  }

  assert.equal(effectStateAt(report, find('fury', 'simulated'), 4).count, 1);
  assert.equal(effectStateAt(report, find('fury', 'simulated'), 5).count, 0);
  assert.equal(effectStateAt(report, find('fury', 'simulated', 'ally:1'), 3).count, 0);
});

// A native recipient can consume independently while the same kind's other recipients remain generic.
test('scoped recording retains native consumption, source changes, and recipient ownership', () => {
  const state = runtime();
  state.effectRecorder = new EffectRecorder();
  grant(state, 'charges', 0, 5, 10);
  let charges = 2;
  let native = true;
  let source = { type: 'buff', at: 0, eventOrder: 1 };
  const profession = {
    buffPolicies: () => [{ kind: 'charges', maximumStacks: 5 }],
    observeEffects: () =>
      native ? [timedEffectState('charges', [{ stacks: charges, expiresAt: 10 }], 5, { source })] : []
  };
  captureRuntimeEffects(state, profession);
  state.time = 1;
  source = { ...source, at: 1, eventOrder: 2 };
  captureRuntimeEffects(state, profession);
  state.time = 2;
  charges = 0;
  captureRuntimeEffects(state, profession);
  state.time = 3;
  native = false;
  captureRuntimeEffects(state, profession);
  const report = state.effectRecorder.finish(4);
  const self = report.tracks.find((track) => track.recipient === 'self');
  const ally = report.tracks.find((track) => track.recipient === 'ally:1');
  assert.deepEqual(
    [0, 1, 2, 3].map((at) => effectStateAt(report, self, at).count),
    [2, 2, 0, 5]
  );
  assert.equal(effectStateAt(report, self, 0).source.eventOrder, 1);
  assert.equal(effectStateAt(report, self, 1).source.eventOrder, 2);
  assert.equal(effectStateAt(report, ally, 2).count, 5);
});

test('an empty profession-owned scope never revives its generic grant receipts', () => {
  const state = runtime();
  state.effectRecorder = new EffectRecorder();
  grant(state, 'charges', 0, 5, 10);
  let active = true;
  const profession = {
    buffPolicies: () => [{ kind: 'charges', owner: 'profession' }],
    observeEffects: () => (active ? [timedEffectState('charges', [{ stacks: 1, expiresAt: 10 }])] : [])
  };
  captureRuntimeEffects(state, profession);
  state.time = 1;
  active = false;
  captureRuntimeEffects(state, profession);
  state.time = 2;
  captureRuntimeEffects(state, profession);
  const report = state.effectRecorder.finish(3);
  assert.equal(report.tracks.length, 1);
  assert.equal(effectStateAt(report, report.tracks[0], 0).count, 1);
  assert.equal(effectStateAt(report, report.tracks[0], 1).count, 0);
});

// Revisions cover in-place removal; future visibility and backward inspection still use the owner's windows.
test('condition observations retain exact windows across revisions and time boundaries', () => {
  const state = runtime();
  const condition = {
    stacks: [
      { appliedAt: 0, expiresAt: 8, weight: 2 },
      { appliedAt: 4, expiresAt: 10, weight: 3 }
    ]
  };
  state.conditionState.set('Bleeding', condition);
  const read = () => observeRuntimeEffects(state, {}).find((effect) => effect.kind === 'Bleeding');
  assert.equal(effectStateValue(read(), 0).count, 2);
  state.time = 1;
  assert.equal(effectStateValue(read(), 1).count, 2);
  condition.stacks[0].expiresAt = 3;
  reviseEffectState(condition);
  assert.equal(effectStateValue(read(), 1).expiresAt, 3);
  state.time = 3;
  assert.equal(effectStateValue(read(), 3).count, 0);
  state.time = 4;
  assert.equal(effectStateValue(read(), 4).count, 3);
  state.time = 0;
  assert.equal(effectStateValue(read(), 0).count, 2);
});

test('distinct recorder owners cannot silently take over the same effect identity', () => {
  const recorder = new EffectRecorder();
  const state = timedEffectState('charges', [{ stacks: 1, expiresAt: 5 }]);
  recorder.capture(0, [state], 'first');
  assert.throws(() => recorder.capture(1, [state], 'second'), /already belongs to first/);
});
