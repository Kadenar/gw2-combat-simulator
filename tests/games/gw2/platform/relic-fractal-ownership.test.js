import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Pets and the mech own the bleeding they apply, so only bleeding the player owns may arm the relic.
test('Relic of the Fractal ignores bleeding owned by an independent pet or mech', () => {
  // Each application meets a fresh relic above the stack threshold, isolating ownership from the cooldown.
  const trigger = (owner) => {
    const relic = createRelicRuntime('Fractal');
    const { effects, events } = captureEffectEmissions();
    relic.rules.condition(
      { relic, config: {}, effects },
      relic.state,
      { type: 'condition', at: 1, condition: 'Bleeding', stacks: 1, duration: 5, ...owner },
      { activeConditionStackCount: () => 7, stacksBeforeApplication: 6 }
    );
    return events.map(({ condition }) => condition);
  };

  assert.deepEqual(trigger({ actorType: 'player' }), ['Burning', 'Torment']);
  // Summons that share the player's condition packets still count as the player's applications.
  assert.deepEqual(trigger({ actorType: 'summon' }), ['Burning', 'Torment']);
  assert.deepEqual(trigger({ actorType: 'summon', independentConditionOwner: true }), []);
});
