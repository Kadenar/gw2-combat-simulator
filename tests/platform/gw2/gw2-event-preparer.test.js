import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gw2EventOwnerActorType,
  isGw2NonWeaponEffectEvent,
  isGw2PlayerActorEvent,
  isGw2PlayerModifierOwnedEvent
} from '../../../js/platform/gw2/event-ownership.js';
import { createGw2EventPreparer } from '../../../js/platform/gw2/scheduler/event-preparer.js';
import { weaponStrengthProfileIdForEvent } from '../../../js/platform/gw2/weapon-strength.js';

test('non-weapon effect ownership has one canonical classifier', () => {
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'effect' }), true);
  for (const source of ['Trait', 'SIGIL', 'relic', 'Food', 'equipment']) {
    assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'player', source }), true, source);
  }

  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'summon', source: 'Phantasm' }), false);
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: 'player', source: ' Trait ' }), false);
  assert.equal(
    weaponStrengthProfileIdForEvent({
      type: 'damage',
      at: 0,
      source: 'Equipment',
      sourceId: 'equipment.proc',
      actorType: 'player',
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
  assert.equal(isGw2PlayerModifierOwnedEvent({ actorType: 'summon' }), false);
  assert.equal(
    gw2EventOwnerActorType({
      actorType: 'effect',
      ownerActorType: 'phantasm'
    }),
    'summon'
  );
});

test('event preparation groups related triggered packets per simulation pass', () => {
  let activationOrder = 0;
  const context = {
    catalog: {
      skillsById: new Map(),
      skillsByName: new Map()
    },
    config: { primaryWeapon: 'Dagger' },
    state: { activeWeaponSet: 1, profession: {} },
    createActivationId(kind) {
      activationOrder += 1;

      return `${kind}:test:${activationOrder}`;
    }
  };
  const preparer = createGw2EventPreparer();
  const packet = {
    type: 'damage',
    at: 1,
    source: 'Trait',
    sourceId: 'trait.proc',
    actorType: 'effect',
    skillName: 'Trait Proc',
    coefficient: 0.5,
    activationId: 'cast:7',
    triggeredBy: 'cast:7'
  };

  const first = preparer.prepare(context, packet);
  const second = preparer.prepare(context, { ...packet, at: 1.25 });
  const unrelated = preparer.prepare(context, {
    ...packet,
    at: 1.5,
    sourceId: 'trait.other'
  });

  assert.equal(first.activationId, 'effect:test:1');
  assert.equal(second.activationId, first.activationId);
  assert.equal(unrelated.activationId, 'effect:test:2');
  assert.equal(first.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(second.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(activationOrder, 2);

  const marker = {
    type: 'marker',
    at: 2,
    source: 'System',
    sourceId: 'marker'
  };

  assert.equal(preparer.prepare(context, marker), marker);
});

test('event preparation resolves capped boon recipients before handoff', () => {
  const context = {
    catalog: { skillsById: new Map(), skillsByName: new Map() },
    config: {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    state: { activeWeaponSet: 1, profession: {} },
    createActivationId: () => 'unused'
  };
  const prepared = createGw2EventPreparer().prepare(context, {
    type: 'buff',
    at: 1,
    source: 'Player',
    sourceId: 'party-fury',
    kind: 'fury',
    duration: 5,
    recipients: 'party',
    maximumRecipients: 5,
    companionIds: ['summon:one', 'summon:two']
  });

  assert.equal(prepared.affectsSelf, true);
  assert.equal(prepared.alliedPlayerCount, 4);
  assert.deepEqual(prepared.companionIds, []);
  assert.equal(prepared.affectsSummons, false);
  assert.equal(prepared.recipientCount, 5);
  assert.equal(prepared.boonAudienceResolved, true);
});
