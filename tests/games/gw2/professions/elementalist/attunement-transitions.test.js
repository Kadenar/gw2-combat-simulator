import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Cast completion changes hands before deferred elite rewards, while both retain the same observation instant.
test('family attunement commitment precedes deferred Catalyst rewards', () => {
  const committed = [];
  const result = runElementalist(
    [{ type: 'cast', skillId: ID.FIRE_ATTUNEMENT }],
    {
      specialization: 'Catalyst',
      startAttunement: 'Water',
      initialCatalystEnergy: 0,
      selectedTraitIds: [TRAIT.ENERGIZED_ELEMENTS]
    },
    {
      extend: (native) => ({
        onCastCommit(runtime, cast) {
          native.onCastCommit(runtime, cast);
          committed.push({
            attunement: runtime.profession.core.primaryAttunement,
            energy: runtime.resourceController.value('catalystEnergy')
          });
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(committed, [{ attunement: 'Fire', energy: 0 }]);
  const observation = result.events.find((event) => event.type === 'elementalist.attunement');
  const reward = result.events.find((event) => event.kind === 'catalyst-energy');
  assert.ok(reward.change > 0);
  assert.equal(reward.at, observation.at);
  assert.equal(reward.parentEventOrder, observation.eventOrder);
  assert.equal(reward.causalOrder, observation.causalOrder);
  assert.ok(
    observedRuntime(result)
      .facts.ofType(observation.type)
      .some((event) => event.eventOrder === observation.eventOrder)
  );
});

// Public transition observations cannot replay state changes or trait rewards.
test('an attunement observation cannot change hands or grant Catalyst energy', () => {
  const result = runElementalist(
    [{ type: 'wait', durationMs: 1000 }],
    {
      specialization: 'Catalyst',
      startAttunement: 'Water',
      initialCatalystEnergy: 0,
      selectedTraitIds: [TRAIT.ENERGIZED_ELEMENTS]
    },
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'elementalist.attunement',
                at: runtime.time,
                source: 'Fire Attunement',
                sourceId: ID.FIRE_ATTUNEMENT,
                skillId: ID.FIRE_ATTUNEMENT,
                actorType: 'player',
                from: 'Water',
                to: 'Fire'
              }
            });
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.core.primaryAttunement, 'Water');
  assert.equal(runtime.resourceController.value('catalystEnergy'), 0);
  assert.ok(result.events.some((event) => event.type === 'elementalist.attunement'));
  assert.equal(
    result.events.some((event) => event.kind === 'catalyst-energy'),
    false
  );
});
