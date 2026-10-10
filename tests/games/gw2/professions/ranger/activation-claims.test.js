import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { galeshotPetStrike } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

// A rearmed charge belongs to a new pet activation, including when old packets arrive much later.
test('Wuthering Wind preserves charge eligibility and claims before reentrant emissions', () => {
  for (let run = 0; run < 2; run += 1) {
    const result = runRanger([], { specialization: 'Galeshot', selectedTraitIds: [TRAIT.WUTHERING_WIND] });
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const state = runtime.profession.specialization.state;
    const event = {
      actorType: 'summon',
      source: 'ranger-pet',
      coefficient: 1,
      activationId: 'pet-cast',
      at: 1
    };
    const emitted = [];
    const context = {
      config: runtime.config,
      traits: runtime.traits,
      profession: runtime.profession,
      helpers: runtime.helpers,
      effects: {
        emit(request) {
          emitted.push(request);
          // Rearming here makes the activation claim, rather than readiness alone, prevent recursion.
          state.wutheringWindReady = true;
          context.fireTrigger(galeshotPetStrike, { event: event });
        }
      }
    };
    // Exercise the same selected point listeners as the live profession.
    bindTriggerPoints(context, rangerProfession, runtime.config);
    state.wutheringWindReady = true;
    state.wutheringWindReadyAt = 2;
    context.fireTrigger(galeshotPetStrike, { event: event });
    assert.deepEqual(state.galeshotActivationClaims, {});
    state.wutheringWindReadyAt = 0;
    context.fireTrigger(galeshotPetStrike, { event: { ...event, coefficient: 0 } });
    assert.deepEqual(state.galeshotActivationClaims, {});

    const removed = {
      ...context,
      helpers: applyBalanceProfilePatch(runtime.helpers, {
        balanceProfiles: { [TRAIT.WUTHERING_WIND]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
      })
    };
    // Exercise the same selected point listeners as the live profession.
    bindTriggerPoints(removed, rangerProfession, runtime.config);
    removed.fireTrigger(galeshotPetStrike, { event: event });
    assert.equal(state.wutheringWindReady, true);
    assert.deepEqual(state.galeshotActivationClaims, {});
    assert.deepEqual(emitted, []);

    context.fireTrigger(galeshotPetStrike, { event: event });
    assert.ok(emitted.some((request) => request.kind === 'packet'));
    const accepted = emitted.length;
    context.fireTrigger(galeshotPetStrike, { event: event });
    context.fireTrigger(galeshotPetStrike, { event: { ...event, at: 30 } });
    assert.equal(emitted.length, accepted);
    assert.equal(state.wutheringWindReady, true);

    // Disable the artificial rearming when exercising a genuinely new or ID-less packet.
    context.effects.emit = (request) => emitted.push(request);
    context.fireTrigger(galeshotPetStrike, { event: { ...event, activationId: 'next-pet-cast', at: 30 } });
    assert.equal(state.wutheringWindReady, false);
    assert.ok(emitted.length > accepted);
    for (let packet = 0; packet < 2; packet += 1) {
      state.wutheringWindReady = true;
      context.fireTrigger(galeshotPetStrike, { event: { ...event, activationId: undefined } });
      assert.equal(state.wutheringWindReady, false);
    }
  }
});
