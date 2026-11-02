// Akeem conditions retain effect identity while inheriting the player's outgoing condition modifiers.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';

test('Akeem Confusion and Torment inherit player condition modifiers', () => {
  const relic = createRelicRuntime('Akeem');
  const captured = captureEffectEmissions();
  relic.rules.control(
    { effects: captured.effects },
    relic.state,
    { type: 'control', at: 1, actorType: 'player' },
    {
      activeConditionStackCount: () => 5
    }
  );
  assert.deepEqual(new Set(captured.events.map((event) => event.condition)), new Set(['Confusion', 'Torment']));

  resolveTestGw2Events({
    config: { modifiers: { condition: 1.1, playerCondition: 1.25 } },
    engineInitialize(runtime) {
      for (const event of captured.events) {
        assert.equal(runtime.query.conditionMultiplier(event.condition, event.at, event, runtime), 1.1 * 1.25);
        assert.equal(event.actorType, 'effect');
        assert.equal(event.ownerActorType, 'player');
      }
    }
  });
});
