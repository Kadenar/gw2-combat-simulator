import assert from 'node:assert/strict';
import test from 'node:test';
import { createAlliedStrikeController } from '#gw2/platform/combat/state/allied-strikes.js';

// A controllable clock isolates grant consumption and cadence from damage formulas and reporting.
function fixture({ explicit = true, rate = 2 } = {}) {
  const runtime = {
    config: { allies: { count: 2, strikesPerSecond: rate } },
    time: 0,
    deathTime: null,
    hasExplicitCombatStart: explicit,
    combatActive: false
  };
  const queue = [];
  const controller = createAlliedStrikeController(
    () => runtime,
    (at, sequence) => queue.push({ at, sequence })
  );
  const triggered = [];
  return {
    runtime,
    controller,
    queue,
    triggered,
    grant(id, extras = {}) {
      controller.grants.register({
        id,
        allyIndex: 1,
        expiresAt: 10,
        charges: 1,
        trigger: (event) => {
          triggered.push({ id, ...event });
        },
        ...extras
      });
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
