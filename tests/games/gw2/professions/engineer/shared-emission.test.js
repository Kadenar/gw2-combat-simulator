import assert from 'node:assert/strict';
import test from 'node:test';

import { handleLightningRodPulse } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';

// A strike queued before its derived condition must still see that condition when the hit resolves.
test('shared emission preserves Lightning Rod condition settlement and rejects off-target applications', () => {
  for (const offTarget of [false, true]) {
    const observations = [];
    const result = runEngineer(
      [{ type: 'wait', durationMs: 600 }],
      {},
      {
        timeline: [
          {
            at: 0.5,
            run(runtime) {
              handleLightningRodPulse(runtime, {
                type: 'engineer.lightning-rod-pulse',
                at: runtime.time,
                source: 'engineer',
                sourceId: ID.LIGHTNING_ROD,
                skillId: ID.LIGHTNING_ROD,
                skillName: 'Lightning Rod',
                actorType: 'player',
                offTarget
              });
              observations.push(runtime.combat.targetHasCondition('Vulnerability', runtime.time, runtime));
            }
          }
        ],
        extend: (native) => ({
          reactions: {
            ...native.reactions,
            'damage.resolved'(runtime, event, details) {
              native.reactions?.['damage.resolved']?.(runtime, event, details);

              if (event.skillName === 'Lightning Rod')
                observations.push(runtime.combat.targetHasCondition('Vulnerability', runtime.time, runtime));
            }
          }
        })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(observations[0], !offTarget);
    assert.ok(observations.every((value) => value === !offTarget));

    if (!offTarget) assert.equal(observations.length, 2);
  }
});

// Delayed heat payloads retain their triggering cast and captured tier after the live resource changes.
test('Holosmith shared profiles retain captured heat and causal ownership', () => {
  for (const [rotation, skillId, markerType, dropAt] of [
    [[ID.LASER_DISK], ID.LASER_DISK, 'engineer.laser-disk', 0.1],
    [[ID.PHOTON_WALL, ID.LAUNCH_WALL], ID.LAUNCH_WALL, 'engineer.launch-wall', 0.5],
    [[ID.PRIME_LIGHT_BEAM], ID.PRIME_LIGHT_BEAM, 'engineer.prime-light-beam-field', 1.5]
  ]) {
    const result = runEngineer(
      [...rotation, { type: 'wait', durationMs: 2500 }],
      { specialization: 'Holosmith', initialHeat: 120, selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT] },
      { timeline: [{ at: dropAt, run: (runtime) => runtime.resourceController.replace('heat', 0) }] }
    );
    assert.deepEqual(result.warnings, []);
    const marker = result.events.find((event) => event.type === markerType);
    assert.ok(marker);
    const delayed = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === skillId && event.at > dropAt
    );
    assert.ok(delayed.length > 0);
    for (const event of delayed) {
      assert.equal(event.holosmithStrikeFactor, skillId === ID.PRIME_LIGHT_BEAM ? 1.2 : 1.35);
      assert.equal(event.activationId, marker.activationId);
      assert.equal(event.parentEventOrder, marker.eventOrder);
    }
  }
});
