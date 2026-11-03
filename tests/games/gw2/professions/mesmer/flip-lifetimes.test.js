import assert from 'node:assert/strict';
import test from 'node:test';

import { SHARED_STATE_IDS as STATE } from '#gw2/platform/results/state-ids.js';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { armMesmerSkillFlip } from '#gw2/professions/mesmer/core/mechanics/flips.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { observedRuntime, observeGw2Runtime, projectObservedPlanningState } from '#tests/helpers/observed-runtime.js';

// Use real runtime expiry and scheduled probes to isolate window contracts from weapon cast durations.
function flipScenario(initialize, tasks = {}) {
  const config = { specialization: 'Core', primaryWeapon: 'Scepter', selectedTraitIds: [] };
  const profession = mesmerProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: { ...profession, tasks: { ...profession.tasks, ...tasks } },
    config,
    rotation: [{ type: 'wait', durationMs: 1000 }],
    engineInitialize: (runtime) => initialize(runtime.mechanics)
  });
  assert.deepEqual(result.warnings, []);
  return observedRuntime(result);
}

function parentCast(id = 'parent', start = 0.1 + 0.2, arm = {}) {
  return {
    id,
    start,
    skill: {
      id: ID.ILLUSIONARY_COUNTER,
      name: 'Illusionary Counter',
      flipArm: { skillId: ID.COUNTERSPELL, delay: 0.1, duration: 0.2, ...arm }
    }
  };
}

test('Mesmer flip creation, availability, projection, and cleanup share exact boundaries', () => {
  const checks = [
    [0.349999, false, false, 'mesmer.flip-not-armed'],
    [0.35, true, false, 'mesmer.flip-not-ready'],
    [0.399999, true, false, 'mesmer.flip-not-ready'],
    [0.4, true, true],
    [0.499999, true, true],
    [0.5, false, false, 'mesmer.flip-not-armed']
  ];
  const checked = [];
  const runtime = flipScenario(
    (context) => {
      context.schedule('test.arm', 0.35);
      checks.forEach(([at], index) => context.schedule('test.check', at, { index }, undefined, 1));
      context.schedule('test.after-expiry', 0.500001);
    },
    {
      'test.arm'(context) {
        armMesmerSkillFlip(context, parentCast());
        assert.deepEqual(context.flips[ID.COUNTERSPELL], {
          identity: 'parent',
          remainingUses: 1,
          visibleAt: 0.35,
          availableAt: 0.4,
          expiresAt: 0.5
        });
      },
      'test.check'(context, { index }) {
        const [at, visible, ready, code] = checks[index];
        const flip = context.helpers.skillsById.get(ID.COUNTERSPELL);
        const availability = mesmerAvailability(context, flip);
        assert.equal(availability.ready, ready, `availability at ${at}`);
        assert.equal(availability.code, code);
        const projected = projectObservedPlanningState(mesmerProfession, {
          profession: context.profession,
          flips: context.flips,
          config: context.config,
          time: context.time
        });
        assert.equal(Boolean(projected.profession[STATE.AVAILABLE_FLIPS][ID.COUNTERSPELL]), visible);

        // Eligibility closes at the deadline even though cleanup has not run yet.
        if (at === 0.5) assert.ok(context.flips[ID.COUNTERSPELL]);

        checked.push(at);
      },
      'test.after-expiry'(context) {
        assert.equal(context.flips[ID.COUNTERSPELL], undefined);
        checked.push('expired');
      }
    }
  );
  assert.deepEqual(checked, [...checks.map(([at]) => at), 'expired']);
  assert.equal(runtime.flips[ID.COUNTERSPELL], undefined);
});

test('Mesmer completion cannot arm an already expired flip and cleanup preserves persistent flips', () => {
  const runtime = flipScenario(
    (context) => {
      context.armFlip(ID.POWER_SPIKE);
      context.schedule('test.arm', 0.5);
    },
    {
      'test.arm'(context) {
        armMesmerSkillFlip(context, parentCast());
        assert.equal(context.flips[ID.COUNTERSPELL], undefined);
      }
    }
  );
  assert.equal(runtime.flips[ID.COUNTERSPELL], undefined);
  assert.equal(runtime.flips[ID.POWER_SPIKE].expiresAt, null);
});

test('Mesmer flip endpoints canonicalize arithmetic residue without snapping to action ticks', () => {
  let checked = false;
  flipScenario((context) => context.schedule('test.arm', 0.15), {
    'test.arm'(context) {
      armMesmerSkillFlip(context, parentCast('parent', 0.1, { delay: 0.2, duration: 0.333333 }));
      assert.deepEqual(context.flips[ID.COUNTERSPELL], {
        identity: 'parent',
        remainingUses: 1,
        visibleAt: 0.15,
        availableAt: 0.3,
        expiresAt: 0.433333
      });
      checked = true;
    }
  });
  assert.equal(checked, true);
});

// Observe after the old deadline so stale cleanup must actually run before checking its replacement.
test('a replaced Mesmer flip survives its predecessor expiry until its later deadline', () => {
  let checked = false;
  const arm = { anchor: 'castCommit', duration: 0.5 };
  const runtime = flipScenario(
    (context) => {
      armMesmerSkillFlip(context, parentCast('old', -1, arm));
      context.schedule('test.rearm', 0.25);
      context.schedule('test.after-old-expiry', 0.500001);
    },
    {
      'test.rearm'(context) {
        armMesmerSkillFlip(context, parentCast('new', -1, arm));
      },
      'test.after-old-expiry'(context) {
        assert.equal(context.flips[ID.COUNTERSPELL].identity, 'new');
        assert.equal(context.flips[ID.COUNTERSPELL].expiresAt, 0.75);
        assert.equal(mesmerAvailability(context, context.helpers.skillsById.get(ID.COUNTERSPELL)).ready, true);
        checked = true;
      }
    }
  );
  assert.equal(checked, true);
  assert.equal(runtime.flips[ID.COUNTERSPELL], undefined);
});

test('consumed Mesmer flips remain closed when their pending expiry runs', () => {
  let consumed = false;
  const runtime = flipScenario(
    (context) => {
      armMesmerSkillFlip(context, parentCast('parent', 0, { duration: 0.5 }));
      context.schedule('test.consume', 0.2);
    },
    {
      'test.consume'(context) {
        assert.equal(context.consumeFlip(ID.COUNTERSPELL).identity, 'parent');
        assert.equal(mesmerAvailability(context, context.helpers.skillsById.get(ID.COUNTERSPELL)).ready, false);
        consumed = true;
      }
    }
  );
  assert.equal(consumed, true);
  assert.equal(runtime.flips[ID.COUNTERSPELL], undefined);
});
