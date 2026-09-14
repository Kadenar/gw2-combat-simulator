import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2EventActorType, gw2EventOwnerActorType } from '#gw2/platform/combat/state/event-ownership.js';

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
