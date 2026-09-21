import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { strikeTimeline, conditionTimeline, impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { castCompleted, castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { EPSILON } from '#kernel/core/clock.js';

// Grouped authoring must retain the ordinary scheduler's ordering, ownership, and recipient contracts.
test('shared impacts schedule ordered effects with local attribution and timing overrides', () => {
  const timing = Object.freeze({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' });
  const strike = Object.freeze({ type: 'strike', coefficient: 1, source: 'impact', sourceId: 2 });
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: 'Impact',
        type: 'Utility',
        castTimeMs: 400,
        effects: impactEffects(timing, [
          strike,
          { type: 'blind', duration: 3 },
          {
            type: 'boon',
            boon: 'might',
            duration: 2,
            audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 2 },
            actorType: 'effect',
            ownerActorType: 'player',
            metadata: { packetKind: 'impact-boon' }
          },
          { type: 'blind', duration: 1, atMs: 300 }
        ])
      }
    ]
  });
  const profession = defineProfession({ id: 'impacts', name: 'Impacts', catalog });
  const result = simulateGw2({ profession, rotation: ['Impact'] });
  const packets = result.events.filter((event) => ['damage', 'blind', 'buff'].includes(event.type));
  assert.deepEqual(
    packets.map(({ type, at, source, sourceId, skillId }) => [type, at, source, sourceId, skillId]),
    [
      ['damage', 0.2, 'impact', 2, 1],
      ['blind', 0.2, 'impacts', 1, 1],
      ['buff', 0.2, 'impacts', 1, 1],
      ['blind', 0.3, 'impacts', 1, 1]
    ]
  );
  assert.deepEqual(packets[2].audience, { recipients: 'party', affectsSelf: false, maximumRecipients: 2 });
  assert.equal(packets[2].actorType, 'effect');
  assert.equal(packets[2].ownerActorType, 'player');
  assert.deepEqual(packets[2].metadata, { packetKind: 'impact-boon' });
  assert.equal(Object.hasOwn(strike, 'atMs'), false);
});

// Shared defaults must preserve whole timelines and interval streams, including simultaneous hit identities.
test('shared timeline defaults preserve packet indices and same-time scheduling order', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: 'Pulses',
        type: 'Utility',
        castTimeMs: 400,
        effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
          strikeTimeline([
            { atMs: 100, coefficient: 1 },
            { atMs: 300, coefficient: 1 },
            { atMs: 300, coefficient: 1 }
          ]),
          conditionTimeline([
            { atMs: 100, condition: 'Bleeding', stacks: 1, duration: 1 },
            { atMs: 300, condition: 'Bleeding', stacks: 1, duration: 1 }
          ]),
          { type: 'boon', boon: 'might', duration: 1, applications: 2, atMs: 100, intervalMs: 200 }
        ])
      }
    ]
  });
  const profession = defineProfession({ id: 'pulses', name: 'Pulses', catalog });
  const result = simulateGw2({ profession, rotation: ['Pulses'] });
  const packets = result.events.filter((event) => ['damage', 'condition', 'buff'].includes(event.type));
  assert.deepEqual(
    packets.map((event) => [
      event.type,
      Math.round(event.at * 1000),
      event.hitIndex ?? event.applicationIndex,
      event.totalHits ?? event.totalApplications
    ]),
    [
      ['damage', 100, 1, 3],
      ['condition', 100, 1, 2],
      ['buff', 100, 1, 2],
      ['damage', 300, 2, 3],
      ['damage', 300, 3, 3],
      ['condition', 300, 2, 2],
      ['buff', 300, 2, 2]
    ]
  );
});

// Grouping is authoring sugar: malformed timing and payloads still fail at the catalog boundary.
test('shared impacts retain canonical catalog validation', () => {
  const load = (timing, effect = { type: 'blind', duration: 1 }) =>
    createCanonicalCatalog({
      generated: [{ id: 1, name: 'Invalid impact', effects: impactEffects(timing, [effect]) }]
    });
  for (const atMs of [NaN, Infinity, -1]) {
    assert.throws(() => load({ atMs, timingAnchor: 'castStart' }), /Effect atMs must be finite/);
  }

  assert.throws(() => load({ atMs: 1, timingAnchor: 'invalid' }), /timingAnchor/);
  assert.throws(() => load({ atMs: 1, timingScale: 'invalid' }), /timingScale/);
  assert.throws(() => load({ atMs: 1 }, { type: 'invalid' }), /effect type/i);
  assert.throws(
    () => load({ atMs: 1 }, { type: 'strike', ticks: [{ atMs: 1, coefficient: 1 }] }),
    /cannot use aggregate/
  );
  assert.throws(
    () => load({ atMs: 1 }, { type: 'boon', boon: 'might', duration: 1, audience: { recipients: 'invalid' } }),
    /audience recipients/
  );
});

// Minimal packet sequences cover scheduling contracts without calibrating individual skills.
test('declarative packets retain coefficients, shared timestamps, and application order', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: 'Packets',
        type: 'Utility',
        castTimeMs: 400,
        effects: [
          strikeTimeline(
            [
              { atMs: 100, coefficient: 0.2 },
              { atMs: 400, coefficient: 0.5 },
              { atMs: 400, coefficient: 0.3 }
            ],
            { timingAnchor: 'castStart', timingScale: 'cast' }
          ),
          conditionTimeline(
            [
              { atMs: 200, condition: 'Burning', stacks: 1, duration: 2 },
              { atMs: 400, condition: 'Poisoned', stacks: 2, duration: 3 }
            ],
            { timingAnchor: 'castStart', timingScale: 'cast' }
          )
        ]
      }
    ]
  });
  const profession = defineProfession({ id: 'packets', name: 'Packets', catalog });
  const result = simulateGw2({ profession, rotation: ['Packets'] });
  assert.deepEqual(
    result.events.filter((e) => e.type === 'damage').map((e) => [e.at, e.coefficient]),
    [
      [0.1, 0.2],
      [0.4, 0.5],
      [0.4, 0.3]
    ]
  );
  assert.deepEqual(
    result.events.filter((e) => e.type === 'condition').map((e) => [e.at, e.condition, e.stacks]),
    [
      [0.2, 'Burning', 1],
      [0.4, 'Poisoned', 2]
    ]
  );
});

test('runtime variants scale cast-bound launch timing while fixed pulse spacing and anchors survive', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: 'Pulses',
        type: 'Utility',
        castTimeMs: 400,
        effects: [
          {
            type: 'strike',
            ticks: [200, 1200, 2200].map((atMs) => ({ atMs, coefficient: 0.1 })),
            timingAnchor: 'castStart',
            timingScale: 'cast',
            intervalTimingScale: 'fixed'
          },
          {
            type: 'blind',
            applications: 3,
            atMs: 200,
            intervalMs: 1000,
            timingAnchor: 'castStart',
            timingScale: 'cast',
            intervalTimingScale: 'fixed'
          },
          {
            type: 'condition',
            condition: 'Crippled',
            stacks: 1,
            duration: 2,
            applications: 3,
            atMs: 200,
            intervalMs: 1000,
            timingAnchor: 'castStart',
            timingScale: 'cast',
            intervalTimingScale: 'fixed'
          },
          {
            type: 'boon',
            boon: 'Might',
            stacks: 1,
            duration: 1,
            atMs: 100,
            timingAnchor: 'castEnd',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  });
  for (const multiplier of [1, 2]) {
    const profession = defineProfession({
      id: 'pulses',
      name: 'Pulses',
      catalog,
      castRules: { modifyCastDuration: (_context, duration) => duration * multiplier }
    });
    const result = simulateGw2({ profession, rotation: ['Pulses', { type: 'wait', durationMs: 3000 }] });
    for (const type of ['damage', 'blind', 'condition']) {
      assert.deepEqual(
        result.events.filter((e) => e.type === type).map((e) => Math.round(e.at * 1000)),
        [200 * multiplier, 200 * multiplier + 1000, 200 * multiplier + 2000]
      );
    }

    assert.equal(Math.round(result.events.find((e) => e.type === 'buff').at * 1000), 400 * multiplier + 100);
  }
});

// The cast-interrupt predicates replace the comparison that was inlined at 33 call sites; pin the boundary.
test('cast interrupt predicates split on the epsilon-tolerant full-duration boundary', () => {
  const fullEnd = 4;
  assert.equal(castWasInterrupted({ fullEnd, effectiveEnd: fullEnd }), false);
  assert.equal(castCompleted({ fullEnd, effectiveEnd: fullEnd }), true);

  // An end short by less than the clock tolerance still counts as a completed cast.
  assert.equal(castWasInterrupted({ fullEnd, effectiveEnd: fullEnd - EPSILON / 2 }), false);
  assert.equal(castCompleted({ fullEnd, effectiveEnd: fullEnd - EPSILON / 2 }), true);

  assert.equal(castWasInterrupted({ fullEnd, effectiveEnd: fullEnd - 2 * EPSILON }), true);
  assert.equal(castCompleted({ fullEnd, effectiveEnd: fullEnd - 2 * EPSILON }), false);

  // Each predicate states its own comparison, so a non-finite end is neither interrupted nor completed.
  assert.equal(castWasInterrupted({ fullEnd, effectiveEnd: Number.NaN }), false);
  assert.equal(castCompleted({ fullEnd, effectiveEnd: Number.NaN }), false);
});
