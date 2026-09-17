import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { expectedCritMultiplier } from '#gw2/platform/combat/formulas.js';

// Critical units remain fractions/factors, with the existing upper chance cap and no extra lower clamp.
test('expected critical scaling uses fraction chance and factor damage', () => {
  for (const [chance, damage, expected] of [
    [0, 2, 1],
    [0.5, 2, 1.5],
    [1, 2.5, 2.5],
    [2, 2.5, 2.5],
    [-0.5, 2, 0.5]
  ])
    assert.equal(expectedCritMultiplier(chance, damage), expected);
});

// Use neutral stats and explicit packets to distinguish flooring from nearest rounding without a saved rotation.
function resolve(events, { power = 1300, multiplier = 1, health = 0, output = 'detailed' } = {}) {
  return resolveTestGw2Stream({
    output,
    stream: buildScheduledEventStream({
      events: events.map((event, index) => ({
        type: 'damage',
        at: index,
        actorType: 'player',
        source: 'Player',
        sourceId: 'rounding',
        name: 'Rounding',
        coefficient: 0.5,
        weaponStrength: 922.5,
        noCrit: true,
        ...event
      })),
      rotationEndTime: 3
    }),
    config: { target: { armor: 2597, health, conditions: {} }, sigilSets: [{ names: [] }] },
    query: {
      statsAt: () => ({ power, conditionDamage: 0 }),
      critical: () => ({ chance: 1, damage: 1.5 }),
      strikeMultiplier: () => multiplier,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: { conditionName: (name) => name, skillsByName: new Map(), weaponStrength: () => 922.5 }
  });
}

test('strike damage floors the validated no-modifier Power cases', () => {
  for (const [power, expected] of [
    [1000, 177],
    [1200, 213],
    [1300, 230],
    [1400, 248],
    [1700, 301],
    [1800, 319]
  ]) {
    const result = resolve([{}], { power });
    assert.equal(result.strikeDamage, expected);
    assert.equal(result.resolvedEvents[0].damage, expected);
  }
});

test('strike flooring happens after modifiers and applies to flat and summon packets', () => {
  assert.equal(
    resolve([{ coefficient: 0.0019, weaponStrength: 2597, noCrit: false }], { power: 1000, multiplier: 2 })
      .strikeDamage,
    5
  );
  assert.equal(resolve([{ flatDamage: 2.9, flatStrikeMultiplier: 2 }]).strikeDamage, 5);
  assert.equal(
    resolve([
      {
        coefficient: 1,
        independentSummonStrike: true,
        summonDamagePerCoefficient: 2.9,
        summonBasePower: 1300,
        summonUsesEquipmentModifiers: false
      }
    ]).strikeDamage,
    2
  );
});

test('floored packets determine target death in detailed and score simulations', () => {
  for (const output of ['detailed', 'score']) {
    const result = resolve([{ flatDamage: 2.9 }, { flatDamage: 2.9 }, { flatDamage: 2.9 }], { health: 5, output });
    assert.equal(result.strikeDamage, 6);
    assert.equal(result.deathTime, 2);
  }
});
