import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { conditionApplicationDuration } from '#gw2/platform/combat/query/combat-query.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

// Exercise the production query so player ownership reaches attributes, equipment, and real trait hooks.
const config = {
  stats: { power: 2000, conditionDamage: 1000, expertise: 150, conditionDurationBonus: 10 },
  boons: { might: 10 },
  sigilSets: [{ condition: 1.1, strike: 1.1, conditionDurationBonus: 10 }],
  target: { conditions: {} }
};
function query() {
  return createGw2CombatQuery({
    profession: resolveProfessionRuntime(thiefProfession, { specialization: 'Core' }),
    config,
    traits: new Set([TRAIT.POTENT_POISON])
  });
}

const player = {
  type: 'condition',
  at: 0,
  actorType: 'player',
  source: 'Player',
  sourceId: 'poison',
  condition: 'Poisoned',
  stacks: 1,
  duration: 1
};

test('summon conditions use player Might, condition equipment, traits, and duration without rewriting their source', () => {
  const combat = query();
  const runtime = { boons: new Map() };
  for (const summonKind of ['clone', 'minion', 'phantasm', 'spirit', 'thieves-guild']) {
    const application = Object.freeze({
      ...player,
      actorType: 'summon',
      source: summonKind,
      summonKind,
      summonOwner: `${summonKind}:1`,
      independentSummonStrike: true,
      summonBasePower: 500,
      summonBaseConditionDamage: 0,
      summonBaseExpertise: 0,
      summonIgnoresBoons: true,
      summonUsesEquipmentModifiers: false
    });
    assert.equal(combat.statsAt(0, application, runtime).conditionDamage, 1300);
    assert.equal(combat.conditionMultiplier('Poisoned', 0, application, runtime), 1.1 * 1.33);
    assert.equal(conditionApplicationDuration(combat, 'Poisoned', application, runtime), 1.63);
    assert.equal(
      conditionApplicationDuration(combat, 'Poisoned', application, runtime),
      conditionApplicationDuration(combat, 'Poisoned', player, runtime)
    );
    assert.equal(application.actorType, 'summon');
    assert.equal(application.summonUsesEquipmentModifiers, false);
  }

  recordBuffApplication(runtime.boons, {
    at: 0.2,
    kind: 'might',
    stacks: 5,
    duration: 2,
    resolvedAudience: { includesSelf: true }
  });
  const clone = { ...player, actorType: 'summon', summonKind: 'clone', source: 'Clone' };
  assert.equal(combat.statsAt(0.2, clone, runtime).conditionDamage, 1450);
  assert.equal(combat.statsAt(2.2, clone, runtime).conditionDamage, 1300);
});

test('Thieves Guild strike scaling and explicitly independent pet/mech conditions retain their own profiles', () => {
  const combat = query();
  const independent = {
    ...player,
    actorType: 'summon',
    independentSummonStrike: true,
    summonBasePower: 500,
    summonBaseConditionDamage: 0,
    summonBaseExpertise: 0,
    summonIgnoresBoons: true,
    summonUsesEquipmentModifiers: false
  };
  const strike = { ...independent, type: 'damage', coefficient: 1 };
  assert.equal(combat.statsAt(0, strike).power, 500);
  assert.equal(combat.strikeMultiplier(strike, 0), 1);
  assert.equal(combat.strikeMultiplier({ ...player, type: 'damage', coefficient: 1 }, 0), 1.1);
  for (const summonOwner of ['ranger-pet:1:0', 'engineer.mech']) {
    const condition = { ...independent, independentConditionOwner: true, summonOwner };
    assert.equal(combat.statsAt(0, condition).conditionDamage, 0);
    assert.equal(combat.conditionMultiplier('Poisoned', 0, condition), 1);
  }
});
