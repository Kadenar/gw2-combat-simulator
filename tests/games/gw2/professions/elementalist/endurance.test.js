import assert from 'node:assert/strict';
import test from 'node:test';

import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

test('Phoenix Vigor contributes to recovery and the next dodge after expiry', () => {
  const options = {
    lines: [['Fire'], ['Air'], ['Earth']],
    weapons: ['Scepter', 'Dagger'],
    assumptions: { vigor: false }
  };
  const recovery = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 6000] });
  const buff = recovery.events.find((event) => event.type === 'buff' && event.kind === 'vigor');
  const firstDodge = recovery.events.find((event) => event.type === 'action' && event.skillName === 'Dodge');
  const end = observedRuntime(recovery).time;
  assert.deepEqual(recovery.warnings, []);
  assert.ok(end > buff.at + buff.duration);
  // The first dodge is spent at completion; subsequent regeneration includes exactly the Vigor window.
  const expected = (end - firstDodge.endsAt) * 5 + buff.duration * 2.5;
  assert.ok(Math.abs(recovery.planningState.profession[STATE.ENDURANCE].value - expected) < 1e-6);

  const retry = runNative({ ...options, rotation: ['Dodge', 'Dodge', 'Phoenix', 'Dodge'] });
  const nextDodge = retry.events.filter((event) => event.type === 'action' && event.skillName === 'Dodge').at(-1);
  assert.deepEqual(retry.warnings, []);
  const threshold = firstDodge.endsAt + (50 - buff.duration * 2.5) / 5;
  const expectedReadyAt = Math.ceil(threshold * 25) / 25;
  assert.ok(expectedReadyAt > buff.at + buff.duration);
  assert.ok(Math.abs(nextDodge.at - expectedReadyAt) < 1e-6);
});
