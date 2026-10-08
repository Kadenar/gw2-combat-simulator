import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

// Recasts bank remaining duration up to the cap; unrelated artifact windows cannot replace Surfer's lifetime.
test('Surfer refreshes its selected lifetime with a thirteen-second cap', () => {
  for (const selectedTraitIds of [[], [TRAIT.METICULOUS_CUSTODIAN]]) {
    const windows = [];
    const result = runThief(
      [
        'Skritt Swipe',
        'Forged Surfer Dash',
        { type: 'wait', durationMs: 2000 },
        'Skritt Scuffle',
        'Forged Surfer Dash'
      ],
      { specialization: 'Antiquary', selectedTraitIds, selectedSkillIds: [ID.SKRITT_SCUFFLE] },
      {
        extend(native) {
          return {
            onCastCommit(runtime, cast) {
              native.onCastCommit?.(runtime, cast);
              if (cast.skill.id === ID.FORGED_SURFER_DASH)
                windows.push(runtime.profession.specialization.state.forgedSurferBombDropUntil - runtime.time);
            }
          };
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      windows.map((value) => Math.round(value)),
      [selectedTraitIds.length ? 13 : 10, 13]
    );
  }
});

// The live window terminates the sequence even when the rotation leaves ample observation time afterward.
test('Surfer cannot schedule additional explosions after its buff expires', () => {
  for (const selectedTraitIds of [[], [TRAIT.METICULOUS_CUSTODIAN]]) {
    const result = runThief(['Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 20000 }], {
      specialization: 'Antiquary',
      selectedTraitIds
    });
    const deadline = observedRuntime(result).profession.specialization.state.forgedSurferBombDropUntil;
    const strikes = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.FORGED_SURFER_DASH);
    assert.deepEqual(result.warnings, []);
    assert.ok(strikes.some((event) => event.name.endsWith('Bomb')));
    assert.ok(strikes.every((event) => event.at <= deadline));
  }
});
