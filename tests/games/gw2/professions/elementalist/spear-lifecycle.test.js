// Exercise spear ordering through the same Core hooks used by the simulator.
import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { openElementalistEtching } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { elementalistCastCompleted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';

function spearContext() {
  return {
    time: 0,
    config: {},
    helpers: elementalistCatalog,
    profession: { core: createElementalistCoreState() },
    fireTrigger() {},
    schedule() {}
  };
}

test('Core commit observers see the credited etching and the accepted spear bonus before cleanup', () => {
  const context = spearContext();
  const root = elementalistCatalog.skillsById.get(ID.ETCHING_VOLCANO);
  const cast = { id: 'spear', skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE) };
  const core = context.profession.core;
  let observed = false;
  openElementalistEtching(context, root);
  core.spearNextDamageBonus = true;
  context.fireTrigger = (trigger, { cast: accepted }) => {
    if (trigger !== elementalistCastCompleted) return;

    assert.equal(core.etchings[root.name].otherCasts, 1);
    assert.equal(core.spearFollowups[accepted.id].damage, true);
    observed = true;
  };

  elementalistCoreHooks.onCastStart(context, cast);
  assert.equal(core.spearNextDamageBonus, false);
  elementalistCoreHooks.onCastCommit(context, cast);
  assert.equal(observed, true);
  assert.deepEqual(core.spearFollowups, {});
});

test('Core hitbox filtering preserves the spear control bonus for the next eligible strike', () => {
  const context = spearContext();
  const emissions = [];
  context.combat = { targetHitboxSize: () => 'small' };
  context.effects = { emit: (request) => emissions.push(request) };
  const core = context.profession.core;
  core.spearNextControlHit = true;
  const cast = { id: 'spear', skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE) };
  elementalistCoreHooks.onCastStart(context, cast);
  const packet = { type: 'damage', at: 0, coefficient: 1, activationId: cast.id };
  const excluded = elementalistCoreHooks.prepareEvent(context, { ...packet, metadata: { largeHitboxOnly: true } });
  assert.equal(excluded.type, 'marker');
  assert.equal(core.spearFollowups[cast.id].control, true);
  assert.deepEqual(emissions, []);
  elementalistCoreHooks.prepareEvent(context, packet);
  elementalistCoreHooks.prepareEvent(context, packet);
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
    context.config.selectedSkillIds = [ID.GLYPH_OF_ELEMENTALS];
    const cast = {
      id: 'cancelled',
      skill: elementalistCatalog.skillsById.get(ID.BLAZING_BARRAGE),
      start: 0,
      effectiveEnd,
      cancelledBeforeCommit: true
    };
    elementalistCoreHooks.onCastStart(context, cast);
    elementalistCoreHooks.onCastCancel(context, cast);
    assert.equal(core.summonedElemental.summonGeneration, 0);
    assert.equal(core.spearNextDamageBonus, true);
    assert.equal(core.etchings[root.name].otherCasts, Number(effectiveEnd > cast.start));
    assert.deepEqual(core.spearFollowups, {});
  }
});
