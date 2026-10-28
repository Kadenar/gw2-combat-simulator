import assert from 'node:assert/strict';
import test from 'node:test';

import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { applyRuntimeSigils } from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { enteredCombat } from '#tests/helpers/engagement.js';

const cooldownKey = `sigil.${SIGIL_IDS.SEVERANCE}`;

/** Minimal controls isolate seeded acceptance, equipment eligibility and cooldown ownership. */
function fixture(chance, mode = 'deterministic') {
  const capture = captureEffectEmissions();
  const runtime = createGw2ResolverRuntimeState({
    config: {
      sigilSets: [{ names: ['Severance'] }, { names: ['Severance'] }],
      procRateOverrides: chance === undefined ? {} : { 'sigil.severance': chance },
      randomness: { seed: 42, mode }
    }
  });
  runtime.engagement = enteredCombat();
  runtime.effects = capture.effects;
  const trigger = (at) => applyRuntimeSigils(runtime, 'control', { type: 'control', at, skillName: 'Control' });
  return { runtime, trigger, ...capture };
}

test('Severance defaults to certain procs and accepts explicit zero in both random modes', () => {
  for (const mode of ['deterministic', 'stochastic']) {
    for (const chance of [undefined, 0, 1]) {
      const { runtime, trigger, events } = fixture(chance, mode);
      trigger(0);
      assert.equal(events.length, chance === 0 ? 0 : 1);
      assert.equal(runtime.procs.deadline(cooldownKey), chance === 0 ? 0 : 1);
    }
  }
});

test('Severance failed rolls leave cooldowns free and blocked controls never consume rolls', () => {
  const { runtime, trigger, events } = fixture(0.5);
  const attempts = [];
  runtime.random = {
    ...runtime.random,
    roll(chance, stream) {
      attempts.push({ chance, stream });
      return attempts.length > 1;
    }
  };
  trigger(0);
  assert.equal(runtime.procs.deadline(cooldownKey), 0);
  assert.equal(events.length, 0);
  trigger(0.1);
  assert.equal(runtime.procs.deadline(cooldownKey), 1.1);
  assert.equal(events.length, 1);
  // Both sets share the cooldown, including its exclusive boundary.
  runtime.activeWeaponSet = 2;
  trigger(0.2);
  trigger(1.1);
  assert.equal(attempts.length, 2);
  trigger(1.2);
  assert.equal(events.length, 2);
  assert.deepEqual(attempts, Array(3).fill({ chance: 0.5, stream: 'sigil.severance' }));
});

test('Severance decisions reproduce the dedicated seeded stream without unrelated or unequipped rolls', () => {
  const expectedRandom = createSimulationRandom({ seed: 42 });
  const expected = Array.from({ length: 20 }, () => expectedRandom.roll(0.5, 'sigil.severance'));
  assert.ok(expected.includes(true) && expected.includes(false));
  for (const mode of ['deterministic', 'stochastic']) {
    for (const noise of [false, true]) {
      const { runtime, trigger, events } = fixture(0.5, mode);
      const accepted = expected.map((_, index) => {
        if (noise) {
          runtime.random.roll(0.5, 'critical:player');
          runtime.config.sigilSets[0].names = [];
          trigger(index * 2);
          runtime.config.sigilSets[0].names = ['Severance'];
        }

        const before = events.length;
        trigger(index * 2);
        return events.length > before;
      });
      assert.deepEqual(accepted, expected);
    }
  }
});
