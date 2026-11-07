import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conditionDamageOwner,
  conditionOwnerEvent,
  gw2EventActorType,
  gw2EventOwnerActorType,
  isIndependentConditionOwner
} from '#gw2/platform/combat/state/event-ownership.js';

// Unknown metadata must remain conservative; explicit ownership overrides a valid actor only when recognized.
test('ownership accepts canonical actors and preserves unknown and owner fallback semantics', () => {
  for (const actorType of ['player', 'summon', 'effect', 'environment', 'unknown']) {
    assert.equal(gw2EventActorType({ actorType }), actorType);
    assert.equal(gw2EventOwnerActorType({ actorType }), actorType);
    assert.equal(gw2EventOwnerActorType({ actorType, ownerActorType: 'player' }), 'player');
    assert.equal(gw2EventOwnerActorType({ actorType, ownerActorType: 'invalid' }), actorType);
  }

  for (const event of [null, undefined, {}, { actorType: 'Player' }, { actorType: 'toString' }, { source: 'Player' }]) {
    assert.equal(gw2EventActorType(event), 'unknown');
    assert.equal(gw2EventOwnerActorType(event), 'unknown');
  }
});

// Calculation projections must not overwrite attribution or merge unrelated independent condition applications.
test('condition inheritance shares player bonuses while preserving independent owner identity', () => {
  const summon = Object.freeze({
    actorType: 'summon',
    summonOwner: 'companion:1',
    summonUsesEquipmentModifiers: false
  });
  assert.equal(conditionDamageOwner(summon), 'player');
  assert.equal(isIndependentConditionOwner(summon), false);
  const projected = conditionOwnerEvent(summon);
  assert.equal(projected.actorType, 'player');
  assert.equal(projected.summonUsesEquipmentModifiers, true);
  assert.equal(summon.actorType, 'summon');
  assert.equal(summon.summonUsesEquipmentModifiers, false);

  const independent = Object.freeze({ ...summon, independentConditionOwner: true });
  assert.equal(isIndependentConditionOwner(independent), true);
  assert.equal(isIndependentConditionOwner({ ...independent, independentConditionOwner: false }), false);
  for (const actorType of ['player', 'effect', 'environment', 'unknown']) {
    assert.equal(isIndependentConditionOwner({ ...independent, actorType }), false);
  }

  assert.equal(isIndependentConditionOwner(null), false);
  assert.equal(isIndependentConditionOwner(undefined), false);
  assert.equal(conditionOwnerEvent(independent), independent);
  assert.equal(conditionDamageOwner(independent), 'summon:companion:1');
  assert.equal(conditionDamageOwner({ ...independent }), conditionDamageOwner(independent));
  assert.notEqual(
    conditionDamageOwner({ ...independent, summonOwner: 'companion:2' }),
    conditionDamageOwner(independent)
  );

  for (const application of [
    { actorType: 'summon', independentConditionOwner: true },
    { actorType: 'effect' },
    { actorType: 'unknown', ownerActorType: 'player' }
  ]) {
    assert.equal(conditionDamageOwner(application), application);
    assert.notEqual(conditionDamageOwner({ ...application }), conditionDamageOwner(application));
  }

  assert.equal(conditionDamageOwner({ actorType: 'effect', ownerActorType: 'player' }), 'player');
});
