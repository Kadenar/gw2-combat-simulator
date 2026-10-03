import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// Companion-created boons use companion concentration; player grants and fixed copies keep their own duration policy.
test('shared emission chooses boon duration from the granting Ranger actor', () => {
  const result = runRanger(
    [{ type: 'wait', durationMs: 1100 }],
    { selectedTraitIds: [TRAIT.LINGERING_MAGIC], stats: { concentration: 1500 } },
    {
      initialize(runtime) {
        for (const [sourceId, source, actorType, fixedDuration] of [
          ['pet', 'ranger-pet', 'summon', false],
          ['player', 'Trait', 'effect', false],
          ['copy', 'Trait', 'effect', true]
        ]) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 1,
              sourceId,
              source,
              actorType,
              kind: 'fury',
              duration: 4,
              stacks: 1,
              fixedDuration
            }
          });
        }
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const durations = new Map(
    result.events.filter((event) => event.type === 'buff').map((event) => [event.sourceId, event.duration])
  );
  assert.equal(durations.get('pet'), 4.64);
  assert.equal(durations.get('player'), 8);
  assert.equal(durations.get('copy'), 4);
});

// A beast-skill reward at commitment arms the subsequent pet hit even when both share the same clock instant.
test('shared pet delivery preserves beast-skill rewards before their impact', () => {
  const result = runRanger(['__combat_start', 'Intimidating Howl', { type: 'wait', durationMs: 100 }], {
    selectedPet: 'Krytan Drakehound',
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });
  assert.deepEqual(result.warnings, []);
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === TRAIT.POISON_MASTER
  );
  assert.equal(poison.length, 1);
  assert.equal(poison[0].stacks, 2);
});

// Presentation allocations cannot choose a pet's combat activation or change the hit's random identity.
test('pet activations and damage are independent of extra announcements', () => {
  const runs = [false, true].map((announce) =>
    runRanger(
      ['__combat_start', { type: 'wait', durationMs: 1400 }],
      { specialization: 'Untamed', selectedPet: 'Tiger' },
      {
        initialize(runtime) {
          if (announce)
            runtime.effects.emit({
              kind: 'announcement',
              log: true,
              announcement: { type: 'trait', name: 'Display only', at: 0 }
            });
        }
      }
    )
  );
  for (const result of runs) assert.deepEqual(result.warnings, []);
  const first = runs.map((result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.FELINE_SLASH)
  );
  assert.ok(first.every(Boolean));
  assert.equal(first[0].activationId, first[1].activationId);
  assert.equal(first[0].damage, first[1].damage);
});
