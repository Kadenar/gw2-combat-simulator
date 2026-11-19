import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { thiefStruck } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

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
        // Reentry must see the claim before the shared service delivers any profile packet.
        captureEffectEmissions({ submit: (packet) => emitted.push(packet) }).effects.emit(request);
        context.fireTrigger(thiefStruck, { cause: event, details: {} });
      }
    }
  };
  bindTriggerPoints(context, thiefProfession);
  context.fireTrigger(thiefStruck, { cause: { ...event, coefficient: 0 }, details: {} });
  bindTriggerContext({
    ...context,
    helpers: applyBalanceProfilePatch(runtime.helpers, {
      balanceProfiles: { [TRAIT.DEADLY_AMBITION]: { removeEffects: [{ type: 'condition', name: 'Poisoned' }] } }
    })
  }).fireTrigger(thiefStruck, { cause: event, details: {} });
  assert.deepEqual(runtime.profession.core.activationClaims, {});
  context.fireTrigger(thiefStruck, { cause: event, details: {} });
  context.fireTrigger(thiefStruck, { cause: event, details: {} });
  context.fireTrigger(thiefStruck, { cause: { ...event, at: 30 }, details: {} });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].condition, 'Poisoned');

  context.effects = captureEffectEmissions({ submit: (packet) => emitted.push(packet) }).effects;
  context.fireTrigger(thiefStruck, { cause: { ...event, activationId: undefined }, details: {} });
  context.fireTrigger(thiefStruck, { cause: { ...event, activationId: undefined }, details: {} });
  assert.equal(emitted.length, 2);
  context.fireTrigger(thiefStruck, { cause: { ...event, activationId: undefined, at: 2 }, details: {} });
  assert.equal(emitted.length, 3);
});

// Shared activation IDs do not make trait strikes native hits; older timestamps cannot consume the new cast.
test('Death Blossom suppression checks activation, skill, source and cast start', () => {
  for (const [fields, expected] of [
    [{ sourceId: TRAIT.MUG }, 0],
    [{ skillId: ID.HEARTSEEKER }, 0],
    [{ activationId: 'foreign', skillId: ID.DOUBLE_STRIKE, sourceId: ID.DOUBLE_STRIKE }, 0],
    [{ sourceId: TRAIT.MUG, at: 0.5 }, 1],
    [{}, 1]
  ]) {
    const runtime = observedRuntime(runThief([], { selectedTraitIds: [TRAIT.DEADLY_AMBITION] }));
    runtime.profession.core.deadlyAmbitionOpportunity = {
      id: 'blossom',
      skillId: ID.DEATH_BLOSSOM,
      firstEligibleAt: 1
    };
    const emitted = [];
    const context = bindTriggerContext({
      config: runtime.config,
      traits: runtime.traits,
      profession: runtime.profession,
      helpers: runtime.helpers,
      effects: captureEffectEmissions({ submit: (packet) => emitted.push(packet) }).effects
    });
    const hit = thiefHit(2, {
      activationId: 'blossom',
      skillId: ID.DEATH_BLOSSOM,
      sourceId: ID.DEATH_BLOSSOM
    });
    context.fireTrigger(thiefStruck, { cause: { ...hit, at: 1.5, ...fields }, details: {} });
    context.fireTrigger(thiefStruck, { cause: hit, details: {} });
    assert.equal(emitted.length, expected);
  }
});

/** Patch fixtures use the same selection and ordering as the real mechanic boundary. */
function bindTriggerContext(context) {
  bindTriggerPoints(context, thiefProfession);
  return context;
}
