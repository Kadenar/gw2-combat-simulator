// Exercise spear ownership through its hook interface while retaining real catalog identities and state.
import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareElementalistHitboxEvent } from '#gw2/professions/elementalist/core/mechanics/hitbox.js';
import {
  createElementalistSpearLifecycle,
  openElementalistEtching
} from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';

function spearContext() {
  return {
    time: 0,
    helpers: elementalistCatalog,
    profession: { core: createElementalistCoreState() },
    schedule() {}
  };
}

test('shared observers run before spear capture and after progression while the accepted snapshot remains live', () => {
  const context = spearContext();
  const root = elementalistCatalog.skillsById.get(ID.ETCHING_VOLCANO);
  const cast = { id: 'spear', skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE) };
  const core = context.profession.core;
  let observed = false;
  openElementalistEtching(context, root);
  const lifecycle = createElementalistSpearLifecycle({
    onCastStart(runtime) {
      runtime.profession.core.spearNextDamageBonus = true;
    },
    onCastCommit(runtime, accepted) {
      assert.equal(runtime.profession.core.etchings[root.name].otherCasts, 1);
      assert.equal(runtime.profession.core.spearFollowups[accepted.id].damage, true);
      observed = true;
    }
  });
  lifecycle.onCastStart(context, cast);
  assert.equal(core.spearNextDamageBonus, false);
  lifecycle.onCastCommit(context, cast);
  assert.equal(observed, true);
  assert.deepEqual(core.spearFollowups, {});
});

test('hitbox exclusion and suppressed packets preserve the spear control rider for an eligible strike', () => {
  const context = spearContext();
  const emissions = [];
  context.combat = { targetHitboxSize: () => 'small' };
  context.effects = { emit: (request) => emissions.push(request) };
  const core = context.profession.core;
  core.spearNextControlHit = true;
  const lifecycle = createElementalistSpearLifecycle({ prepareEvent: prepareElementalistHitboxEvent });
  const cast = { id: 'spear', skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE) };
  lifecycle.onCastStart(context, cast);
  const packet = { type: 'damage', at: 0, coefficient: 1, activationId: cast.id };
  const excluded = lifecycle.prepareEvent(context, { ...packet, metadata: { largeHitboxOnly: true } });
  assert.equal(excluded.type, 'marker');
  assert.equal(core.spearFollowups[cast.id].control, true);
  const suppressed = createElementalistSpearLifecycle({ prepareEvent: () => null });
  assert.equal(suppressed.prepareEvent(context, packet), null);
  assert.equal(core.spearFollowups[cast.id].control, true);
  assert.deepEqual(emissions, []);
  lifecycle.prepareEvent(context, packet);
  lifecycle.prepareEvent(context, packet);
  assert.equal(emissions.length, 1);
  assert.equal(core.spearFollowups[cast.id].control, false);
});

test('cancelled activations preserve armed bonuses and earn etching credit only after activation begins', () => {
  for (const effectiveEnd of [0, 1]) {
    const context = spearContext();
    const core = context.profession.core;
    const root = elementalistCatalog.skillsById.get(ID.ETCHING_VOLCANO);
    openElementalistEtching(context, root);
    core.spearNextDamageBonus = true;
    const lifecycle = createElementalistSpearLifecycle({
      onCastStart: () => assert.fail('Cancelled starts must not run shared observers.')
    });
    const cast = {
      id: 'cancelled',
      skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE),
      start: 0,
      effectiveEnd,
      cancelledBeforeCommit: true
    };
    lifecycle.onCastStart(context, cast);
    lifecycle.onCastCancel(context, cast);
    assert.equal(core.spearNextDamageBonus, true);
    assert.equal(core.etchings[root.name].otherCasts, Number(effectiveEnd > cast.start));
    assert.deepEqual(core.spearFollowups, {});
  }
});
