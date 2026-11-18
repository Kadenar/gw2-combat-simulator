import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createLiveEffects } from '#gw2/platform/combat/live-effects.js';
import { appliedEffectStacks } from '#gw2/platform/combat/query/effect-stacks.js';
import { createGw2ComboController } from '#gw2/platform/combos/resolution.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createTestConditionResolution } from '#tests/helpers/condition-resolution.js';

const player = { actor: 'player' };
const pet = (companionId) => ({ actor: 'companion', companionId });
const grant = (kind, fields = {}) => ({
  type: 'buff',
  kind,
  at: 0,
  duration: 4,
  stacks: 1,
  audience: { recipients: 'self' },
  ...fields
});

// Admission copies caller packets; readonly observations reuse records until an explicit revision replaces them.
test('live effects isolate input packets and preserve prior observations across revisions', () => {
  const effects = createLiveEffects();
  const event = grant('charges', { audience: { recipients: 'summons', eligibleCompanionIds: ['pet'] } });
  effects.grant(event);
  event.duration = 99;
  event.audience.eligibleCompanionIds.push('other');
  const first = effects.queries.buffApplications('charges');
  assert.equal(effects.queries.latestApplication('charges', 1), first[0]);
  assert.equal(effects.queries.latestApplication('charges', -1), undefined);
  assert.equal(effects.queries.latestApplication('charges', 1, player), first[0]);
  assert.equal(effects.queries.latestApplication('charges', 1, pet('other')), undefined);
  const policy = { kind: 'charges', maximumStacks: 25 };
  const states = effects.queries.effectStates('charges', 1, policy, false);
  assert.equal(effects.queries.effectStates('charges', 1, policy, false), states);
  assert.equal(first[0].expiresAt, 4);
  assert.deepEqual(first[0].event.audience.eligibleCompanionIds, ['pet']);
  assert.equal(effects.queries.buffApplications('charges'), first);
  assert.throws(() => first.push(first[0]), TypeError);
  effects.reviseBuffExpiry(
    'charges',
    (application) => {
      assert.equal(application.expiresAt, 4);
      return true;
    },
    () => 2
  );
  assert.equal(first[0].expiresAt, 4);
  assert.equal(effects.queries.buffApplications('charges')[0].expiresAt, 2);
  assert.equal(states[0].windows[0].expiresAt, 4);
  assert.equal(effects.queries.effectStates('charges', 1, policy, false)[0].windows[0].expiresAt, 2);
  assert.equal(effects.queries.stacks('charges', 1, 25, pet('pet')), 1);
  assert.equal(effects.queries.stacks('charges', 2.000001, 25, pet('pet')), 0);
  assert.equal(effects.queries.stacks('charges', 1, 25, pet('other')), 0);
});

test('same-time grants and extensions invalidate observations without changing earlier queries', () => {
  const effects = createLiveEffects();
  effects.grant(grant('fury', { duration: 2 }));
  const first = effects.queries.boonApplications('fury');
  assert.equal(effects.queries.stacks('fury', 0, 1), 1);
  effects.grant(grant('fury', { duration: 2 }), (audience) => {
    // Accounting sees resolved recipients before this grant changes live stacks or histories.
    assert.equal(audience.includesSelf, true);
    assert.equal(effects.queries.boonApplications('fury'), first);
  });
  assert.equal(first.length, 1);
  assert.equal(effects.queries.boonApplications('fury').length, 2);
  assert.equal(effects.queries.boonApplications('fury')[0], first[0]);
  assert.equal(effects.queries.stacks('fury', 3, 1), 1);
  effects.extend({ type: 'boon_extension', kind: 'fury', at: 3, duration: 2 });
  assert.deepEqual(effects.queries.boonSnapshot('fury', 3, player), { stacks: 1, duration: 3 });
  assert.equal(effects.queries.boonDuration('fury', 3), 3);
  assert.equal(effects.queries.boonDuration('fury', 2), 2);
  assert.deepEqual(effects.queries.boonSnapshot('fury', 2, player), { stacks: 1, duration: 2 });
  assert.equal(effects.queries.stacks('fury', 6.000001, 1), 0);
  effects.extend({ type: 'boon_extension', kind: 'fury', at: 6.000001, duration: 2 });
  assert.equal(effects.queries.stacks('fury', 6.000001, 1), 0);
});

test('retirement disposes only the named recipient and rejects its delayed grants', () => {
  const effects = createLiveEffects();
  const shared = grant('might', {
    stacks: 3,
    audience: { recipients: 'party', eligibleCompanionIds: ['old', 'other'] }
  });
  effects.grant(shared);
  const history = effects.queries.boonApplications('might');
  assert.equal(effects.retireCompanion('old', 1), true);
  assert.equal(effects.retireCompanion('old', 2), false);
  assert.equal(effects.queries.retirementCount, 1);
  assert.equal(effects.queries.companionRetiredAt('old'), 1);
  assert.equal(effects.queries.boonApplications('might'), history);
  assert.equal(effects.queries.stacks('might', 1, 25, player), 3);
  assert.equal(effects.queries.stacks('might', 1, 25, pet('other')), 3);
  assert.equal(effects.queries.stacks('might', 1, 25, pet('old')), 0);
  const delayed = { ...shared, at: 1 };
  effects.grant(delayed, (audience) => assert.deepEqual(audience.companionIds, ['other']));
  assert.equal(effects.queries.stacks('might', 1, 25, pet('other')), 6);
  assert.equal(effects.queries.stacks('might', 1, 25, pet('new')), 0);
  effects.grant({ ...shared, at: 2 });
  assert.equal(effects.queries.stacks('might', 2, 25, pet('old')), 0);
});

test('retired history remains available only through timeline-backed queries', () => {
  const liveEffects = createLiveEffects();
  const event = grant('fury', {
    audience: { recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] }
  });
  liveEffects.grant(event, (audience) => {
    event.resolvedAudience = audience;
  });
  let retirements = 0;
  const runtime = createGw2ResolverRuntimeState({
    combo: createGw2ComboController(),

    config: {},
    liveEffects,
    conditions: {
      ...createTestConditionResolution(),
      retireCompanionConditions() {
        retirements++;
      }
    }
  });
  const combat = runtime.combat;
  // Even JavaScript callers cannot bypass condition retirement through the shared runtime.
  for (const name of ['grant', 'extend', 'reviseBuffExpiry', 'retireCompanion'])
    assert.equal(name in runtime.liveEffects, false);
  for (const name of ['register', 'resolve', 'bind', 'expireField']) assert.equal(name in runtime.combo, false);
  assert.equal(Object.isFrozen(runtime.liveEffects), true);
  assert.equal(Object.isFrozen(runtime.combo), true);
  combat.retireCompanion('pet', 2);
  combat.retireCompanion('pet', 3);
  assert.equal(retirements, 1);
  const timeline = createGw2TimelineIndex({
    events: [event, { type: 'marker', action: 'companion-retired', at: 2, summonOwner: 'pet' }]
  });
  assert.equal(appliedEffectStacks({ runtime, timeline, time: 1 }, 'fury', 1, pet('pet')), 1);
  assert.equal(appliedEffectStacks({ runtime, timeline, time: 2 }, 'fury', 1, pet('pet')), 0);
  assert.equal(combat.activeBoonStacks('fury', 1, 1, pet('pet')), 0);
  assert.equal(combat.boonDuration('fury', 1, pet('pet')), 0);
  assert.deepEqual(combat.boonSnapshot('fury', 1, pet('pet')), { stacks: 0, duration: 0 });
});

test('recipient selection preserves sharing settings and isolates ordinary buffs from extensions', () => {
  const effects = createLiveEffects({ sharePlayerBoonsWithSummons: false });
  const audience = { recipients: 'party', eligibleCompanionIds: ['pet'] };
  effects.grant(grant('might', { audience }));
  effects.grant(grant('charges', { audience }));
  assert.equal(effects.queries.stacks('might', 1, 25, pet('pet')), 0);
  assert.equal(effects.queries.stacks('charges', 1, 25, pet('pet')), 1);
  effects.extend({ type: 'boon_extension', at: 1, duration: 4, extensionAudience: 'all' });
  assert.equal(effects.queries.stacks('charges', 4.000001, 25, pet('pet')), 0);
  assert.equal(effects.queries.stacks('might', 4, 25, player), 1);
  assert.deepEqual(effects.queries.boonApplications('charges'), []);
  assert.deepEqual(effects.queries.buffApplications('might'), []);
  const configured = createLiveEffects({ boons: { fury: true } });
  assert.equal(configured.queries.boonDuration('fury', 0), 0);
});
