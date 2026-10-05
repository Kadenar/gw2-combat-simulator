import assert from 'node:assert/strict';
import test from 'node:test';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { applyMesmerClarity, consumeMesmerClarity } from '#gw2/professions/mesmer/core/mechanics/clarity.js';
import { mesmerEffectStates } from '#gw2/professions/mesmer/core/effect-state.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// Isolate buff recipients, replacement, and expiry without depending on spear animation timing.
function fixture() {
  const config = { specialization: 'Core' };
  const native = mesmerProfession.runtimeFor(config);
  const emitted = captureEffectEmissions();
  const runtime = { config, time: 1, profession: native.createState(config), effects: emitted.effects };
  const apply = (at, duration, includesSelf = true) => applyMesmerClarity(runtime, {
    type: 'buff', kind: 'clarity', at, duration, resolvedAudience: { includesSelf }, skillName: 'Mind the Gap'
  });
  return { runtime, core: runtime.profession.core, apply, emitted };
}

test('Clarity only arms for self and reapplication replaces its single charge and authored lifetime', () => {
  const { runtime, core, apply, emitted } = fixture();
  apply(1, 9, false);
  assert.equal(core.clarity.charges, 0);
  assert.equal(emitted.announcements.length, 0);
  apply(1, 9);
  const first = core.clarity;
  apply(2, 3);
  assert.notEqual(core.clarity, first);
  assert.deepEqual(core.clarity, { charges: 1, expiresAt: 5, readyAt: 0 });
  apply(3, 99, false);
  assert.equal(core.clarity.expiresAt, 5);
  assert.equal(emitted.announcements.length, 2);
  assert.equal(emitted.announcements[1].announcement.detail, 'Spear skills 3-5 empowered for 3s');
  assert.equal(consumeMesmerClarity(runtime, 3), true);
  assert.equal(consumeMesmerClarity(runtime, 3), false);
});

test('Clarity consumption and its derived timer exclude exact expiry without mutating observations', () => {
  for (const at of [4.999999, 5, 5.000001]) {
    const { runtime, core, apply } = fixture();
    apply(1, 4);
    runtime.time = at;
    const before = structuredClone(core.clarity);
    const effect = mesmerEffectStates(runtime)[0];
    assert.equal(effectStateValue(effect, at).count, at < 5 ? 1 : 0);
    if (at >= 5) assert.equal(projectObservedState(mesmerProfession, runtime).clarityRemaining, 0);
    assert.deepEqual(core.clarity, before);
    assert.equal(consumeMesmerClarity(runtime, at), at < 5);
    assert.equal(consumeMesmerClarity(runtime, at), false);
  }
});

test('Clarity observation remains detached after acceptance spends the owner grant', () => {
  const { runtime, core, apply } = fixture();
  apply(1, 4);
  const effect = mesmerEffectStates(runtime)[0];
  assert.equal(projectObservedState(mesmerProfession, runtime).clarityRemaining, 4000);
  assert.equal(consumeMesmerClarity(runtime, 1), true);
  assert.equal(core.clarity.charges, 0);
  assert.equal(effectStateValue(effect, 1).count, 1);
  assert.equal(effectStateValue(mesmerEffectStates(runtime)[0], 1).count, 0);
  assert.equal(projectObservedState(mesmerProfession, runtime).clarityRemaining, 0);
});

test('a nonqualifying spear attack preserves Clarity while a canceled qualifying acceptance spends it', () => {
  // Cancellation happens after acceptance and cannot restore the empowerment cost.
  for (const canceled of [false, true]) {
    const result = runMesmer(
      [{ skillId: canceled ? ID.MENTAL_COLLAPSE : ID.PSYCUT, ...(canceled ? { interruptAfterMs: 100 } : {}) }],
      { specialization: 'Core', primaryWeapon: 'Spear', selectedTraitIds: [], boons: {} },
      { initialize(runtime) { runtime.profession.core.clarity = { charges: 1, expiresAt: 10 }; } }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.events.find((event) => event.type === 'action').cancelled, canceled);
    assert.equal(result.planningState.profession.clarityRemaining > 0, !canceled);
  }
});
