import assert from 'node:assert/strict';
import test from 'node:test';
import { buffApplicationStacks, remainingDurationStackSeconds } from '#gw2/platform/combat/boons.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';

const attribution = { source: 'replay probe', sourceId: 'grant', actorType: 'player' };
const grant = (kind, priority = -1) => ({
  ...attribution,
  type: 'buff',
  at: 0,
  kind,
  stacks: 1,
  duration: 1,
  priority,
  causalOrder: 2,
  audience: { recipients: 'self' }
});
const extension = (kind) => ({
  ...attribution,
  sourceId: 'extension',
  type: 'boon_extension',
  at: 0,
  kind,
  duration: 2,
  causalOrder: 1
});

test('executed boon replay preserves priority ahead of causal order in both output modes', () => {
  // Priority makes the grant happen first; equal priority instead lets the extension run against an empty pool.
  for (const output of ['detailed', 'score']) {
    for (const kind of ['might', 'fury']) {
      for (const priority of [-1, 0]) {
        let runtime;
        const result = resolveTestGw2Events({
          events: [grant(kind, priority), extension(kind)],
          endTime: 1.5,
          output,
          engineInitialize(owner) {
            runtime = owner;
          }
        });
        const expected = priority === -1 ? 1 : 0;
        assert.deepEqual(result.warnings, []);
        assert.equal(buffApplicationStacks(runtime.boons.get(kind), kind, 1.5, 25), expected);
        assert.equal(runtime.query.timeline.buffStacksAt(kind, 1.5, 0, 25), expected);
        assert.equal(runtime.query.timeline.buffStacksAt(kind, 0.5, 0, 25), 1);
        assert.equal(runtime.query.timeline.buffStacksAt(kind, 3, 0, 25), 0);
      }
    }
  }
});

test('executed extensions invalidate cached answers on same-time append and history truncation', () => {
  // Appending an extension must change an already sampled answer without rewriting earlier observations.
  const events = [{ ...grant('might'), resolvedAudience: { includesSelf: true } }];
  const timeline = createGw2TimelineIndex({ events, resolved: true });
  assert.equal(timeline.buffStacksAt('might', 1.5, 0, 25), 0);
  events.push(extension('might'));
  assert.equal(timeline.buffStacksAt('might', 1.5, 0, 25), 1);
  assert.equal(timeline.buffStacksAt('might', 1.5, 0, 25), 1);
  assert.equal(timeline.buffStacksAt('might', 0.5, 0, 25), 1);
  events.length = 0;
  assert.equal(timeline.buffStacksAt('might', 1.5, 0, 25), 0);
});

test('summon recharge windows preserve executed extension order and recipient ownership', () => {
  // The affected companion earns Alacrity recharge through the extended window; other recipients earn none.
  const events = [
    {
      ...grant('alacrity'),
      resolvedAudience: {
        includesSelf: false,
        includesSummons: true,
        alliedPlayerCount: 0,
        companionIds: ['pet'],
        recipientCount: 1
      }
    },
    { ...extension('alacrity'), extensionAudience: 'all' }
  ];
  const timeline = createGw2TimelineIndex({ events, resolved: true });
  const skill = { id: 1, rechargeBuffAudience: 'summon' };
  assert.deepEqual([...timeline.rechargeIntervals(skill, 1, 2, 'pet')], [{ start: 1, end: 2, rate: 1.25 }]);
  assert.deepEqual([...timeline.rechargeIntervals(skill, 1, 2, 'other')], [{ start: 1, end: 2, rate: 1 }]);
  assert.deepEqual([...timeline.rechargeIntervals(skill, 3, 4, 'pet')], [{ start: 3, end: 4, rate: 1 }]);
});

test('runtime endurance recovery uses the executed Vigor extension order', () => {
  // The extra half-second of Vigor must fund recovery in both reporting modes, independently of causal tags.
  for (const output of ['detailed', 'score']) {
    for (const priority of [-1, 0]) {
      let runtime;
      const result = resolveTestGw2Events({
        profession: thiefProfession,
        config: { specialization: 'Core', boons: {}, selectedTraitIds: [] },
        events: [grant('vigor', priority), extension('vigor')],
        endTime: 1.5,
        output,
        engineInitialize(owner) {
          runtime = owner;
          runtime.endurance.spend(100);
        }
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(runtime.profession.core.endurance.value, priority === -1 ? 11.25 : 10);
    }
  }
});

test('nested immediate grants are recorded before their descendants and visible to reaction queries', () => {
  // Synchronous reactions must observe the applied parent and record each grant once in application order.
  for (const output of ['detailed', 'score']) {
    let runtime;
    const observations = [];
    const result = resolveTestGw2Events({
      events: [grant('might'), extension('might')],
      endTime: 1.5,
      output,
      engineInitialize(owner) {
        runtime = owner;
      },
      professionReactions: {
        'buff.applied'(context, event) {
          observations.push(context.combat.timeline.buffStacksAt('might', 0, 0, 25));
          if (event.sourceId === 'grant') {
            context.effects.emit({
              kind: 'packet',
              settlement: 'reaction',
              event: { ...grant('might'), sourceId: 'nested', causalOrder: 0 }
            });
          }
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(observations, [1, 2]);
    assert.deepEqual(
      runtime.history.filter((event) => event.type === 'buff').map((event) => event.sourceId),
      ['grant', 'nested']
    );
    assert.equal(runtime.query.timeline.buffStacksAt('might', 1.5, 0, 25), 2);
    assert.equal(buffApplicationStacks(runtime.boons.get('might'), 'might', 1.5, 25), 2);
  }
});

test('native No Quarter records its immediate extension once in gameplay history and detailed reports', () => {
  // The native critical reaction must extend live Fury and its historical projection using the same causal fact.
  for (const output of ['detailed', 'score']) {
    let runtime;
    let hit;
    const result = resolveTestGw2Events({
      profession: thiefProfession,
      config: { specialization: 'Core', boons: {}, selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER] },
      endTime: 3,
      output,
      engineInitialize(owner) {
        runtime = owner;
        runtime.effects.emit({ kind: 'packet', event: { ...grant('fury'), duration: 2 } });
        hit = runtime.effects.emit({
          kind: 'packet',
          receipt: true,
          event: { ...attribution, type: 'damage', at: 1, coefficient: 1, forceCrit: true, weaponStrength: 1000 }
        });
      }
    });
    assert.deepEqual(result.warnings, []);
    const extensions = runtime.history.filter((event) => event.type === 'boon_extension');
    assert.equal(extensions.length, 1);
    const fact = extensions[0];
    assert.equal(fact.sourceId, THIEF_TRAIT_IDS.NO_QUARTER);
    assert.equal(fact.at, hit.at);
    assert.equal(fact.parentEventOrder, hit.eventOrder);
    assert.equal(fact.causalOrder, hit.causalOrder);
    assert.equal(
      remainingDurationStackSeconds(runtime.boons.get('fury'), 1, {
        includes: (application) => application.resolvedAudience.includesSelf,
        maximum: 30
      }),
      1 + fact.duration
    );
    for (const [at, expected] of [
      [3, 1],
      [2 + fact.duration, 0]
    ]) {
      assert.equal(buffApplicationStacks(runtime.boons.get('fury'), 'fury', at, 1), expected);
      assert.equal(runtime.query.timeline.buffStacksAt('fury', at, 0, 1), expected);
    }

    if (output === 'detailed') {
      for (const events of [result.events, result.resolvedEvents]) {
        const recorded = events.filter((event) => event.type === 'boon_extension');
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0].eventOrder, fact.eventOrder);
        assert.equal(recorded[0].parentEventOrder, fact.parentEventOrder);
      }
    }
  }
});

test('a nested extension is visible immediately and follows its grant without extending other recipients', () => {
  // The caller can query the extension before returning; history preserves the parent grant and self-only scope.
  for (const output of ['detailed', 'score']) {
    for (const kind of ['might', 'fury']) {
      let runtime;
      let parent;
      let receipt;
      const result = resolveTestGw2Events({
        events: [
          {
            ...grant(kind),
            resolvedAudience: {
              includesSelf: true,
              includesSummons: true,
              alliedPlayerCount: 0,
              companionIds: ['pet'],
              recipientCount: 2
            }
          }
        ],
        endTime: 1.5,
        output,
        engineInitialize(owner) {
          runtime = owner;
        },
        professionReactions: {
          'buff.applied'(context, event) {
            parent = event;
            assert.equal(context.combat.timeline.buffStacksAt(kind, 1.5, 0, 25), 0);
            receipt = context.effects.emit({
              kind: 'packet',
              settlement: 'reaction',
              receipt: true,
              cause: event,
              event: extension(kind)
            });
            assert.equal(buffApplicationStacks(context.combat.boonApplications(kind), kind, 1.5, 25), 1);
            assert.equal(context.combat.timeline.buffStacksAt(kind, 1.5, 0, 25), 1);
            assert.equal(context.combat.timeline.buffStacksAt(kind, 1.5, 0, 25, 'summon', 'pet'), 0);
          }
        }
      });
      assert.deepEqual(result.warnings, []);
      const facts = runtime.history.filter((event) => event.type === 'buff' || event.type === 'boon_extension');
      assert.deepEqual(
        facts.map((event) => event.type),
        ['buff', 'boon_extension']
      );
      assert.equal(facts[1].eventOrder, receipt.eventOrder);
      assert.equal(facts[1].parentEventOrder, parent.eventOrder);
      assert.equal(facts[1].at, parent.at);
      assert.equal(runtime.query.timeline.buffStacksAt(kind, 3, 0, 25), 0);
      assert.equal(buffApplicationStacks(runtime.boons.get(kind), kind, 3, 25), 0);
    }
  }
});

test('an immediate extension records execution without resurrecting an expired boon', () => {
  // An extension can execute successfully after expiry while leaving the expired pool empty in live and replay queries.
  let runtime;
  const result = resolveTestGw2Events({
    events: [grant('fury'), { ...grant('might'), at: 1 }],
    endTime: 2,
    engineInitialize(owner) {
      runtime = owner;
    },
    professionReactions: {
      'buff.applied'(context, event) {
        if (event.kind !== 'might') return;
        context.effects.emit({
          kind: 'packet',
          settlement: 'reaction',
          cause: event,
          event: { ...extension('fury'), at: event.at }
        });
        assert.equal(context.combat.timeline.buffStacksAt('fury', event.at, 0, 1), 0);
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(runtime.history.filter((event) => event.type === 'boon_extension').length, 1);
  assert.equal(buffApplicationStacks(runtime.boons.get('fury'), 'fury', 2, 1), 0);
  assert.equal(runtime.query.timeline.buffStacksAt('fury', 2, 0, 1), 0);
});
