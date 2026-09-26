import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gw2EventOwnerActorType,
  isGw2NonWeaponEffectEvent,
  isGw2PlayerActorEvent,
  isGw2PlayerModifierOwnedEvent
} from '#gw2/platform/combat/state/event-ownership.js';
import { weaponStrengthProfileIdForEvent } from '#gw2/platform/equipment/weapons/strength.js';

test('non-weapon effect ownership has one canonical classifier', () => {
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'effect' }), true);
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'environment' }), true);
  // Display labels cannot override explicit ownership or fill in missing ownership.
  for (const source of ['Player', 'Trait', 'SIGIL', 'relic', 'Food', 'equipment']) {
    assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'player', source }), false, source);
    assert.equal(isGw2NonWeaponEffectEvent({ source }), false, source);
    assert.equal(isGw2PlayerActorEvent({ source }), false, source);
    assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'effect', source }), true, source);
  }

  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'summon', source: 'Phantasm' }), false);
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'player', source: ' Trait ' }), false);
  assert.equal(
    weaponStrengthProfileIdForEvent({
      type: 'damage',
      at: 0,
      source: 'Equipment',
      sourceId: 'equipment.proc',
      actorType: 'effect',
      coefficient: 1
    }),
    'nonweapon.unequipped'
  );
});

test('modifier ownership is independent from proc actor ownership', () => {
  const playerOwnedEffect = {
    actorType: 'effect',
    ownerActorType: 'player'
  };

  assert.equal(isGw2PlayerActorEvent(playerOwnedEffect), false);
  assert.equal(isGw2PlayerModifierOwnedEvent(playerOwnedEffect), true);
  assert.equal(gw2EventOwnerActorType(playerOwnedEffect), 'player');
  assert.equal(isGw2PlayerModifierOwnedEvent({ actorType: 'effect' }), false);
  assert.equal(isGw2PlayerModifierOwnedEvent({ actorType: 'effect', ownerActorType: 'summon' }), false);
  assert.equal(isGw2PlayerModifierOwnedEvent({ actorType: 'summon' }), false);
  assert.equal(isGw2PlayerActorEvent({ actorType: 'environment' }), false);
  assert.equal(isGw2PlayerModifierOwnedEvent({ actorType: 'environment' }), false);
  assert.equal(gw2EventOwnerActorType({ actorType: 'environment' }), 'environment');
  assert.equal(
    gw2EventOwnerActorType({
      actorType: 'effect',
      ownerActorType: 'summon'
    }),
    'summon'
  );
});
