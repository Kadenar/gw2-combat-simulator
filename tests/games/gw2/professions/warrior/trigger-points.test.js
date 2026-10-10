import assert from 'node:assert/strict';
import test from 'node:test';
import { burstCompleted, firstBurstHit, focusReset } from '#gw2/professions/warrior/core/mechanics/combat.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Activation ownership belongs to the mechanic, even when no trait listener is selected.
test('first surviving burst hit claims by activation identity before firing listeners', () => {
  const calls = [];
  const skill = { id: ID.EVISCERATE, burst: true };
  const runtime = {
    helpers: { skillsById: new Map([[skill.id, skill]]) },
    profession: { core: { activationClaims: {} } },
    fireTrigger(point, input) {
      calls.push([point.id, input.event.activationId]);
    }
  };
  const event = { skillId: skill.id, activationId: 'first', at: 1 };
  assert.equal(firstBurstHit(runtime, { ...event, activationId: undefined }), false);
  assert.equal(firstBurstHit(runtime, event), true);
  assert.equal(firstBurstHit(runtime, { ...event, at: 2 }), false);
  assert.equal(firstBurstHit(runtime, { ...event, activationId: 'second' }), true);
  assert.deepEqual(calls, [
    ['warrior.burst-first-hit', 'first'],
    ['warrior.burst-first-hit', 'second']
  ]);
});

// The compiled point consumes a captured transaction, independent of the resource pool at completion.
test('burst completion refunds accepted spend and Gunsaber Focus reset excludes swap adrenaline', () => {
  const config = {
    specialization: 'Core',
    initialResource: 0,
    selectedTraitIds: [TRAIT.BURST_MASTERY, TRAIT.MARTIAL_CADENCE, TRAIT.VERSATILE_RAGE]
  };
  const native = warriorProfession.runtimeFor(config);
  const result = observeGw2Runtime({ profession: native, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result).mechanics;
  runtime.resourceController.grant('adrenaline', 2);
  const cast = { id: 'captured-burst', skill: native.catalog.skillsById.get(ID.EVISCERATE) };
  runtime.fireTrigger(burstCompleted, { cast, spent: 30 });
  assert.equal(runtime.resourceController.value('adrenaline'), 11.9);
  runtime.procs.setDeadline('warrior.core.soldierFocus', 99);
  runtime.fireTrigger(focusReset, {});
  assert.equal(runtime.procs.deadline('warrior.core.soldierFocus'), runtime.time);
  assert.equal(runtime.resourceController.value('adrenaline'), 11.9);
});
