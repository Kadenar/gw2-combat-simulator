import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// Computed and authored grants use the same live profession duration policy, while copied durations stay fixed.
test('shared Guardian emissions apply Virtue of Resolution once to computed and profile boons', () => {
  const config = { specialization: 'Core', selectedTraitIds: [TRAIT.VIRTUE_OF_RESOLUTION] };
  const native = guardianProfession.runtimeFor(config);
  const attribution = { source: 'Trait', sourceId: TRAIT.VIRTUE_OF_RESOLUTION, actorType: 'player' };
  const result = observeGw2Runtime({
    config,
    rotation: [{ type: 'wait', durationMs: 1000 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        runtime.effects.emit({
          kind: 'packet',
          event: { ...attribution, type: 'buff', at: 0.1, name: 'computed', kind: 'resolution', stacks: 1, duration: 4 }
        });
        runtime.effects.emit({
          kind: 'profile',
          profile: {
            id: 'test.resolution',
            name: 'authored',
            effects: [{ type: 'boon', boon: 'resolution', stacks: 1, duration: 4 }]
          },
          at: 0.2,
          attribution
        });
        runtime.effects.emit({
          kind: 'packet',
          event: {
            ...attribution,
            type: 'buff',
            at: 0.3,
            name: 'copied',
            kind: 'resolution',
            stacks: 1,
            duration: 4,
            fixedDuration: true
          }
        });
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'resolution');
  assert.deepEqual(
    grants.map((event) => event.duration),
    [5, 5, 4]
  );
});
