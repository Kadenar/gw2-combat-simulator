import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

// Grouped authoring must retain the ordinary scheduler's ordering, ownership, and recipient contracts.
test('shared impacts preserve event order, local attribution and recipient ownership', () => {
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
          { type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 },
          {
            type: 'boon',
            boon: 'might',
            duration: 2,
            audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 2 },
            actorType: 'effect',
            ownerActorType: 'player',
            metadata: { packetKind: 'impact-boon' }
          },
          { type: 'condition', condition: 'Blindness', stacks: 1, duration: 1, atMs: 300 }
        ])
      }
    ]
  });
  const profession = defineTestProfession({ id: 'impacts', name: 'Impacts', catalog });
  const result = simulateGw2({ profession, rotation: ['Impact'] });
  const packets = result.events.filter((event) => ['damage', 'condition', 'buff'].includes(event.type));
  assert.deepEqual(
    packets.map(({ type, source, sourceId, skillId }) => [type, source, sourceId, skillId]),
    [
      ['buff', 'impacts', 1, 1],
      ['damage', 'impact', 2, 1],
      ['condition', 'impacts', 1, 1],
      ['condition', 'impacts', 1, 1]
    ]
  );
  assert.deepEqual(packets[0].audience, { recipients: 'party', affectsSelf: false, maximumRecipients: 2 });
  assert.equal(packets[0].actorType, 'effect');
  assert.equal(packets[0].ownerActorType, 'player');
  assert.deepEqual(packets[0].metadata, { packetKind: 'impact-boon' });
  assert.equal(Object.hasOwn(strike, 'atMs'), false);
});

// Grouping is authoring sugar: malformed timing and payloads still fail at the catalog boundary.
test('shared impacts retain canonical catalog validation', () => {
  const load = (timing, effect = { type: 'condition', condition: 'Blindness', stacks: 1, duration: 1 }) =>
    createCanonicalCatalog({
      generated: [{ id: 1, name: 'Invalid impact', effects: impactEffects(timing, [effect]) }]
    });
  for (const atMs of [NaN, Infinity, -1]) {
    assert.throws(() => load({ atMs, timingAnchor: 'castStart' }), /atMs.*finite/);
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
