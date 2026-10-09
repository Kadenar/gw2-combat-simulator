import assert from 'node:assert/strict';
import test from 'node:test';
import { createAlliedStrikeController } from '#gw2/platform/combat/state/allied-strikes.js';
import { combatStartedAt } from '#gw2/platform/combat/engagement.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// A controllable clock isolates grant consumption and cadence from damage formulas and reporting.
function fixture({ explicit = true, rate = 2 } = {}) {
  const runtime = {
    config: { allies: { count: 2, strikesPerSecond: rate } },
    time: 0,
    deathTime: null,
    hasExplicitCombatStart: explicit,
    combatActive: false,
    combatStartPending: explicit,
    combatStartTime: null,
    cursor: { command: explicit ? { type: 'combat-start' } : null },
    combatStartedAt() {
      return combatStartedAt(this);
    }
  };
  const queue = [];
  const controller = createAlliedStrikeController(() => runtime, {
    schedule: (at, sequence) => queue.push({ at, sequence }),
    captureCause: () => null,
    withCause: (_cause, run) => run()
  });
  const triggered = [];
  return {
    runtime,
    controller,
    queue,
    triggered,
    grant(id, extras = {}) {
      const { allyIndex = 1, ...grant } = extras;
      controller.grants.registerRecipients(
        () => ({
          id,
          expiresAt: 10,
          charges: 1,
          trigger: (event) => {
            triggered.push({ id, ...event });
          },
          ...grant
        }),
        { alliedPlayerIndex: allyIndex }
      );
    },
    advance(at) {
      while (queue[0]?.at <= at) {
        const next = queue.shift();
        runtime.time = next.at;
        controller.strike(next.sequence);
      }

      runtime.time = at;
    },
    engage() {
      runtime.combatActive = true;
      runtime.combatStartPending = false;
      runtime.combatStartTime ??= runtime.time;
      runtime.cursor.command = null;
      controller.start();
    }
  };
}

test('explicit preparation preserves live charges and real expiry without a catch-up burst', () => {
  const f = fixture();
  f.grant('expired', { expiresAt: 2 });
  f.grant('live', { charges: 2 });
  f.controller.start();
  f.advance(3);
  assert.deepEqual(f.queue, []);
  f.engage();
  f.controller.start();
  assert.equal(f.queue.length, 1);
  f.advance(3.5);
  assert.deepEqual(
    f.triggered.map(({ id, at }) => [id, at]),
    [['live', 3.5]]
  );
  f.advance(4.5);
  assert.deepEqual(
    f.triggered.map(({ id }) => id),
    ['live', 'live']
  );
});

// Hostile activity at the marker instant cannot release setup grants or move the authored anchor.
test('pending markers and late registration use the canonical engagement boundary', () => {
  const f = fixture();
  f.runtime.combatStartTime = 2;
  f.advance(2);
  f.runtime.combatActive = true;
  f.runtime.combatStartPending = false;
  f.grant('prepared');
  assert.equal(f.runtime.combatStartedAt(), false);
  assert.equal(f.queue.length, 0);
  f.engage();
  assert.equal(f.runtime.combatStartedAt(), true);
  f.advance(3);
  f.grant('late');
  assert.equal(f.queue[0].at, 3.5, 'the original combat boundary owns the cadence');
  const late = fixture();
  Object.assign(late.runtime, { time: 3.1, combatStartTime: 2, combatStartPending: false, combatActive: true });
  late.runtime.cursor.command = null;
  late.grant('first-after-marker');
  assert.equal(late.queue[0].at, 3.5, 'first registration must not become a new engagement anchor');
});

// Rejected recipients cannot run state-producing callbacks when allies have no strike opportunities.
test('zero strike rate rejects recipient creation before callbacks run', () => {
  const f = fixture({ rate: 0 });
  f.controller.grants.registerRecipients(() => {
    assert.fail('rejected recipient callback');
  });
  assert.equal(f.queue.length, 0);
});

// Native dispatch may see an opening hit before cast completion; the authored marker still owns setup exit.
test('same-time opening damage cannot move a setup completion across the combat marker', () => {
  const transitions = [];
  const source = defineTestProfession({
    id: 'engagement-fixture',
    name: 'Engagement fixture',
    catalog: createCanonicalCatalog({ generated: [{ id: 991501, name: 'Setup', castTimeMs: 500, effects: [] }] }),
    hooks: {
      onCastStart(runtime, cast) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: cast.effectiveEnd,
            priority: -300,
            coefficient: 1,
            weaponStrength: 1000,
            source: 'fixture',
            sourceId: 'opening-hit',
            actorType: 'player'
          }
        });
      },
      reactions: {
        'damage.resolved'(runtime) {
          transitions.push(['hit', runtime.combatActive, runtime.combatStartedAt()]);
        }
      },
      onCastCommit(runtime) {
        transitions.push(['commit', runtime.combatActive, runtime.combatStartedAt()]);
      },
      onCombatStart(runtime) {
        transitions.push(['marker', runtime.combatActive, runtime.combatStartedAt()]);
      }
    }
  });
  const result = observeGw2Runtime({
    profession: source.runtimeFor(),
    rotation: [{ type: 'cast', skillId: 991501 }, { type: 'combat-start' }]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(transitions, [
    ['hit', true, false],
    ['commit', true, false],
    ['marker', true, true]
  ]);
});

test('implicit combat starts without damage and a later combat notification cannot duplicate it', () => {
  const f = fixture({ explicit: false });
  f.grant('live', { charges: 3 });
  f.controller.start();
  f.advance(0.5);
  f.engage();
  f.advance(1);
  assert.deepEqual(
    f.triggered.map(({ at }) => at),
    [0.5, 1]
  );
  assert.equal(f.queue.length, 1);
});

test('application, replacement and exhaustion preserve one shared causal strike per recipient', () => {
  const f = fixture();
  f.engage();
  f.advance(0.2);
  f.grant('first');
  f.grant('second');
  f.advance(0.4);
  f.grant('first');
  f.advance(0.5);
  assert.equal(f.triggered.length, 2);
  assert.equal(f.triggered[0].activationId, f.triggered[1].activationId);
  f.advance(1.2);
  f.grant('later', { allyIndex: 2 });
  f.advance(1.5);
  assert.equal(f.triggered.at(-1).at, 1.5);
  assert.equal(f.triggered.at(-1).allyIndex, 2);
});

test('stacked batches spend in order without stealing another effect or recipient opportunity', () => {
  const f = fixture();
  f.grant('old', { consumptionGroup: 'venom' });
  f.grant('new', { consumptionGroup: 'venom' });
  f.grant('other-ally', { consumptionGroup: 'venom', allyIndex: 2 });
  f.grant('other-effect', { consumptionGroup: 'ashes' });
  f.engage();
  f.advance(0.5);
  assert.deepEqual(
    f.triggered.map(({ id }) => id),
    ['old', 'other-ally', 'other-effect']
  );
  f.advance(1);
  assert.equal(f.triggered.at(-1).id, 'new');
});

test('recipient ICDs and inclusive or exclusive expiry are evaluated on actual opportunities', () => {
  const f = fixture({ rate: 10 });
  f.grant('inclusive', { charges: 5, expiresAt: 0.3, inclusiveExpiry: true, internalCooldown: 0.2 });
  f.grant('exclusive', { charges: 5, expiresAt: 0.3, internalCooldown: 0.2 });
  f.engage();
  f.advance(0.3);
  // The 0.3 opportunity sits on both ICD deadlines; only expiry inclusivity decides which grant fires.
  assert.deepEqual(
    f.triggered.map(({ id, at }) => [id, at]),
    [
      ['inclusive', 0.1],
      ['exclusive', 0.1],
      ['inclusive', 0.3]
    ]
  );
});

test('failed eligibility keeps charges and death stops consumption and rescheduling', () => {
  const f = fixture();
  let eligible = false;
  let spent = 0;
  f.grant('conditional', {
    trigger: () => {
      if (!eligible) return false;
      spent++;
    }
  });
  f.engage();
  f.advance(0.5);
  eligible = true;
  f.advance(1);
  assert.equal(spent, 1);
  f.grant('after-death');
  f.runtime.deathTime = 1;
  f.advance(2);
  assert.deepEqual(f.triggered, []);
  assert.deepEqual(f.queue, []);
});

// Idle combat has no work; a later grant rejoins the same grid and retires after its last charge.
test('empty and exhausted controllers stay idle while later grants retain the engagement anchor', () => {
  const f = fixture();
  f.advance(0.2);
  f.engage();
  assert.equal(f.queue.length, 0);
  f.advance(1);
  f.grant('late');
  assert.equal(f.queue.length, 1);
  assert.equal(f.queue[0].at, 1.2);
  f.advance(2);
  assert.equal(f.triggered.length, 1);
  assert.equal(f.queue.length, 0);
  f.grant('too-short', { expiresAt: 2.1 });
  assert.equal(f.queue.length, 0);
  f.grant('survives');
  assert.equal(f.queue[0].at, 2.2, 'an ineligible grant must not advance the strike cursor');
});

// Recipient expansion enforces party limits and retains targeted IDs without duplicate grants.
test('recipient registration clamps counts and deduplicates selected allies', () => {
  const f = fixture({ explicit: false });
  const selected = [];
  const create = (allyIndex) => {
    selected.push(allyIndex);
    return { id: String(allyIndex), charges: 1, trigger() {} };
  };

  f.controller.grants.registerRecipients(create, { maximumAllies: 1 });
  assert.deepEqual(selected.splice(0), [1]);
  f.controller.grants.registerRecipients(create, { alliedPlayerIndex: 2 });
  assert.deepEqual(selected.splice(0), [2]);
  f.controller.grants.registerRecipients(create, { allyIndices: [0, 2, 2, 3, 1.5] });
  assert.deepEqual(selected, [2]);
});

// A callback can grant another effect without changing the current cohort's shared activation identity.
test('reentrant grants wait for the next opportunity without splitting the current cohort', () => {
  const f = fixture({ explicit: false });
  f.grant('producer', {
    trigger() {
      f.grant('new');
    }
  });
  f.grant('existing');
  f.advance(0.5);
  assert.deepEqual(
    f.triggered.map(({ id }) => id),
    ['existing']
  );
  assert.equal(f.queue.length, 1);
  f.advance(1);
  assert.equal(f.triggered.at(-1).id, 'new');
  assert.notEqual(f.triggered[0].activationId, f.triggered[1].activationId);
  assert.equal(f.queue.length, 0);
});
