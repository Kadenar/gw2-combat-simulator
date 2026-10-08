import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { antiquaryHooks } from '#gw2/professions/thief/specializations/antiquary/hooks.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { prodigiousPincherReady } from '#gw2/professions/thief/specializations/antiquary/traits/behavior.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const config = {
  specialization: 'Antiquary',
  selectedTraitIds: [TRAIT.PRODIGIOUS_PINCHER],
  selectedSkillIds: [ID.SKRITT_SCUFFLE]
};

// Preserve the existing combat-entry behavior: spending banks before combat, but a live spending event must pilfer.
test('Prodigious Pincher retains precombat gross spending, checks after Chak refunds and discards pilfer overshoot', () => {
  const readings = [];
  const result = runThief(
    [{ type: 'wait', durationMs: 1000 }, { type: 'combat-start' }, { type: 'wait', durationMs: 1000 }],
    config,
    {
      timeline: [0.5, 1.5].map((at) => ({
        at,
        run(runtime) {
          const state = antiquaryState.from(runtime);
          state.chakInitiativeRefunds = [{ charges: 3, expiresAt: 10 }];
          const original = runtime.mechanics.resourceController.grant;
          // Observe that the refund sees gross progress before the pilfer replaces artifacts and clears the cycle.
          const context = {
            helpers: runtime.mechanics.helpers,
            traits: runtime.mechanics.traits,
            profession: runtime.mechanics.profession,
            time: runtime.time,
            combatStartedAt: runtime.combatStartedAt,
            resourceController: {
              grant(resource, amount) {
                readings.push([resource, amount, state.initiativeSpentSincePilfer]);
                return original(resource, amount);
              }
            }
          };
          antiquaryHooks.onCastStart(context, { skill: { type: 'Weapon', initiativeCost: 10 } });
          assert.equal(state.initiativeSpentSincePilfer, at < 1 ? 10 : 0);
          assert.equal(prodigiousPincherReady(context), false);
        }
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readings, [
    ['initiative', 10, 10],
    ['initiative', 10, 20]
  ]);
  const state = observedRuntime(result).profession.specialization.state;
  assert.ok(state.artifactUsesRemaining > 0);
  assert.equal(state.initiativeSpentSincePilfer, 0);
});

// External pilfer sources reset the same canonical progress even when no threshold has been reached.
test('Swipe and Scuffle reset Prodigious Pincher progress', () => {
  for (const skill of ['Skritt Swipe', 'Skritt Scuffle']) {
    const result = runThief([skill], config, {
      initialize(runtime) {
        antiquaryState.from(runtime).initiativeSpentSincePilfer = 7;
      }
    });
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.initiativeSpentSincePilfer, 0);
    assert.ok(state.artifactUsesRemaining > 0);
  }
});
