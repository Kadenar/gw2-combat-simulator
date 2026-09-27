import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';

// Variants add only their selected live boon, preserving independently authored hostile effects.
test('Exploding Spores variants retain base packets and honor boon removal', () => {
  for (const unleashed of [true, false]) {
    for (const removed of [true, false]) {
      const profileId = unleashed ? PROFILE.explodingSporesRanger : PROFILE.explodingSporesPet;
      const kind = unleashed ? 'might' : 'protection';
      const result = runRanger(
        [ID.EXPLODING_SPORES, { type: 'wait', durationMs: 2000 }],
        { specialization: 'Untamed' },
        {
          initialize(runtime) {
            runtime.profession.specialization.state.rangerUnleashed = unleashed;
          },
          extend(native) {
            const profile = native.catalog.balanceProfilesById.get(profileId);
            return {
              catalog: withProfile(native.catalog, profileId, {
                effects: removed ? [] : profile.effects.map((effect) => ({ ...effect, duration: 7 }))
              })
            };
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const events = result.events.filter((event) => event.skillId === ID.EXPLODING_SPORES);
      const boons = events.filter((event) => event.type === 'buff' && event.kind === kind);
      assert.equal(boons.length, removed ? 0 : 1);
      if (!removed) {
        assert.equal(boons[0].duration, 7);
        assert.equal(boons[0].at, result.steps[0].end / 1000);
      }

      assert.ok(events.some((event) => event.type === 'damage'));
      assert.ok(events.some((event) => event.type === 'condition' && event.condition === 'Poisoned'));
      assert.ok(events.some((event) => event.type === 'control'));
    }
  }
});

// Start rewards read live tuning, cap through the resource owner, and never reward cancelled inputs.
test('Galeshot declared arrow grants preserve cancellation and recovery', () => {
  for (const id of [ID.MISTRAL, ID.PERFECT_STORM, ID.PIERCING_GALES]) {
    for (const [amount, interrupted, expected] of [
      [3, false, 3],
      [20, false, 8],
      [3, true, 0]
    ]) {
      const result = runRanger(
        [
          ...(id === ID.PIERCING_GALES ? [ID.SUMMON_CYCLONE_BOW] : []),
          { type: 'cast', skillId: id, ...(interrupted ? { interruptMs: 1 } : {}) }
        ],
        { specialization: 'Galeshot', initialArrows: 0 },
        {
          extend: (native) => ({ catalog: withSkill(native.catalog, id, { arrowsRestored: amount }) })
        }
      );
      assert.deepEqual(result.warnings, []);
      const arrows = observedRuntime(result).profession.specialization.state.arrows;
      assert.equal(arrows.value, expected);
      if (expected < 8) assert.equal(arrows.nextAt, 5);
    }
  }
});

// Cloudburst resets at effective completion for committed casts, including a shortened projectile launch.
test('Cloudburst declared resets preserve cancelled and committed completion boundaries', () => {
  for (const [id, interruptMs, reset] of [
    [ID.QUARRYS_PERIL, 100, false],
    [ID.QUARRYS_PERIL, 400, true],
    [ID.SUPERSONIC_ARROW, undefined, true]
  ]) {
    const result = runRanger(
      [ID.SUMMON_CYCLONE_BOW, { type: 'cast', skillId: id, ...(interruptMs == null ? {} : { interruptMs }) }],
      { specialization: 'Galeshot', selectedTraitIds: [TRAIT.CLOUDBURST] },
      {
        initialize(runtime) {
          runtime.cooldownController.setReadyAt(ID.BLUSTER, 20);
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal((observedRuntime(result).cooldowns.get(ID.BLUSTER) ?? 0) <= 1, reset);
  }
});
