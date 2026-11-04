import assert from 'node:assert/strict';
import test from 'node:test';

import { recordMesmerTrackedHit } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

test('equal-time tracked hits consume one group while preserving independent skill progress', () => {
  // Every call is an accepted observation, even at the same instant; another skill owns a separate ledger.
  for (const required of [1, 2, 5]) {
    const runtime = observedRuntime(runMesmer([], { specialization: 'Core' }));
    const capture = captureEffectEmissions();
    runtime.effects = capture.effects;
    const skill = {
      id: 1,
      name: 'Tracked fixture',
      trackedHitDamage: { duration: 5, hitsRequired: required, coefficient: 1 }
    };
    const other = { ...skill, id: 2, trackedHitDamage: { ...skill.trackedHitDamage, hitsRequired: 2 } };
    recordMesmerTrackedHit(runtime, other, 1);
    for (let progress = 1; progress <= required; progress++) {
      recordMesmerTrackedHit(runtime, skill, 1);
      assert.deepEqual(
        runtime.profession.core.trackedSkillHits[skill.id],
        Array(progress < required ? progress : 0).fill(1)
      );
      assert.equal(
        capture.events.some((event) => event.skillId === skill.id),
        progress === required
      );
      assert.deepEqual(runtime.profession.core.trackedSkillHits[other.id], [1]);
    }

    capture.events.length = 0;
    recordMesmerTrackedHit(runtime, skill, 1);
    assert.deepEqual(runtime.profession.core.trackedSkillHits[skill.id], required === 1 ? [] : [1]);
    assert.equal(
      capture.events.some((event) => event.skillId === skill.id),
      required === 1
    );
  }
});

test('Flying Cutter counts accepted hits across casts using the selected threshold and reward identity', () => {
  // Misses add no progress, completed groups reset it, and derived Cutter Burst packets cannot feed the ledger.
  for (const required of [1, 3, 4]) {
    for (const [accepted, remaining, rewarded] of [
      [required - 1, required - 1, false],
      [required, 0, true],
      [required + 1, required === 1 ? 0 : 1, true]
    ]) {
      const result = runMesmer(
        [
          { type: 'cast', skillId: ID.FLYING_CUTTER, offTarget: true },
          ...Array(accepted).fill(ID.FLYING_CUTTER),
          { type: 'wait', durationMs: 1000 }
        ],
        { specialization: 'Core', primaryWeapon: 'Dagger' },
        {
          extend(native) {
            const skill = native.catalog.skillsById.get(ID.FLYING_CUTTER);
            return {
              catalog: withSkill(native.catalog, skill.id, {
                trackedHitDamage: { ...skill.trackedHitDamage, hitsRequired: required }
              })
            };
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(observedRuntime(result).profession.core.trackedSkillHits[ID.FLYING_CUTTER]?.length ?? 0, remaining);
      const reward = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillId === ID.CUTTER_BURST
      );
      assert.equal(reward.length > 0, rewarded);
      for (const event of reward) {
        assert.equal(event.sourceId, ID.CUTTER_BURST);
        assert.equal(event.skillName, 'Cutter Burst');
        assert.equal(event.parentSkillName, 'Flying Cutter');
        assert.equal(event.actorType, 'player');
        assert.equal(event.persistsAfterInterrupt, true);
      }
    }
  }
});
