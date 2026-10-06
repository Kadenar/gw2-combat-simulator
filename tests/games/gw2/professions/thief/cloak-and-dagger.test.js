import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Stealth belongs to a landed dagger hit; missing the target must not create stealth or its trait rewards.
test('Cloak and Dagger grants stealth only when its strike lands', () => {
  for (const offTarget of [false, true]) {
    const result = runThief([{ type: 'cast', skillId: ID.CLOAK_AND_DAGGER, offTarget }]);
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.core.stealthUntil > runtime.time, !offTarget);
  }
});

// A separate hostile pulse after the dagger hit owns Revealed; cast completion cannot grant stealth again.
test('a delayed strike can reveal Cloak and Dagger stealth before the next input', () => {
  const result = runThief(
    [ID.CLOAK_AND_DAGGER, ID.DOUBLE_STRIKE],
    {},
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            assert.ok(runtime.profession.core.stealthUntil > runtime.time);
            runtime.effects.emit({ kind: 'packet', event: thiefHit(runtime.time, { skillId: ID.THOUSAND_NEEDLES }) });
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  assert.ok(runtime.profession.core.stealthUntil <= runtime.time);
  assert.ok(runtime.profession.core.revealedUntil > runtime.time);
});
