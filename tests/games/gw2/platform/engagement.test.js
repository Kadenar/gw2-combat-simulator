import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatEngagement, autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';

// Discovery admits simultaneous opening damage without letting it finish authored preparation.
test('authored discovery, preparation, and accepted combat entry remain separate transitions', () => {
  let time = 0;
  const owner = createCombatEngagement({ authoredMarkers: 1 }, () => time);
  const query = owner.query;
  assert.equal(query.hostileEffectsAllowed(2), false);
  assert.equal(query.preparationComplete(), false);
  owner.discoverBoundary(2);
  assert.equal(query.hostileEffectsAllowed(1), false);
  assert.equal(query.hostileEffectsAllowed(2), true);
  assert.equal(query.hostileEffectsAllowed(2, false), false);
  assert.equal(owner.acceptEntry(1), false);
  assert.equal(query.active, false);
  time = 2;
  assert.equal(owner.acceptEntry(time), false, 'an opening hit must not release explicit producers');
  assert.equal(query.active, true);
  assert.equal(query.preparationComplete(), false);
  assert.equal(query.combatMechanicsAllowed(), false);
  owner.consumeMarker(time);
  assert.equal(query.preparationComplete(), true);
  owner.dispatchMarker(time);
  assert.equal(owner.acceptEntry(time, true), true);
  assert.equal(query.combatMechanicsAllowed(), true);
  assert.equal(query.combatMechanicsAllowed(1), false);
  owner.dispatchMarker(3);
  assert.equal(owner.acceptEntry(3, true), false, 'repeated notification cannot start producers twice');
  assert.equal(query.startTime, 2);
});

// An inherited positive boundary waits for its event, while zero admits an opening packet immediately.
test('inherited boundaries release setup on dispatch, including numeric zero', () => {
  for (const start of [0, 2]) {
    const owner = createCombatEngagement({ inheritedStartTime: start }, () => start);
    assert.equal(owner.query.explicit, true);
    assert.equal(owner.query.hostileEffectsAllowed(start), start === 0);
    assert.equal(owner.query.preparationComplete(), start === 0);

    if (start === 0) {
      assert.equal(owner.acceptEntry(0), false, 'an opening hit leaves explicit startup to the marker');
      assert.equal(owner.query.combatMechanicsAllowed(), true, 'a numeric zero has no remaining preparation');
    }

    owner.dispatchMarker(start);
    assert.equal(owner.query.preparationComplete(), true);
    assert.equal(owner.query.combatMechanicsAllowed(), start === 0, 'activity still requires accepted entry');
    assert.equal(owner.acceptEntry(start, true), true);
    assert.equal(owner.query.combatMechanicsAllowed(), true);
  }
});

// Implicit summons may initiate the fight; target death independently closes autonomous activity.
test('implicit entry permits autonomous openers and releases startup exactly once', () => {
  const owner = createCombatEngagement();
  const runtime = { engagement: owner.query, deathTime: null };
  assert.equal(owner.query.active, false);
  assert.equal(owner.query.preparationComplete(), true);
  assert.equal(autonomousActionsAllowed(runtime), true);
  assert.equal(owner.acceptEntry(2), true);
  assert.equal(owner.acceptEntry(3), false);
  assert.equal(owner.query.active, true);
  assert.equal(owner.query.startTime, null, 'implicit first damage remains a separate reporting fact');
  runtime.deathTime = 3;
  assert.equal(autonomousActionsAllowed(runtime), false);
});

// Invalid boundary ownership is rejected before any runtime can execute.
test('engagement rejects competing or invalid explicit starts and exposes read-only queries', () => {
  assert.throws(() => createCombatEngagement({ authoredMarkers: 2 }), /one owner/);
  assert.throws(() => createCombatEngagement({ authoredMarkers: 1, inheritedStartTime: 0 }), /one owner/);
  for (const inheritedStartTime of [-1, Infinity, NaN])
    assert.throws(() => createCombatEngagement({ inheritedStartTime }), /finite and non-negative/);
  const owner = createCombatEngagement();
  assert.equal(Object.isFrozen(owner.query), true);
  assert.equal('acceptEntry' in owner.query, false);
  assert.throws(() => {
    owner.query.active = true;
  }, TypeError);
});
