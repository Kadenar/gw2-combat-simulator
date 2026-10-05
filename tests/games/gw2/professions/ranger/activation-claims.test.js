import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { reactToGaleshotPet } from '#gw2/professions/ranger/specializations/galeshot/traits/behavior.js';

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
          reactToGaleshotPet(context, event);
        }
      }
    };
    state.wutheringWindReady = true;
    state.wutheringWindReadyAt = 2;
    reactToGaleshotPet(context, event);
    assert.deepEqual(state.galeshotActivationClaims, {});
    state.wutheringWindReadyAt = 0;
    reactToGaleshotPet(context, { ...event, coefficient: 0 });
    assert.deepEqual(state.galeshotActivationClaims, {});

    const removed = {
      ...context,
      helpers: applyBalanceProfilePatch(runtime.helpers, {
        balanceProfiles: { [TRAIT.WUTHERING_WIND]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
      })
    };
    reactToGaleshotPet(removed, event);
    assert.equal(state.wutheringWindReady, true);
    assert.deepEqual(state.galeshotActivationClaims, {});
    assert.deepEqual(emitted, []);

    reactToGaleshotPet(context, event);
    assert.ok(emitted.some((request) => request.kind === 'packet'));
    const accepted = emitted.length;
    reactToGaleshotPet(context, event);
    reactToGaleshotPet(context, { ...event, at: 30 });
    assert.equal(emitted.length, accepted);
    assert.equal(state.wutheringWindReady, true);

    // Disable the artificial rearming when exercising a genuinely new or ID-less packet.
    context.effects.emit = (request) => emitted.push(request);
    reactToGaleshotPet(context, { ...event, activationId: 'next-pet-cast', at: 30 });
    assert.equal(state.wutheringWindReady, false);
    assert.ok(emitted.length > accepted);
    for (let packet = 0; packet < 2; packet += 1) {
      state.wutheringWindReady = true;
      reactToGaleshotPet(context, { ...event, activationId: undefined });
      assert.equal(state.wutheringWindReady, false);
    }
  }
});
