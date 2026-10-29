/** Minimal disable scenarios cover boon grants, ownership, cooldowns, and normal boon scaling. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RELIC_GROUPS, relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

const control = (at, overrides = {}) => ({
  type: 'control',
  at,
  source: 'Player',
  sourceId: 'fixture.disable',
  skillName: 'Disable',
  actorType: 'player',
  controlKind: 'daze',
  ...overrides
});

function run(events, { config = {}, ...options } = {}) {
  return resolveTestGw2Events({
    events,
    endTime: 20,
    config: {
      relic: 'Midnight King',
      attributeInputs: baseAttributeInputs({ concentration: 0 }),
      target: { defiant: true, conditions: {} },
      ...config
    },
    ...options
  });
}

const grants = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === `relic.${RELIC_IDS.MIDNIGHT_KING}`
  );

test('Midnight King is selectable and grants its PvE boons to self and up to four allies', () => {
  assert.equal(relicIdForName('Midnight King'), RELIC_IDS.MIDNIGHT_KING);
  assert.ok(RELIC_GROUPS.find((group) => group.label === 'Hybrid').items.includes('Midnight King'));
  const result = run([control(0)], { config: { allies: { count: 9 } } });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    grants(result).map(({ kind, duration, stacks }) => ({ kind, duration, stacks })),
    [
      { kind: 'might', duration: 9, stacks: 3 },
      { kind: 'fury', duration: 5, stacks: 1 }
    ]
  );
  for (const event of grants(result)) {
    assert.equal(event.resolvedAudience.includesSelf, true);
    assert.equal(event.resolvedAudience.alliedPlayerCount, 4);
    assert.equal(event.resolvedAudience.recipientCount, 5);
    assert.equal(event.ownerActorType, 'player');
  }
});

test('Midnight King shares one strict one-second cooldown across disables', () => {
  const result = run([control(0), control(0), control(0.999), control(1), control(1.001)]);
  assert.deepEqual(
    result.procSteps.filter((proc) => proc.skill === 'Relic of the Midnight King').map((proc) => proc.start),
    [0, 1001]
  );
  assert.deepEqual(
    grants(result).map((event) => event.at),
    [0, 0, 1.001, 1.001]
  );
});

test('Midnight King ignores missed, precombat, and non-player disables without consuming its cooldown', () => {
  const result = run(
    [
      control(0),
      control(1, { offTarget: true }),
      control(1, { actorType: 'summon' }),
      control(1, { actorType: 'effect', ownerActorType: 'player' }),
      control(1)
    ],
    { combatStartTime: 1 }
  );
  assert.deepEqual(
    grants(result).map((event) => event.at),
    [1, 1]
  );
});

test('Midnight King accepts Fear and Taunt but not movement conditions', () => {
  for (const [condition, expected] of [
    ['Fear', 2],
    ['Taunt', 2],
    ['Immobilized', 0],
    ['Crippled', 0]
  ]) {
    const result = run([
      {
        type: 'condition',
        at: 0,
        source: 'Player',
        sourceId: 'fixture.condition',
        skillName: condition,
        actorType: 'player',
        condition,
        duration: 2,
        stacks: 1
      },
      control(0.5)
    ]);
    // A disabling condition claims the cooldown before the later control; movement conditions do not.
    assert.equal(grants(result).filter((event) => event.at === 0).length, expected, condition);
    assert.equal(grants(result).filter((event) => event.at === 0.5).length, expected ? 0 : 2, condition);
  }
});

test('Midnight King boons use live concentration through standard boon resolution', () => {
  const result = run([control(0)], {
    config: { attributeInputs: baseAttributeInputs({ concentration: 1500 }) }
  });
  assert.deepEqual(
    grants(result).map(({ kind, duration }) => ({ kind, duration })),
    [
      { kind: 'might', duration: 18 },
      { kind: 'fury', duration: 10 }
    ]
  );
});
