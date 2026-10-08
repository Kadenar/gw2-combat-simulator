import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { applyDeadlyAmbition } from '#gw2/professions/thief/core/traits/deadly-arts/poison.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Rejected or removed packets leave the activation available; a surviving emission commits before reentry.
test('Deadly Ambition preserves component eligibility and its ID-less identity rule', () => {
  const result = runThief([], { selectedTraitIds: [TRAIT.DEADLY_AMBITION] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  const event = thiefHit(1, {
    skillId: ID.DEATH_BLOSSOM,
    sourceId: ID.DEATH_BLOSSOM,
    activationId: 'dual-attack'
  });
  const emitted = [];
  const context = {
    config: runtime.config,
    traits: runtime.traits,
    profession: runtime.profession,
    helpers: runtime.helpers,
    effects: {
      emit(request) {
        emitted.push(request);
        applyDeadlyAmbition(context, event);
      }
    }
  };
  applyDeadlyAmbition(context, { ...event, coefficient: 0 });
  applyDeadlyAmbition(
    {
      ...context,
      helpers: applyBalanceProfilePatch(runtime.helpers, {
        balanceProfiles: { [TRAIT.DEADLY_AMBITION]: { removeEffects: [{ type: 'condition', name: 'Poisoned' }] } }
      })
    },
    event
  );
  assert.deepEqual(runtime.profession.core.activationClaims, {});
  applyDeadlyAmbition(context, event);
  applyDeadlyAmbition(context, event);
  applyDeadlyAmbition(context, { ...event, at: 30 });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].event.condition, 'Poisoned');

  context.effects.emit = (request) => emitted.push(request);
  applyDeadlyAmbition(context, { ...event, activationId: undefined });
  applyDeadlyAmbition(context, { ...event, activationId: undefined });
  assert.equal(emitted.length, 2);
  applyDeadlyAmbition(context, { ...event, activationId: undefined, at: 2 });
  assert.equal(emitted.length, 3);
});
