import assert from 'node:assert/strict';
import test from 'node:test';
import { handleLightningRodPulse } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
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
